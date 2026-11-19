import {beforeEach, describe, expect, it, vi} from 'vitest'

const scope = vi.hoisted(() => ({current: undefined as string | undefined}))

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (organizationId: string, callback: () => unknown) => {
    const previous = scope.current
    scope.current = organizationId
    try {
      return await callback()
    } finally {
      scope.current = previous
    }
  }),
}))
vi.mock('@/db/repositories/member-invoice-repository', () => ({
  listInvoicesByProfileIdsDao: vi.fn(),
  listInvoicesByMemberDao: vi.fn(),
  getInvoiceByIdDao: vi.fn(),
  createInvoiceDao: vi.fn(),
  updateSiteInvoiceDao: vi.fn(),
  countInvoicesByStatusDao: vi.fn(),
  claimStatusAlertDao: vi.fn(),
  releaseStatusAlertDao: vi.fn(),
}))
vi.mock('../association-settings-service', () => ({
  getAssociationSettingsService: vi.fn(),
}))
vi.mock('../parcel-ownership-service', () => ({
  getParcelOwnerAtService: vi.fn(),
}))
vi.mock('../billing/resolve-member-billing-provider', () => ({
  resolveMemberBillingProvider: vi.fn(),
}))
vi.mock('@/db/repositories/billing-sync-state-repository', () => ({
  getBillingSyncStateDao: vi.fn(),
}))
vi.mock('../email-service', () => ({
  sendInvoiceStatusAlertEmailService: vi.fn(),
}))

import {getBillingSyncStateDao} from '@/db/repositories/billing-sync-state-repository'
import {
  claimStatusAlertDao,
  createInvoiceDao,
  getInvoiceByIdDao,
  listInvoicesByProfileIdsDao,
  MemberInvoiceRow,
  updateSiteInvoiceDao,
} from '@/db/repositories/member-invoice-repository'

import {getAssociationSettingsService} from '../association-settings-service'
import {manualMemberBillingProvider} from '../billing/manual-member-billing-provider'
import {resolveMemberBillingProvider} from '../billing/resolve-member-billing-provider'
import {sendInvoiceStatusAlertEmailService} from '../email-service'
import {AuthorizationError} from '../errors/authorization-error'
import {ReadOnlyInvoiceError} from '../errors/member-invoice-errors'
import {ValidationParsedZodError} from '../errors/validation-error'
import {
  canManageMemberInvoicesService,
  createMemberInvoiceService,
  getMemberInvoiceService,
  listMemberInvoicesService,
  updateMemberInvoiceService,
} from '../member-invoice-service'
import {getParcelOwnerAtService} from '../parcel-ownership-service'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  BILLING_INVOICE_SUBJECT_SETTING_KEY,
  BILLING_SETTLED_STATUSES_SETTING_KEY,
  BILLING_UNPAID_STATUSES_SETTING_KEY,
  CONTACT_EMAIL_SETTING_KEY,
  resolveSettings,
} from '../types/domain/association-settings-types'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import type {MemberProfileFieldsDTO} from '../types/domain/member-profile-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_PROFILE_ID = '44444444-4444-4444-8444-444444444444'
const PARCEL_ID = '55555555-5555-4555-8555-555555555555'
const INVOICE_ID = '66666666-6666-4666-8666-666666666666'

const withRole = (role: OrganizationRole, organizationId = ORG_ID): User => ({
  ...userTest,
  organizations: [
    {
      id: 'membership',
      organizationId,
      userId: userTest.id,
      role,
      createdAt: new Date(),
    },
  ],
})

const settings = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
  {key: CONTACT_EMAIL_SETTING_KEY, value: 'contact@asl.test'},
  {
    key: BILLING_INVOICE_SUBJECT_SETTING_KEY,
    value: 'Cotisation et eau {année}',
  },
  {key: BILLING_UNPAID_STATUSES_SETTING_KEY, value: 'En attente'},
  {key: BILLING_SETTLED_STATUSES_SETTING_KEY, value: 'Payée'},
])

const invoiceRow = (overrides: Partial<MemberInvoiceRow> = {}) =>
  ({
    id: INVOICE_ID,
    organizationId: ORG_ID,
    memberProfileId: PROFILE_ID,
    parcelId: PARCEL_ID,
    parcelNumber: '12',
    meterNumber: '0045821',
    source: 'site',
    externalId: null,
    year: 2026,
    issuedOn: '2026-03-15',
    dueOn: '2026-04-15',
    amountCents: 41250,
    status: 'En attente',
    hasPdf: false,
    createdAt: new Date('2026-03-15T10:00:00Z'),
    updatedAt: new Date('2026-03-15T10:00:00Z'),
    ...overrides,
  }) satisfies MemberInvoiceRow

