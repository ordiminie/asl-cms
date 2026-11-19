import {beforeEach, describe, expect, it, vi} from 'vitest'

const scope = vi.hoisted(() => ({current: undefined as string | undefined}))

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (organizationId: string, callback: () => unknown) => {
    scope.current = organizationId
    try {
      return await callback()
    } finally {
      scope.current = undefined
    }
  }),
}))
vi.mock('@/db/repositories/member-invoice-repository', () => ({
  upsertPennylaneInvoicesDao: vi.fn(async () => {
    expect(scope.current).toBe(ORG_ID)
  }),
  deletePennylaneInvoicesNotInDao: vi.fn(async () => {
    expect(scope.current).toBe(ORG_ID)
  }),
}))
vi.mock('@/db/repositories/billing-sync-state-repository', () => ({
  getBillingSyncStateDao: vi.fn(),
  recordBillingSyncFailureDao: vi.fn(async () => {
    expect(scope.current).toBe(ORG_ID)
  }),
  recordBillingSyncSuccessDao: vi.fn(async () => {
    expect(scope.current).toBe(ORG_ID)
  }),
}))
vi.mock('@/db/repositories/member-profile-repository', () => ({
  listPennylaneLinkedProfilesDao: vi.fn(),
  listProfilesWithoutPennylaneIdDao: vi.fn(async () => []),
}))
vi.mock('@/db/repositories/parcel-ownership-repository', () => ({
  listOwnershipPeriodsByProfilesDao: vi.fn(async () => []),
}))
vi.mock('@/lib/pennylane/pennylane-client.server', () => ({
  getPennylaneClient: vi.fn(),
}))
vi.mock('../association-settings-service', () => ({
  getAssociationSettingsService: vi.fn(),
}))
vi.mock('@/db/repositories/scheduled-job-repository', () => ({
  enqueueScheduledJobTxnDao: vi.fn(async () => {
    expect(scope.current).toBe(ORG_ID)
    return {id: 'job'}
  }),
}))
vi.mock('../member-invoice-service', () => ({
  signalUnknownInvoiceStatuses: vi.fn(async () => {}),
}))

import {
  getBillingSyncStateDao,
  recordBillingSyncFailureDao,
  recordBillingSyncSuccessDao,
} from '@/db/repositories/billing-sync-state-repository'
import {
  deletePennylaneInvoicesNotInDao,
  upsertPennylaneInvoicesDao,
} from '@/db/repositories/member-invoice-repository'
import {
  listPennylaneLinkedProfilesDao,
  listProfilesWithoutPennylaneIdDao,
} from '@/db/repositories/member-profile-repository'
import {listOwnershipPeriodsByProfilesDao} from '@/db/repositories/parcel-ownership-repository'
import {enqueueScheduledJobTxnDao} from '@/db/repositories/scheduled-job-repository'
import {
  type PennylaneClient,
  PennylaneError,
} from '@/lib/pennylane/pennylane-client'
import {getPennylaneClient} from '@/lib/pennylane/pennylane-client.server'
import type {
  PennylaneCustomer,
  PennylaneInvoice,
} from '@/lib/pennylane/pennylane-schemas'

import {getAssociationSettingsService} from '../association-settings-service'
import {AuthorizationError} from '../errors/authorization-error'
import {signalUnknownInvoiceStatuses} from '../member-invoice-service'
import {
  getBillingSyncOverviewService,
  pennylaneSyncScheduledJobHandlers,
  requestPennylaneSyncService,
  schedulePennylaneSyncService,
  syncPennylaneInvoicesService,
} from '../pennylane-sync-service'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  BILLING_PROVIDER_SETTING_KEY,
  resolveSettings,
} from '../types/domain/association-settings-types'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import type {OrganizationRole} from '../types/domain/organization-types'
import type {ScheduledJob} from '../types/domain/scheduled-job-types'
import type {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const EXTERNAL_REF = '3f2a9c1e-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const NOW = new Date('2026-11-19T13:07:00.000Z')

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

const customer: PennylaneCustomer = {
  id: '4211',
  externalReference: EXTERNAL_REF,
  name: 'LEFEVRE Bernard',
  reference: 'AH 6 - 0045821',
}

const invoice = (
  overrides: Partial<PennylaneInvoice> = {}
): PennylaneInvoice => ({
  id: '9001',
  invoiceNumber: 'F-2026-0412',
  status: 'late',
  draft: false,
  date: '2026-03-15',
  deadline: '2026-04-15',
  amount: '412.50',
  currency: 'EUR',
  customerId: '4211',
  hasPdf: true,
  freeText: null,
  ...overrides,
})

const settingsWith = (provider: string) =>
  resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
    {key: BILLING_PROVIDER_SETTING_KEY, value: provider},
  ])

