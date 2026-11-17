import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (_organizationId: string, callback: () => unknown) =>
    callback()
  ),
}))
vi.mock('@/db/repositories/member-profile-repository', () => ({}))
vi.mock('@/db/repositories/parcel-ownership-repository', () => ({}))
vi.mock('../member-account-service', () => ({
  getMyMemberProfiles: vi.fn(),
}))
vi.mock('../association-settings-service', () => ({
  getAssociationSettingsService: vi.fn(),
}))
vi.mock('../billing/resolve-member-billing-provider', () => ({
  resolveMemberBillingProvider: vi.fn(),
}))

import {getAssociationSettingsService} from '../association-settings-service'
import type {MemberBillingProvider} from '../billing/member-billing-provider'
import {resolveMemberBillingProvider} from '../billing/resolve-member-billing-provider'
import {AuthorizationError} from '../errors/authorization-error'
import {getMyMemberProfiles} from '../member-account-service'
import {getMyInvoicesService} from '../member-space-service'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  BILLING_INVOICE_SUBJECT_SETTING_KEY,
  BILLING_SETTLED_STATUSES_SETTING_KEY,
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

const profile = (id: string, name: string) =>
  ({id, name, currentParcelNumbers: []}) as unknown as Awaited<
    ReturnType<typeof getMyMemberProfiles>
  >[number]

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
  vi.mocked(getMyMemberProfiles).mockResolvedValue([
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
      parcelNumber: '27',
      meterNumber: '0051207',
      holderName: null,
      amountCents: 41250,
      dueOn: '2026-04-30',
      status: 'Partiellement payée',
      statusClass: 'unclassified',
    })
  })

  it('critère 7 : ne demande que les fiches du compte, jamais un identifiant venu de l’appelant', async () => {
    await getMyInvoicesService(ORG_ID)

    expect(getMyMemberProfiles).toHaveBeenCalledWith(ORG_ID, userTest.id)
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
      parcelNumber: '31',
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
    vi.mocked(getMyMemberProfiles).mockResolvedValue([])

    expect(await getMyInvoicesService(ORG_ID)).toBeUndefined()
    expect(provider.listInvoicesOf).not.toHaveBeenCalled()
  })

  it('[PUBLIC] sans session : refus, sans lecture', async () => {
    setupAuthUserMocked(undefined)

    await expect(getMyInvoicesService(ORG_ID)).rejects.toThrow(
      AuthorizationError
    )
    expect(getMyMemberProfiles).not.toHaveBeenCalled()
  })

  it('refuse un identifiant d’association invalide', async () => {
    await expect(getMyInvoicesService('pas-un-uuid')).rejects.toThrow()
    expect(getMyMemberProfiles).not.toHaveBeenCalled()
  })
})
