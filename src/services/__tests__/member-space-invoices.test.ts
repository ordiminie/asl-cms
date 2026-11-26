import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (_organizationId: string, callback: () => unknown) =>
    callback()
  ),
}))
vi.mock('@/db/repositories/member-profile-repository', () => ({}))
vi.mock('@/db/repositories/parcel-ownership-repository', () => ({
  listOwnershipPeriodsByProfilesDao: vi.fn(async () => []),
}))
vi.mock('@/db/repositories/billing-sync-state-repository', () => ({
  getBillingSyncStateDao: vi.fn(),
}))
vi.mock('@/db/repositories/member-invoice-repository', () => ({
  getInvoiceByIdDao: vi.fn(),
}))
vi.mock('@/lib/pennylane/pennylane-client.server', () => ({
  getPennylaneClient: vi.fn(),
}))
vi.mock('../member-profile-access-service', () => ({
  getMyAccessibleProfiles: vi.fn(),
}))
vi.mock('../association-settings-service', () => ({
  getAssociationSettingsService: vi.fn(),
}))
vi.mock('../billing/resolve-member-billing-provider', () => ({
  resolveMemberBillingProvider: vi.fn(),
}))

import {getBillingSyncStateDao} from '@/db/repositories/billing-sync-state-repository'
import {getInvoiceByIdDao} from '@/db/repositories/member-invoice-repository'
import {listOwnershipPeriodsByProfilesDao} from '@/db/repositories/parcel-ownership-repository'
import {PennylaneError} from '@/lib/pennylane/pennylane-client'
import {getPennylaneClient} from '@/lib/pennylane/pennylane-client.server'

import {getAssociationSettingsService} from '../association-settings-service'
import type {MemberBillingProvider} from '../billing/member-billing-provider'
import {resolveMemberBillingProvider} from '../billing/resolve-member-billing-provider'
import {AuthorizationError} from '../errors/authorization-error'
import {getMyAccessibleProfiles} from '../member-profile-access-service'
import {
  getMyInvoicePdfUrlService,
  getMyInvoicesService,
} from '../member-space-service'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  BILLING_INVOICE_SUBJECT_SETTING_KEY,
  BILLING_PROVIDER_SETTING_KEY,
  BILLING_SETTLED_STATUSES_SETTING_KEY,
  BILLING_STATUS_LABELS_SETTING_KEY,
  BILLING_UNPAID_STATUSES_SETTING_KEY,
  resolveSettings,
} from '../types/domain/association-settings-types'
import type {MemberInvoice} from '../types/domain/member-invoice-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE_A = '33333333-3333-4333-8333-333333333333'
const PROFILE_B = '44444444-4444-4444-8444-444444444444'
const PROFILE_SCI = '55555555-5555-4555-8555-555555555555'
const ACCOUNT_NAME = userTest.name

const profile = (
  id: string,
  name: string,
  pennylaneCustomerId: string | null = null,
  access: Record<string, string> = {status: 'owner'}
) =>
  ({
    id,
    name,
    pennylaneCustomerId,
    currentParcelNumbers: [],
    access,
  }) as unknown as Awaited<ReturnType<typeof getMyAccessibleProfiles>>[number]

const invoice = (overrides: Partial<MemberInvoice>): MemberInvoice => ({
  id: '99999999-9999-4999-8999-999999999999',
  memberProfileId: PROFILE_A,
  parcelId: 'p12',
  parcelNumber: '12',
  meterNumber: '0045821',
  source: 'site',
  year: 2026,
  issuedOn: '2026-03-15',
  dueOn: '2026-04-15',
  amountCents: 41250,
  status: 'En attente',
  hasPdf: false,
  paymentUrl: null,
  ...overrides,
})

/** Un fournisseur doublé (critère 10) : aucune base, des factures en mémoire. */
const doubleProvider = (invoices: MemberInvoice[]) =>
  ({
    id: 'double',
    canWrite: false,
    listInvoicesOf: vi.fn(async () => invoices),
  }) satisfies MemberBillingProvider

const settings = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
  {
    key: BILLING_INVOICE_SUBJECT_SETTING_KEY,
    value: 'Cotisation et eau {année}',
  },
  {key: BILLING_UNPAID_STATUSES_SETTING_KEY, value: 'En attente\nRelance 1'},
  {key: BILLING_SETTLED_STATUSES_SETTING_KEY, value: 'Payée'},
])

let provider: ReturnType<typeof doubleProvider>