const clientReturning = (
  customers: PennylaneCustomer[],
  invoices: PennylaneInvoice[]
): PennylaneClient => ({
  listCustomers: vi.fn(async () => customers),
  listCustomerInvoices: vi.fn(async () => invoices),
  getCustomerInvoiceFileUrl: vi.fn(),
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAssociationSettingsService).mockResolvedValue(
    settingsWith('pennylane')
  )
  vi.mocked(listPennylaneLinkedProfilesDao).mockResolvedValue([
    {
      id: PROFILE_ID,
      name: 'Bernard Lefèvre',
      pennylaneCustomerId: EXTERNAL_REF,
    },
  ])
  vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([])
  vi.mocked(getPennylaneClient).mockReturnValue(
    clientReturning([customer], [invoice()])
  )
})

describe('syncPennylaneInvoicesService — relecture complète (s20, ADR 062 §1)', () => {
  it('écrit les factures rapprochées, sous le scope du tenant', async () => {
    const result = await syncPennylaneInvoicesService(ORG_ID, NOW)

    expect(result).toEqual({
      status: 'synced',
      counts: {
        written: 1,
        draft: 0,
        creditNote: 0,
        noCustomer: 0,
        noDate: 0,
        notEur: 0,
        nonPositive: 0,
        unmatched: 0,
      },
    })
    expect(upsertPennylaneInvoicesDao).toHaveBeenCalledWith(ORG_ID, [
      {
        externalId: '9001',
        memberProfileId: PROFILE_ID,
        year: 2026,
        issuedOn: '2026-03-15',
        dueOn: '2026-04-15',
        amountCents: 41250,
        status: 'late',
        hasPdf: true,
      },
    ])
  })

  it('n’écrit ni le texte libre, ni la ligne de terrain, ni le numéro de facture', async () => {
    vi.mocked(getPennylaneClient).mockReturnValue(
      clientReturning(
        [customer],
        [invoice({freeText: 'Numero parcelle : AH 6 - Compteur : 0045821'})]
      )
    )

    await syncPennylaneInvoicesService(ORG_ID, NOW)

    const [[, written]] = vi.mocked(upsertPennylaneInvoicesDao).mock.calls
    expect(JSON.stringify(written)).not.toMatch(/parcelle|F-2026|terrain/i)
  })

  it('supprime les factures Pennylane absentes de la relecture', async () => {
    await syncPennylaneInvoicesService(ORG_ID, NOW)

    expect(deletePennylaneInvoicesNotInDao).toHaveBeenCalledWith(ORG_ID, [
      '9001',
    ])
  })

  it('une relecture vide supprime toutes les factures Pennylane', async () => {
    vi.mocked(getPennylaneClient).mockReturnValue(clientReturning([], []))

    await syncPennylaneInvoicesService(ORG_ID, NOW)

    expect(upsertPennylaneInvoicesDao).toHaveBeenCalledWith(ORG_ID, [])
    expect(deletePennylaneInvoicesNotInDao).toHaveBeenCalledWith(ORG_ID, [])
  })

  it('passe les statuts écrits par le signalement des statuts inconnus (ADR 059 §5)', async () => {
    vi.mocked(getPennylaneClient).mockReturnValue(
      clientReturning(
        [customer],
        [
          invoice(),
          invoice({id: '9002', status: 'paid'}),
          invoice({id: '9003', draft: true, status: 'archived'}),
        ]
      )
    )

    await syncPennylaneInvoicesService(ORG_ID, NOW)

    expect(signalUnknownInvoiceStatuses).toHaveBeenCalledWith(ORG_ID, [
      'late',
      'paid',
    ])
  })

  it('note le succès : comptes, clients sans fiche, écarts de terrain', async () => {
    vi.mocked(getPennylaneClient).mockReturnValue(
      clientReturning(
        [
          customer,
          {
            id: '5000',
            externalReference: 'inconnue',
            name: 'MARTIN Paul',
            reference: 'AH 9 - 1',
          },
        ],
        [
          invoice({freeText: 'Numero parcelle : AH 7 - Compteur : 0045821'}),
          invoice({id: '9002', customerId: '5000'}),
          invoice({id: '9003', draft: true}),
        ]
      )
    )
    vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([
      {
        memberProfileId: PROFILE_ID,
        number: 'AH 6',
        meterNumber: '0045821',
        startsOn: '2020-01-01',
        endsOn: null,
      },
    ])

    await syncPennylaneInvoicesService(ORG_ID, NOW)

    expect(listOwnershipPeriodsByProfilesDao).toHaveBeenCalledWith([PROFILE_ID])
    expect(recordBillingSyncSuccessDao).toHaveBeenCalledWith(ORG_ID, {
      now: NOW,
      counts: expect.objectContaining({written: 1, unmatched: 1, draft: 1}),
      unmatchedCustomers: [
        {id: '5000', name: 'MARTIN Paul', reference: 'AH 9 - 1'},
      ],
      terrainMismatches: [
        {
          invoiceNumber: 'F-2026-0412',
          memberProfileId: PROFILE_ID,
          memberProfileName: 'Bernard Lefèvre',
          parcels: ['AH 7'],
          meter: '0045821',
        },
      ],
    })
  })

  it('une ligne de terrain conforme à la fiche à la date d’émission : aucun écart', async () => {
    vi.mocked(getPennylaneClient).mockReturnValue(
      clientReturning(
        [customer],
        [invoice({freeText: 'Numero parcelle : AH 6-7 - Compteur : 0045821'})]
      )
    )
    vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([
      {
        memberProfileId: PROFILE_ID,
        number: 'AH 6',
        meterNumber: '0045821',
        startsOn: '2020-01-01',
        endsOn: null,
      },
      {
        memberProfileId: PROFILE_ID,
        number: 'AH 7',
        meterNumber: '0045821',
        startsOn: '2020-01-01',
        endsOn: null,
      },
      {
        memberProfileId: PROFILE_ID,
        number: 'AH 8',
        meterNumber: '0099',
        startsOn: '2026-06-01',
        endsOn: null,
      },
    ])

    await syncPennylaneInvoicesService(ORG_ID, NOW)

    expect(
      vi.mocked(recordBillingSyncSuccessDao).mock.calls[0][1].terrainMismatches
    ).toEqual([])
  })
})

