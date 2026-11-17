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
  listInvoicesByProfileIdsDao: vi.fn(),
}))

import {listInvoicesByProfileIdsDao} from '@/db/repositories/member-invoice-repository'

import {manualMemberBillingProvider} from '../billing/manual-member-billing-provider'
import {resolveMemberBillingProvider} from '../billing/resolve-member-billing-provider'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  BILLING_PROVIDER_SETTING_KEY,
  resolveSettings,
} from '../types/domain/association-settings-types'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const PARCEL_ID = '55555555-5555-4555-8555-555555555555'

const row = {
  id: '22222222-2222-4222-8222-222222222222',
  organizationId: ORG_ID,
  memberProfileId: PROFILE_ID,
  parcelId: PARCEL_ID,
  parcelNumber: '12',
  meterNumber: '0045821',
  source: 'site' as const,
  externalId: null,
  year: 2026,
  issuedOn: '2026-03-15',
  dueOn: '2026-04-15',
  amountCents: 41250,
  status: 'En attente',
  createdAt: new Date('2026-03-15T10:00:00Z'),
  updatedAt: new Date('2026-03-15T10:00:00Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listInvoicesByProfileIdsDao).mockImplementation(async () => {
    expect(scope.current).toBe(ORG_ID)
    return [row]
  })
})

describe('manualMemberBillingProvider — saisie par le bureau (ADR 059 §7)', () => {
  it('permet l’écriture', () => {
    expect(manualMemberBillingProvider.canWrite).toBe(true)
  })

  it('lit les factures des fiches demandées, sous le scope du tenant, sans champ de paiement', async () => {
    const invoices = await manualMemberBillingProvider.listInvoicesOf(ORG_ID, [
      PROFILE_ID,
    ])

    expect(listInvoicesByProfileIdsDao).toHaveBeenCalledWith([PROFILE_ID])
    expect(invoices).toEqual([
      {
        id: row.id,
        memberProfileId: PROFILE_ID,
        parcelId: PARCEL_ID,
        parcelNumber: '12',
        meterNumber: '0045821',
        source: 'site',
        year: 2026,
        issuedOn: '2026-03-15',
        dueOn: '2026-04-15',
        amountCents: 41250,
        status: 'En attente',
      },
    ])
  })
})

describe('resolveMemberBillingProvider — choisi par le réglage du tenant', () => {
  it('« manuel » par défaut', () => {
    expect(
      resolveMemberBillingProvider(
        resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
      )
    ).toBe(manualMemberBillingProvider)
  })

  it('défaut fermé : une valeur inconnue est une erreur explicite, jamais un repli', () => {
    const settings = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
    expect(() =>
      resolveMemberBillingProvider({
        ...settings,
        [BILLING_PROVIDER_SETTING_KEY]: {
          value: 'pennylane',
          storedValue: 'pennylane',
          defaultFromKey: null,
        },
      })
    ).toThrow(/pennylane/)
  })
})