beforeEach(() => {
  vi.clearAllMocks()
  setupAuthUserMocked(userTest)
  vi.mocked(getMyAccessibleProfiles).mockResolvedValue([
    profile(PROFILE_A, ACCOUNT_NAME),
    profile(PROFILE_B, ACCOUNT_NAME),
    profile(PROFILE_SCI, 'SCI Les Pins'),
  ])
  vi.mocked(getAssociationSettingsService).mockResolvedValue(settings)
  provider = doubleProvider([
    invoice({
      id: 'i-a-2025',
      memberProfileId: PROFILE_A,
      issuedOn: '2025-03-15',
      dueOn: '2025-04-15',
      year: 2025,
      status: 'Payée',
    }),
    invoice({
      id: 'i-b-2026',
      memberProfileId: PROFILE_B,
      parcelNumber: '27',
      meterNumber: '0051207',
      issuedOn: '2026-03-20',
      dueOn: '2026-04-30',
      status: 'Partiellement payée',
    }),
    invoice({
      id: 'i-sci-2026',
      memberProfileId: PROFILE_SCI,
      parcelNumber: '31',
      meterNumber: null,
      issuedOn: '2026-03-15',
      status: 'Relance 1',
    }),
  ])
  vi.mocked(resolveMemberBillingProvider).mockReturnValue(provider)
})

describe('getMyInvoicesService — « Mes factures » du propriétaire connecté', () => {
  it('critère 1 et 10 : les factures de tous ses terrains, d’un fournisseur quelconque, émission décroissante', async () => {
    const result = await getMyInvoicesService(ORG_ID)

    expect(result?.landCount).toBe(3)
    expect(result?.invoices.map((row) => row.issuedOn)).toEqual([
      '2026-03-20',
      '2026-03-15',
      '2025-03-15',
    ])
    expect(result?.invoices[0]).toEqual({
      issuedOn: '2026-03-20',
      subject: 'Cotisation et eau 2026',
      parcelNumbers: ['27'],
      meterNumber: '0051207',
      holderName: null,
      amountCents: 41250,
      dueOn: '2026-04-30',
      status: 'Partiellement payée',
      statusLabel: 'Partiellement payée',
      statusClass: 'unclassified',
      hasPdf: false,
      pdfRef: null,
      payment: null,
    })
    expect(result).toMatchObject({
      syncedFromPennylane: false,
      syncedAt: null,
      lastSyncFailed: false,
      unlinked: false,
    })
    expect(getBillingSyncStateDao).not.toHaveBeenCalled()
  })

  it('critère 7 : ne demande que les fiches du compte, jamais un identifiant venu de l’appelant', async () => {
    await getMyInvoicesService(ORG_ID)

    expect(getMyAccessibleProfiles).toHaveBeenCalledWith(ORG_ID, userTest.id)
    expect(provider.listInvoicesOf).toHaveBeenCalledWith(ORG_ID, [
      PROFILE_A,
      PROFILE_B,
      PROFILE_SCI,
    ])
  })

  it('critère 2 : le statut est rendu tel que fourni, jamais réduit', async () => {
    const result = await getMyInvoicesService(ORG_ID)

    expect(result?.invoices.map((row) => row.status)).toEqual([
      'Partiellement payée',
      'Relance 1',
      'Payée',
    ])
  })

  it('critère 3 : l’échéance est distincte de l’émission', async () => {
    const result = await getMyInvoicesService(ORG_ID)

    expect(result?.invoices[0].dueOn).toBe('2026-04-30')
    expect(result?.invoices[0].issuedOn).toBe('2026-03-20')
  })

  it('critère 4 : l’objet est composé par le site, jamais le libellé de la source', async () => {
    const result = await getMyInvoicesService(ORG_ID)

    expect(result?.invoices.map((row) => row.subject)).toEqual([
      'Cotisation et eau 2026',
      'Cotisation et eau 2026',
      'Cotisation et eau 2025',
    ])
  })

  it('critère 5 et 6 : la classe suit la configuration ; un statut jamais vu est à classer', async () => {
    const result = await getMyInvoicesService(ORG_ID)

    expect(result?.invoices.map((row) => row.statusClass)).toEqual([
      'unclassified',
      'unpaid',
      'settled',
    ])
  })

  it('nomme la fiche quand elle n’est pas au nom du compte', async () => {
    const result = await getMyInvoicesService(ORG_ID)

    expect(result?.invoices[1]).toMatchObject({
      parcelNumbers: ['31'],
      meterNumber: null,
      holderName: 'SCI Les Pins',
    })
    expect(result?.invoices[2].holderName).toBeNull()
  })

  it('aucun identifiant de fiche ni de facture dans ce que voit le membre', async () => {
    const result = await getMyInvoicesService(ORG_ID)

    const text = JSON.stringify(result)
    for (const id of [PROFILE_A, PROFILE_B, PROFILE_SCI, 'i-a-2025', 'p12']) {
      expect(text).not.toContain(id)
    }
  })

  it('un compte sans fiche dans l’association : rien, sans lire les factures', async () => {
    vi.mocked(getMyAccessibleProfiles).mockResolvedValue([])

    expect(await getMyInvoicesService(ORG_ID)).toBeUndefined()
    expect(provider.listInvoicesOf).not.toHaveBeenCalled()
  })

  it('[PUBLIC] sans session : refus, sans lecture', async () => {
    setupAuthUserMocked(undefined)

    await expect(getMyInvoicesService(ORG_ID)).rejects.toThrow(
      AuthorizationError
    )
    expect(getMyAccessibleProfiles).not.toHaveBeenCalled()
  })

  it('refuse un identifiant d’association invalide', async () => {
    await expect(getMyInvoicesService('pas-un-uuid')).rejects.toThrow()
    expect(getMyAccessibleProfiles).not.toHaveBeenCalled()
  })
})