describe('syncPennylaneInvoicesService — échec sans écriture (ADR 062 §3, critère 9)', () => {
  it.each(['unavailable', 'unauthorized', 'rate_limited'] as const)(
    'relecture interrompue (%s) : aucune facture écrite ni supprimée, échec noté',
    async (code) => {
      const client = clientReturning([customer], [])
      vi.mocked(client.listCustomerInvoices).mockRejectedValue(
        new PennylaneError(code)
      )
      vi.mocked(getPennylaneClient).mockReturnValue(client)

      const result = await syncPennylaneInvoicesService(ORG_ID, NOW)

      expect(result).toEqual({status: 'failed', error: code})
      expect(upsertPennylaneInvoicesDao).not.toHaveBeenCalled()
      expect(deletePennylaneInvoicesNotInDao).not.toHaveBeenCalled()
      expect(recordBillingSyncSuccessDao).not.toHaveBeenCalled()
      expect(signalUnknownInvoiceStatuses).not.toHaveBeenCalled()
      expect(recordBillingSyncFailureDao).toHaveBeenCalledWith(
        ORG_ID,
        NOW,
        code
      )
    }
  )

  it('clé absente : échec `missing_key`, les factures déjà écrites restent', async () => {
    const client = clientReturning([], [])
    vi.mocked(client.listCustomers).mockRejectedValue(
      new PennylaneError('missing_key')
    )
    vi.mocked(getPennylaneClient).mockReturnValue(client)

    expect(await syncPennylaneInvoicesService(ORG_ID, NOW)).toEqual({
      status: 'failed',
      error: 'missing_key',
    })
    expect(deletePennylaneInvoicesNotInDao).not.toHaveBeenCalled()
    expect(recordBillingSyncFailureDao).toHaveBeenCalledWith(
      ORG_ID,
      NOW,
      'missing_key'
    )
  })

  it('une autre erreur n’est pas maquillée : elle remonte, rien n’est écrit', async () => {
    const client = clientReturning([], [])
    vi.mocked(client.listCustomers).mockRejectedValue(new Error('bug'))
    vi.mocked(getPennylaneClient).mockReturnValue(client)

    await expect(syncPennylaneInvoicesService(ORG_ID, NOW)).rejects.toThrow(
      'bug'
    )
    expect(upsertPennylaneInvoicesDao).not.toHaveBeenCalled()
  })
})

describe('syncPennylaneInvoicesService — fournisseur et entrée', () => {
  it('fournisseur `manual` : rien n’est lu ni écrit', async () => {
    vi.mocked(getAssociationSettingsService).mockResolvedValue(
      settingsWith('manual')
    )

    expect(await syncPennylaneInvoicesService(ORG_ID, NOW)).toEqual({
      status: 'skipped',
    })
    expect(getPennylaneClient).not.toHaveBeenCalled()
    expect(upsertPennylaneInvoicesDao).not.toHaveBeenCalled()
    expect(recordBillingSyncFailureDao).not.toHaveBeenCalled()
  })

  it('refuse un identifiant d’association invalide', async () => {
    await expect(
      syncPennylaneInvoicesService('pas-un-uuid', NOW)
    ).rejects.toThrow()
    expect(getPennylaneClient).not.toHaveBeenCalled()
  })
})