const ownerIs = (id: string | undefined) =>
  vi
    .mocked(getParcelOwnerAtService)
    .mockResolvedValue(
      id ? ({id, organizationId: ORG_ID} as MemberProfileFieldsDTO) : undefined
    )

const createInput = {
  organizationId: ORG_ID,
  memberProfileId: PROFILE_ID,
  parcelId: PARCEL_ID,
  year: 2026,
  issuedOn: '2026-03-15',
  dueOn: '2026-04-15',
  amountCents: 41250,
  status: 'En attente',
}

const updateInput = {
  organizationId: ORG_ID,
  invoiceId: INVOICE_ID,
  parcelId: PARCEL_ID,
  year: 2026,
  issuedOn: '2026-03-15',
  dueOn: '2026-04-15',
  amountCents: 39000,
  status: 'Payée',
}

beforeEach(() => {
  vi.clearAllMocks()
  scope.current = undefined
  setupAuthUserMocked(withRole(UserOrganizationRoleConst.ADMIN))
  vi.mocked(getAssociationSettingsService).mockResolvedValue(settings)
  vi.mocked(resolveMemberBillingProvider).mockReturnValue(
    manualMemberBillingProvider
  )
  ownerIs(PROFILE_ID)
  vi.mocked(createInvoiceDao).mockImplementation(async (input) => {
    expect(scope.current).toBe(ORG_ID)
    return {...invoiceRow(), ...input}
  })
  vi.mocked(getInvoiceByIdDao).mockResolvedValue(invoiceRow())
  vi.mocked(updateSiteInvoiceDao).mockImplementation(async () => {
    expect(scope.current).toBe(ORG_ID)
    return 1
  })
  vi.mocked(listInvoicesByProfileIdsDao).mockResolvedValue([
    invoiceRow(),
    invoiceRow({
      id: 'pennylane-1',
      source: 'pennylane',
      issuedOn: '2025-03-15',
      dueOn: '2025-04-15',
      year: 2025,
      status: 'Statut jamais vu',
    }),
  ])
})

describe('createMemberInvoiceService — accès accordés (critère 9)', () => {
  it.each<[string, User]>([
    [
      '[ORGANIZATION ADMIN] le bureau',
      withRole(UserOrganizationRoleConst.ADMIN),
    ],
    [
      '[ORGANIZATION OWNER] la présidente',
      withRole(UserOrganizationRoleConst.OWNER),
    ],
    ['[SUPER_ADMIN]', userTestSuperAdmin],
  ])('%s saisit une facture', async (_label, user) => {
    setupAuthUserMocked(user)

    const result = await createMemberInvoiceService(createInput)

    expect(result).toEqual({status: 'saved', invoiceId: INVOICE_ID})
    expect(createInvoiceDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      parcelId: PARCEL_ID,
      source: 'site',
      year: 2026,
      issuedOn: '2026-03-15',
      dueOn: '2026-04-15',
      amountCents: 41250,
      status: 'En attente',
    })
  })

  it('vérifie la parcelle à la date d’émission (lecture datée)', async () => {
    await createMemberInvoiceService(createInput)

    expect(getParcelOwnerAtService).toHaveBeenCalledWith(
      ORG_ID,
      PARCEL_ID,
      '2026-03-15'
    )
  })
})