describe('getMyInvoicesService — sous Pennylane (s20, ADR 062)', () => {
  const EXTERNAL_REF = '3f2a9c1e-1111-4111-8111-111111111111'
  const pennylaneSettings = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
    {key: BILLING_PROVIDER_SETTING_KEY, value: 'pennylane'},
    {key: BILLING_UNPAID_STATUSES_SETTING_KEY, value: 'late'},
    {key: BILLING_STATUS_LABELS_SETTING_KEY, value: 'late = En retard'},
  ])
  const pennylaneInvoice = invoice({
    id: 'i-pl',
    memberProfileId: PROFILE_A,
    source: 'pennylane',
    parcelId: null,
    parcelNumber: null,
    meterNumber: null,
    status: 'late',
    hasPdf: true,
  })

  beforeEach(() => {
    vi.mocked(getAssociationSettingsService).mockResolvedValue(
      pennylaneSettings
    )
    vi.mocked(getMyAccessibleProfiles).mockResolvedValue([
      profile(PROFILE_A, ACCOUNT_NAME, EXTERNAL_REF),
    ])
    provider = {
      ...doubleProvider([
        pennylaneInvoice,
        invoice({
          id: 'i-pl-2',
          source: 'pennylane',
          parcelId: null,
          parcelNumber: null,
          meterNumber: null,
          status: 'paid',
          hasPdf: false,
          issuedOn: '2025-03-15',
          dueOn: '2025-04-15',
          year: 2025,
        }),
      ]),
      id: 'pennylane',
    }
    vi.mocked(resolveMemberBillingProvider).mockReturnValue(provider)
    vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([
      {
        memberProfileId: PROFILE_A,
        number: '13',
        meterNumber: '0045821',
        startsOn: '2020-01-01',
        endsOn: null,
      },
      {
        memberProfileId: PROFILE_A,
        number: '12',
        meterNumber: '0045821',
        startsOn: '2020-01-01',
        endsOn: null,
      },
      {
        memberProfileId: PROFILE_A,
        number: '40',
        meterNumber: '0077',
        startsOn: '2026-06-01',
        endsOn: null,
      },
    ])
    vi.mocked(getBillingSyncStateDao).mockResolvedValue({
      organizationId: ORG_ID,
      lastAttemptAt: new Date('2026-11-19T13:05:00.000Z'),
      lastSuccessAt: new Date('2026-11-19T13:05:00.000Z'),
      lastError: null,
      counts: {},
      unmatchedCustomers: [],
      terrainMismatches: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('le terrain est celui de la fiche à la date d’émission : ses parcelles et leur compteur', async () => {
    const result = await getMyInvoicesService(ORG_ID)

    expect(listOwnershipPeriodsByProfilesDao).toHaveBeenCalledWith([PROFILE_A])
    expect(result?.invoices[0]).toMatchObject({
      parcelNumbers: ['12', '13'],
      meterNumber: '0045821',
    })
  })

  it('le statut lu par le membre est son libellé, sinon le statut brut ; la classe suit le statut', async () => {
    const result = await getMyInvoicesService(ORG_ID)

    expect(
      result?.invoices.map((row) => [
        row.status,
        row.statusLabel,
        row.statusClass,
      ])
    ).toEqual([
      ['late', 'En retard', 'unpaid'],
      ['paid', 'paid', 'unclassified'],
    ])
  })

  it('le PDF : une référence pour le bouton quand Pennylane en fournit un, rien sinon (critères 7 et 8)', async () => {
    const result = await getMyInvoicesService(ORG_ID)

    expect(result?.invoices.map((row) => [row.hasPdf, row.pdfRef])).toEqual([
      [true, 'i-pl'],
      [false, null],
    ])
  })

  it('date de la dernière mise à jour ; aucun échec ; compte relié', async () => {
    const result = await getMyInvoicesService(ORG_ID)

    expect(result).toMatchObject({
      syncedFromPennylane: true,
      syncedAt: '2026-11-19T13:05:00.000Z',
      lastSyncFailed: false,
      unlinked: false,
    })
  })

  it('dernière synchronisation échouée : les dernières données connues et leur date (critère 9)', async () => {
    vi.mocked(getBillingSyncStateDao).mockResolvedValue({
      organizationId: ORG_ID,
      lastAttemptAt: new Date('2026-11-19T14:00:00.000Z'),
      lastSuccessAt: new Date('2026-11-19T13:05:00.000Z'),
      lastError: 'unavailable',
      counts: {},
      unmatchedCustomers: [],
      terrainMismatches: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const result = await getMyInvoicesService(ORG_ID)

    expect(result).toMatchObject({
      syncedAt: '2026-11-19T13:05:00.000Z',
      lastSyncFailed: true,
    })
    expect(result?.invoices).toHaveLength(2)
  })

  it('jamais synchronisé : aucune date', async () => {
    vi.mocked(getBillingSyncStateDao).mockResolvedValue(undefined)

    expect(await getMyInvoicesService(ORG_ID)).toMatchObject({
      syncedAt: null,
      lastSyncFailed: false,
    })
  })

  it('aucune fiche du compte reliée à Pennylane : le compte est signalé non relié (1e)', async () => {
    vi.mocked(getMyAccessibleProfiles).mockResolvedValue([
      profile(PROFILE_A, ACCOUNT_NAME, null),
    ])

    expect((await getMyInvoicesService(ORG_ID))?.unlinked).toBe(true)
  })

  it('aucun appel réseau à l’affichage (critère 9)', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    await getMyInvoicesService(ORG_ID)

    vi.unstubAllGlobals()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(getPennylaneClient).not.toHaveBeenCalled()
  })
})

describe('getMyInvoicePdfUrlService — le PDF relu au clic (s20, ADR 062 §6)', () => {
  const INVOICE_ID = '66666666-6666-4666-8666-666666666666'
  const PDF_URL = 'https://pennylane.test/public/invoice/pdf?token=expire'
  const getFile = vi.fn()
  const row = (overrides: Record<string, unknown> = {}) =>
    ({
      id: INVOICE_ID,
      organizationId: ORG_ID,
      memberProfileId: PROFILE_A,
      source: 'pennylane',
      externalId: '9001',
      hasPdf: true,
      ...overrides,
    }) as never

  beforeEach(() => {
    getFile.mockReset()
    getFile.mockResolvedValue(PDF_URL)
    vi.mocked(getPennylaneClient).mockReturnValue({
      listCustomers: vi.fn(),
      listCustomerInvoices: vi.fn(),
      getCustomerInvoiceFileUrl: getFile,
    })
    vi.mocked(getInvoiceByIdDao).mockResolvedValue(row())
  })

  it('une facture Pennylane d’une fiche du compte : l’adresse relue chez Pennylane', async () => {
    expect(await getMyInvoicePdfUrlService(ORG_ID, INVOICE_ID)).toEqual({
      status: 'ready',
      url: PDF_URL,
    })
    expect(getMyAccessibleProfiles).toHaveBeenCalledWith(ORG_ID, userTest.id)
    expect(getInvoiceByIdDao).toHaveBeenCalledWith(INVOICE_ID)
    expect(getFile).toHaveBeenCalledWith('9001')
  })

  it('l’adresse n’est écrite nulle part : aucun dépôt ne la reçoit', async () => {
    await getMyInvoicePdfUrlService(ORG_ID, INVOICE_ID)

    const calls = JSON.stringify([
      vi.mocked(getInvoiceByIdDao).mock.calls,
      vi.mocked(getBillingSyncStateDao).mock.calls,
      vi.mocked(listOwnershipPeriodsByProfilesDao).mock.calls,
    ])
    expect(calls).not.toContain('pennylane.test')
  })

  it('la facture d’un autre membre : introuvable, Pennylane jamais appelé', async () => {
    vi.mocked(getInvoiceByIdDao).mockResolvedValue(
      row({memberProfileId: '77777777-7777-4777-8777-777777777777'})
    )

    expect(await getMyInvoicePdfUrlService(ORG_ID, INVOICE_ID)).toEqual({
      status: 'not_found',
    })
    expect(getFile).not.toHaveBeenCalled()
  })

  it('une facture d’une autre association, invisible sous le tenant : introuvable', async () => {
    vi.mocked(getInvoiceByIdDao).mockResolvedValue(undefined)

    expect(await getMyInvoicePdfUrlService(ORG_ID, INVOICE_ID)).toEqual({
      status: 'not_found',
    })
    expect(getFile).not.toHaveBeenCalled()
  })

  it('une facture saisie sur le site : aucun PDF à relire', async () => {
    vi.mocked(getInvoiceByIdDao).mockResolvedValue(
      row({source: 'site', externalId: null})
    )

    expect(await getMyInvoicePdfUrlService(ORG_ID, INVOICE_ID)).toEqual({
      status: 'not_found',
    })
    expect(getFile).not.toHaveBeenCalled()
  })

  it('Pennylane indisponible ou PDF disparu : « indisponible », jamais un lien mort', async () => {
    getFile.mockRejectedValueOnce(new PennylaneError('unavailable'))
    getFile.mockResolvedValueOnce(null)

    expect(await getMyInvoicePdfUrlService(ORG_ID, INVOICE_ID)).toEqual({
      status: 'unavailable',
    })
    expect(await getMyInvoicePdfUrlService(ORG_ID, INVOICE_ID)).toEqual({
      status: 'unavailable',
    })
  })

  it.each([
    ['http', 'http://pennylane.test/public/invoice/pdf?token=expire'],
    ['javascript', 'javascript:alert(1)'],
    ['illisible', 'pas une adresse'],
  ])(
    'une adresse %s rendue par la source : « indisponible », jamais ouverte',
    async (_label, url) => {
      getFile.mockResolvedValueOnce(url)

      expect(await getMyInvoicePdfUrlService(ORG_ID, INVOICE_ID)).toEqual({
        status: 'unavailable',
      })
    }
  )

  it('[PUBLIC] sans session : refus', async () => {
    setupAuthUserMocked(undefined)

    await expect(getMyInvoicePdfUrlService(ORG_ID, INVOICE_ID)).rejects.toThrow(
      AuthorizationError
    )
    expect(getInvoiceByIdDao).not.toHaveBeenCalled()
  })

  it('refuse un identifiant de facture invalide', async () => {
    await expect(
      getMyInvoicePdfUrlService(ORG_ID, 'pas-un-uuid')
    ).rejects.toThrow()
    expect(getInvoiceByIdDao).not.toHaveBeenCalled()
  })
})

describe('getMyInvoicesService — le règlement d’une facture (s21, ADR 063)', () => {
  const HTTPS_LINK = 'https://paiement.example.org/facture/i-a-2026'

  const paymentOf = async (overrides: Partial<MemberInvoice>) => {
    vi.mocked(resolveMemberBillingProvider).mockReturnValue(
      doubleProvider([invoice({id: 'i-a-2026', ...overrides})])
    )
    const result = await getMyInvoicesService(ORG_ID)
    return result?.invoices[0].payment
  }

  it('critère 1 : impayée avec un lien https du fournisseur : le lien, tel quel', async () => {
    expect(
      await paymentOf({status: 'En attente', paymentUrl: HTTPS_LINK})
    ).toEqual({kind: 'link', url: HTTPS_LINK})
  })

  it('critère 3 : impayée sans lien : par virement', async () => {
    expect(await paymentOf({status: 'Relance 1', paymentUrl: null})).toEqual({
      kind: 'transfer',
    })
  })

  it.each([
    ['http:', 'http://paiement.example.org/facture/1'],
    ['javascript:', 'javascript:alert(1)'],
    ['chaîne vide', ''],
  ])(
    'critère 6 : impayée avec un lien %s : jamais rendu, par virement',
    async (_label, paymentUrl) => {
      expect(await paymentOf({status: 'En attente', paymentUrl})).toEqual({
        kind: 'transfer',
      })
    }
  )

  it('critère 5 : réglée, même avec un lien : ni bouton ni virement', async () => {
    expect(
      await paymentOf({status: 'Payée', paymentUrl: HTTPS_LINK})
    ).toBeNull()
  })

  it('critère 5 : « à classer », même avec un lien : ni bouton ni virement', async () => {
    expect(
      await paymentOf({status: 'Statut jamais vu', paymentUrl: HTTPS_LINK})
    ).toBeNull()
  })
})

describe('accès après la vente — factures d’avant la vente seulement (s57, critère 6)', () => {
  const SOLD_ON = '2026-03-15'
  const grace = {status: 'grace', soldOn: SOLD_ON, closesOn: '2026-09-15'}

  beforeEach(() => {
    vi.mocked(getMyAccessibleProfiles).mockResolvedValue([
      profile(PROFILE_A, ACCOUNT_NAME, null, grace),
      profile(PROFILE_B, ACCOUNT_NAME),
    ])
    provider = doubleProvider([
      invoice({id: 'a-veille', issuedOn: '2026-03-14', status: 'Payée'}),
      invoice({id: 'a-jour', issuedOn: SOLD_ON, status: 'Payée'}),
      invoice({id: 'a-impayee-avant', issuedOn: '2025-11-02'}),
      invoice({id: 'a-impayee-apres', issuedOn: '2026-05-01'}),
      invoice({
        id: 'b-apres',
        memberProfileId: PROFILE_B,
        issuedOn: '2026-05-01',
      }),
    ])
    vi.mocked(resolveMemberBillingProvider).mockReturnValue(provider)
  })

  it('en délai : la facture de la veille de la vente et l’impayée d’avant restent, celles du jour et d’après sont masquées', async () => {
    const result = await getMyInvoicesService(ORG_ID)

    expect(
      result?.invoices.map(({issuedOn, statusClass}) => ({
        issuedOn,
        statusClass,
      }))
    ).toEqual([
      {issuedOn: '2026-05-01', statusClass: 'unpaid'},
      {issuedOn: '2026-03-14', statusClass: 'settled'},
      {issuedOn: '2025-11-02', statusClass: 'unpaid'},
    ])
    expect(result?.landCount).toBe(2)
  })

  it('l’impayée d’après la vente est masquée sur la fiche vendue, pas sur une fiche encore propriétaire', async () => {
    const result = await getMyInvoicesService(ORG_ID)

    expect(
      result?.invoices.filter((row) => row.issuedOn === '2026-05-01')
    ).toHaveLength(1)
  })

  it('identifiant forgé d’une facture d’après la vente : introuvable, Pennylane jamais appelé', async () => {
    const getFile = vi.fn()
    vi.mocked(getPennylaneClient).mockReturnValue({
      listCustomers: vi.fn(),
      listCustomerInvoices: vi.fn(),
      getCustomerInvoiceFileUrl: getFile,
    })
    vi.mocked(getInvoiceByIdDao).mockResolvedValue({
      id: '66666666-6666-4666-8666-666666666666',
      memberProfileId: PROFILE_A,
      source: 'pennylane',
      externalId: '9001',
      hasPdf: true,
      issuedOn: SOLD_ON,
    } as never)

    expect(
      await getMyInvoicePdfUrlService(
        ORG_ID,
        '66666666-6666-4666-8666-666666666666'
      )
    ).toEqual({status: 'not_found'})
    expect(getFile).not.toHaveBeenCalled()
  })

  it('identifiant d’une facture d’avant la vente : le PDF est relu', async () => {
    const getFile = vi.fn(async () => 'https://pennylane.test/pdf')
    vi.mocked(getPennylaneClient).mockReturnValue({
      listCustomers: vi.fn(),
      listCustomerInvoices: vi.fn(),
      getCustomerInvoiceFileUrl: getFile,
    })
    vi.mocked(getInvoiceByIdDao).mockResolvedValue({
      id: '66666666-6666-4666-8666-666666666666',
      memberProfileId: PROFILE_A,
      source: 'pennylane',
      externalId: '9001',
      hasPdf: true,
      issuedOn: '2026-03-14',
    } as never)

    expect(
      await getMyInvoicePdfUrlService(
        ORG_ID,
        '66666666-6666-4666-8666-666666666666'
      )
    ).toEqual({status: 'ready', url: 'https://pennylane.test/pdf'})
  })
})