describe('tâche `billing.sync_pennylane` (ADR 062 §8, ADR 006)', () => {
  const handler = pennylaneSyncScheduledJobHandlers['billing.sync_pennylane']
  const job: ScheduledJob = {
    id: 'job-1',
    organizationId: ORG_ID,
    kind: 'billing.sync_pennylane',
    payload: {hour: '2026-11-19T13:00:00.000Z'},
    attempts: 1,
    resumedAfterStaleLock: false,
  }

  it('est branchée au planificateur sous son type', () => {
    expect(Object.keys(pennylaneSyncScheduledJobHandlers)).toEqual([
      'billing.sync_pennylane',
    ])
  })

  it('synchronise, puis programme l’heure suivante, clé = l’heure visée', async () => {
    expect(await handler(job, NOW)).toEqual({status: 'completed'})

    expect(upsertPennylaneInvoicesDao).toHaveBeenCalled()
    expect(enqueueScheduledJobTxnDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      kind: 'billing.sync_pennylane',
      idempotencyKey: '2026-11-19T14:00:00.000Z',
      runAfter: new Date('2026-11-19T14:00:00.000Z'),
      payload: {hour: '2026-11-19T14:00:00.000Z'},
    })
  })

  it('un échec de Pennylane ne casse pas la chaîne : nouvel essai dans l’heure', async () => {
    const client = clientReturning([], [])
    vi.mocked(client.listCustomers).mockRejectedValue(
      new PennylaneError('unavailable')
    )
    vi.mocked(getPennylaneClient).mockReturnValue(client)

    expect(await handler(job, NOW)).toEqual({status: 'completed'})
    expect(enqueueScheduledJobTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({idempotencyKey: '2026-11-19T14:00:00.000Z'})
    )
  })

  it('sous `manual`, se termine sans rien faire ni se reprogrammer', async () => {
    vi.mocked(getAssociationSettingsService).mockResolvedValue(
      settingsWith('manual')
    )

    expect(await handler(job, NOW)).toEqual({status: 'completed'})
    expect(getPennylaneClient).not.toHaveBeenCalled()
    expect(enqueueScheduledJobTxnDao).not.toHaveBeenCalled()
  })
})

describe('schedulePennylaneSyncService — la tâche existe dès le passage à Pennylane', () => {
  it('[ORGANIZATION OWNER] programme la prochaine heure, sans doublon (clé = l’heure visée)', async () => {
    await setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))

    await schedulePennylaneSyncService(ORG_ID, NOW)

    expect(enqueueScheduledJobTxnDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      kind: 'billing.sync_pennylane',
      idempotencyKey: '2026-11-19T14:00:00.000Z',
      runAfter: new Date('2026-11-19T14:00:00.000Z'),
      payload: {hour: '2026-11-19T14:00:00.000Z'},
    })
  })

  it('[SUPER_ADMIN] le SuperAdmin peut la programmer', async () => {
    await setupAuthUserMocked(userTestSuperAdmin)

    await schedulePennylaneSyncService(ORG_ID, NOW)

    expect(enqueueScheduledJobTxnDao).toHaveBeenCalledOnce()
  })

  it('fournisseur `manual` : aucune tâche', async () => {
    await setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))
    vi.mocked(getAssociationSettingsService).mockResolvedValue(
      settingsWith('manual')
    )

    await schedulePennylaneSyncService(ORG_ID, NOW)

    expect(enqueueScheduledJobTxnDao).not.toHaveBeenCalled()
  })

  it('[USER NOT IN ORGANIZATION] refusé, rien n’est programmé', async () => {
    await setupAuthUserMocked(
      withRole(UserOrganizationRoleConst.OWNER, OTHER_ORG_ID)
    )

    await expect(schedulePennylaneSyncService(ORG_ID, NOW)).rejects.toThrow(
      AuthorizationError
    )
    expect(enqueueScheduledJobTxnDao).not.toHaveBeenCalled()
  })
})