describe('createMemberInvoiceService — refus, rien n’est écrit', () => {
  it.each<[string, User | undefined]>([
    ['[PUBLIC] sans session', undefined],
    [
      '[ORGANIZATION MEMBER] un membre simple',
      withRole(UserOrganizationRoleConst.MEMBER),
    ],
    [
      '[ORGANIZATION ADMIN] le bureau d’une autre association',
      withRole(UserOrganizationRoleConst.ADMIN, OTHER_ORG_ID),
    ],
  ])('%s', async (_label, user) => {
    setupAuthUserMocked(user)

    await expect(createMemberInvoiceService(createInput)).rejects.toThrow(
      AuthorizationError
    )
    expect(createInvoiceDao).not.toHaveBeenCalled()
    expect(getParcelOwnerAtService).not.toHaveBeenCalled()
  })

  it('une parcelle dont la fiche n’est pas propriétaire à la date d’émission (critère 8)', async () => {
    ownerIs(OTHER_PROFILE_ID)

    expect(await createMemberInvoiceService(createInput)).toEqual({
      status: 'parcel_not_owned',
    })
    expect(createInvoiceDao).not.toHaveBeenCalled()
  })

  it('une parcelle sans propriétaire à cette date', async () => {
    ownerIs(undefined)

    expect(await createMemberInvoiceService(createInput)).toEqual({
      status: 'parcel_not_owned',
    })
    expect(createInvoiceDao).not.toHaveBeenCalled()
  })

  it('un statut hors de la configuration du tenant (ADR 059 §8)', async () => {
    expect(
      await createMemberInvoiceService({...createInput, status: 'Inventé'})
    ).toEqual({status: 'unknown_status'})
    expect(createInvoiceDao).not.toHaveBeenCalled()
  })

  it('une échéance antérieure à l’émission', async () => {
    await expect(
      createMemberInvoiceService({...createInput, dueOn: '2026-03-14'})
    ).rejects.toThrow(ValidationParsedZodError)
    expect(createInvoiceDao).not.toHaveBeenCalled()
  })

  it.each([
    ['un montant nul', {amountCents: 0}],
    ['un montant décimal', {amountCents: 12.5}],
    ['une année hors bornes', {year: 1850}],
    ['une date qui n’existe pas', {issuedOn: '2026-02-30'}],
  ])('%s', async (_label, patch) => {
    await expect(
      createMemberInvoiceService({...createInput, ...patch})
    ).rejects.toThrow(ValidationParsedZodError)
    expect(createInvoiceDao).not.toHaveBeenCalled()
  })

  it('le fournisseur de l’association ne permet pas la saisie', async () => {
    vi.mocked(resolveMemberBillingProvider).mockReturnValue({
      ...manualMemberBillingProvider,
      id: 'double',
      canWrite: false,
    })

    await expect(createMemberInvoiceService(createInput)).rejects.toThrow(
      AuthorizationError
    )
    expect(createInvoiceDao).not.toHaveBeenCalled()
  })

  it('le droit de vérifier la parcelle manque : refus explicite', async () => {
    vi.mocked(getParcelOwnerAtService).mockRejectedValue(
      new AuthorizationError('parcelles')
    )

    await expect(createMemberInvoiceService(createInput)).rejects.toThrow(
      /parcelle facturée/
    )
    expect(createInvoiceDao).not.toHaveBeenCalled()
  })
})

describe('updateMemberInvoiceService — corriger une facture du site (critère 9)', () => {
  it('[ORGANIZATION OWNER] corrige une facture saisie sur le site', async () => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))

    expect((await updateMemberInvoiceService(updateInput)).status).toBe('saved')
    expect(updateSiteInvoiceDao).toHaveBeenCalledWith(INVOICE_ID, {
      parcelId: PARCEL_ID,
      year: 2026,
      issuedOn: '2026-03-15',
      dueOn: '2026-04-15',
      amountCents: 39000,
      status: 'Payée',
    })
  })

  it('une facture Pennylane est refusée côté serveur, même en appel direct', async () => {
    vi.mocked(getInvoiceByIdDao).mockResolvedValue(
      invoiceRow({source: 'pennylane'})
    )

    await expect(updateMemberInvoiceService(updateInput)).rejects.toThrow(
      ReadOnlyInvoiceError
    )
    await expect(updateMemberInvoiceService(updateInput)).rejects.toThrow(
      AuthorizationError
    )
    expect(updateSiteInvoiceDao).not.toHaveBeenCalled()
  })

  it('l’UPDATE conditionné ne touche rien : refus en lecture seule', async () => {
    vi.mocked(updateSiteInvoiceDao).mockResolvedValue(0)

    await expect(updateMemberInvoiceService(updateInput)).rejects.toThrow(
      ReadOnlyInvoiceError
    )
  })

  it('une facture introuvable (identifiant forgé, autre tenant)', async () => {
    vi.mocked(getInvoiceByIdDao).mockResolvedValue(undefined)

    expect(await updateMemberInvoiceService(updateInput)).toEqual({
      status: 'not_found',
    })
    expect(updateSiteInvoiceDao).not.toHaveBeenCalled()
  })

  it('la parcelle est vérifiée pour la fiche facturée, jamais une autre', async () => {
    ownerIs(OTHER_PROFILE_ID)

    expect(await updateMemberInvoiceService(updateInput)).toEqual({
      status: 'parcel_not_owned',
    })
    expect(updateSiteInvoiceDao).not.toHaveBeenCalled()
  })

  it('[ORGANIZATION MEMBER] un membre simple ne corrige rien', async () => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.MEMBER))

    await expect(updateMemberInvoiceService(updateInput)).rejects.toThrow(
      AuthorizationError
    )
    expect(getInvoiceByIdDao).not.toHaveBeenCalled()
  })
})