describe('requestPennylaneSyncService — « Mettre à jour maintenant » (member.invoice.manage)', () => {
  it('[ORGANIZATION OWNER] synchronise tout de suite et garantit la tâche', async () => {
    await setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))

    const result = await requestPennylaneSyncService(ORG_ID, NOW)

    expect(result.status).toBe('synced')
    expect(upsertPennylaneInvoicesDao).toHaveBeenCalled()
    expect(enqueueScheduledJobTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({idempotencyKey: '2026-11-19T14:00:00.000Z'})
    )
  })

  it('[ORGANIZATION MEMBER] un membre simple est refusé', async () => {
    await setupAuthUserMocked(withRole(UserOrganizationRoleConst.MEMBER))

    await expect(requestPennylaneSyncService(ORG_ID, NOW)).rejects.toThrow(
      AuthorizationError
    )
    expect(getPennylaneClient).not.toHaveBeenCalled()
  })

  it('[USER NOT IN ORGANIZATION] le bureau d’une autre association est refusé', async () => {
    await setupAuthUserMocked(
      withRole(UserOrganizationRoleConst.OWNER, OTHER_ORG_ID)
    )

    await expect(requestPennylaneSyncService(ORG_ID, NOW)).rejects.toThrow(
      AuthorizationError
    )
    expect(getPennylaneClient).not.toHaveBeenCalled()
    expect(upsertPennylaneInvoicesDao).not.toHaveBeenCalled()
  })

  it('[PUBLIC] sans session : refusé', async () => {
    await setupAuthUserMocked(undefined)

    await expect(requestPennylaneSyncService(ORG_ID, NOW)).rejects.toThrow(
      AuthorizationError
    )
  })
})

describe('getBillingSyncOverviewService — la carte « Synchronisation Pennylane » (critère 3)', () => {
  beforeEach(() => {
    vi.mocked(getBillingSyncStateDao).mockImplementation(async () => {
      expect(scope.current).toBe(ORG_ID)
      return {
        organizationId: ORG_ID,
        lastAttemptAt: new Date('2026-11-19T14:00:00.000Z'),
        lastSuccessAt: new Date('2026-11-19T13:05:00.000Z'),
        lastError: 'unavailable',
        counts: {written: 412, draft: 3, creditNote: 1, unmatched: 2},
        unmatchedCustomers: [
          {id: '5000', name: 'MARTIN Paul', reference: 'AH 9 - 1'},
        ],
        terrainMismatches: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    })
    vi.mocked(listProfilesWithoutPennylaneIdDao).mockImplementation(
      async () => {
        expect(scope.current).toBe(ORG_ID)
        return [{id: PROFILE_ID, name: 'Hélène Roy'}]
      }
    )
  })

  it('[ORGANIZATION OWNER] l’état, les comptes complétés, les fiches sans identifiant', async () => {
    await setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))

    expect(await getBillingSyncOverviewService(ORG_ID)).toEqual({
      lastAttemptAt: '2026-11-19T14:00:00.000Z',
      syncedAt: '2026-11-19T13:05:00.000Z',
      lastError: 'unavailable',
      counts: {
        written: 412,
        draft: 3,
        creditNote: 1,
        noCustomer: 0,
        noDate: 0,
        notEur: 0,
        nonPositive: 0,
        unmatched: 2,
      },
      unmatchedCustomers: [
        {id: '5000', name: 'MARTIN Paul', reference: 'AH 9 - 1'},
      ],
      terrainMismatches: [],
      profilesWithoutId: [{id: PROFILE_ID, name: 'Hélène Roy'}],
    })
    expect(listProfilesWithoutPennylaneIdDao).toHaveBeenCalledWith(ORG_ID)
  })

  it('jamais synchronisé : aucun instant, aucun compte', async () => {
    await setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))
    vi.mocked(getBillingSyncStateDao).mockResolvedValue(undefined)

    expect(await getBillingSyncOverviewService(ORG_ID)).toMatchObject({
      lastAttemptAt: null,
      syncedAt: null,
      lastError: null,
      counts: null,
      unmatchedCustomers: [],
    })
  })

  it('fournisseur `manual` : pas de carte', async () => {
    await setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))
    vi.mocked(getAssociationSettingsService).mockResolvedValue(
      settingsWith('manual')
    )

    expect(await getBillingSyncOverviewService(ORG_ID)).toBeUndefined()
    expect(getBillingSyncStateDao).not.toHaveBeenCalled()
  })

  it('[USER NOT IN ORGANIZATION] le bureau d’une autre association est refusé', async () => {
    await setupAuthUserMocked(
      withRole(UserOrganizationRoleConst.OWNER, OTHER_ORG_ID)
    )

    await expect(getBillingSyncOverviewService(ORG_ID)).rejects.toThrow(
      AuthorizationError
    )
    expect(getBillingSyncStateDao).not.toHaveBeenCalled()
  })
})