describe('listMemberInvoicesService — la carte « Factures » du bureau', () => {
  it('rend les factures de la fiche avec source, objet composé et statut brut', async () => {
    const result = await listMemberInvoicesService(ORG_ID, PROFILE_ID)

    expect(listInvoicesByProfileIdsDao).toHaveBeenCalledWith([PROFILE_ID])
    expect(result.canWrite).toBe(true)
    expect(result.invoices).toEqual([
      expect.objectContaining({
        id: INVOICE_ID,
        source: 'site',
        subject: 'Cotisation et eau 2026',
        status: 'En attente',
        statusClass: 'unpaid',
        parcelNumber: '12',
      }),
      expect.objectContaining({
        id: 'pennylane-1',
        source: 'pennylane',
        subject: 'Cotisation et eau 2025',
        status: 'Statut jamais vu',
        statusClass: 'unclassified',
      }),
    ])
  })

  it('saisie sur le site : ni Pennylane, ni date de mise à jour', async () => {
    const result = await listMemberInvoicesService(ORG_ID, PROFILE_ID)

    expect(result).toMatchObject({syncedFromPennylane: false, syncedAt: null})
    expect(getBillingSyncStateDao).not.toHaveBeenCalled()
  })

  it('sous Pennylane : lecture seule et date de la dernière mise à jour (s20, écran 2)', async () => {
    vi.mocked(resolveMemberBillingProvider).mockReturnValue({
      id: 'pennylane',
      canWrite: false,
      listInvoicesOf: vi.fn(async () => []),
    })
    vi.mocked(getBillingSyncStateDao).mockImplementation(async () => {
      expect(scope.current).toBe(ORG_ID)
      return {
        lastSuccessAt: new Date('2026-11-19T13:05:00.000Z'),
      } as never
    })

    expect(await listMemberInvoicesService(ORG_ID, PROFILE_ID)).toEqual({
      canWrite: false,
      syncedFromPennylane: true,
      syncedAt: '2026-11-19T13:05:00.000Z',
      invoices: [],
    })
    expect(getBillingSyncStateDao).toHaveBeenCalledWith(ORG_ID)
  })

  it('[ORGANIZATION MEMBER] refusé', async () => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.MEMBER))

    await expect(listMemberInvoicesService(ORG_ID, PROFILE_ID)).rejects.toThrow(
      AuthorizationError
    )
    expect(listInvoicesByProfileIdsDao).not.toHaveBeenCalled()
  })
})

describe('getMemberInvoiceService — une facture de la fiche', () => {
  it('rend la facture de cette fiche', async () => {
    expect(
      await getMemberInvoiceService(ORG_ID, PROFILE_ID, INVOICE_ID)
    ).toMatchObject({id: INVOICE_ID, source: 'site', amountCents: 41250})
  })

  it('identifiant forgé : la facture d’une autre fiche ne sort pas', async () => {
    vi.mocked(getInvoiceByIdDao).mockResolvedValue(
      invoiceRow({memberProfileId: OTHER_PROFILE_ID})
    )

    expect(
      await getMemberInvoiceService(ORG_ID, PROFILE_ID, INVOICE_ID)
    ).toBeUndefined()
  })

  it('[ORGANIZATION MEMBER] refusé', async () => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.MEMBER))

    await expect(
      getMemberInvoiceService(ORG_ID, PROFILE_ID, INVOICE_ID)
    ).rejects.toThrow(AuthorizationError)
  })
})

describe('écriture → signalement', () => {
  it('un statut classé ne déclenche aucun signalement', async () => {
    await createMemberInvoiceService(createInput)

    expect(claimStatusAlertDao).not.toHaveBeenCalled()
    expect(sendInvoiceStatusAlertEmailService).not.toHaveBeenCalled()
  })
})

describe('canManageMemberInvoicesService — la carte « Factures » est-elle rendue ?', () => {
  it.each<[string, User | undefined, boolean]>([
    [
      '[ORGANIZATION ADMIN] le bureau',
      withRole(UserOrganizationRoleConst.ADMIN),
      true,
    ],
    [
      '[ORGANIZATION OWNER] la présidente',
      withRole(UserOrganizationRoleConst.OWNER),
      true,
    ],
    ['[SUPER_ADMIN]', userTestSuperAdmin, true],
    [
      '[ORGANIZATION MEMBER] un membre simple',
      withRole(UserOrganizationRoleConst.MEMBER),
      false,
    ],
    [
      '[ORGANIZATION ADMIN] le bureau d’une autre association',
      withRole(UserOrganizationRoleConst.ADMIN, OTHER_ORG_ID),
      false,
    ],
    ['[PUBLIC]', undefined, false],
  ])('%s', async (_label, user, expected) => {
    setupAuthUserMocked(user)

    expect(await canManageMemberInvoicesService(ORG_ID)).toBe(expected)
  })

  it('un identifiant d’association invalide : non', async () => {
    expect(await canManageMemberInvoicesService('pas-un-uuid')).toBe(false)
  })
})
