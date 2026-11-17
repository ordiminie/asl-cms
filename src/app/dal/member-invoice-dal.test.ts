import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(),
}))
vi.mock('@/services/facades/member-invoice-service-facade', () => ({
  canManageMemberInvoicesService: vi.fn(),
  listMemberInvoicesService: vi.fn(),
  getMemberInvoiceService: vi.fn(),
}))

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  canManageMemberInvoicesService,
  getMemberInvoiceService,
  listMemberInvoicesService,
} from '@/services/facades/member-invoice-service-facade'

import {
  canManageCurrentMemberInvoicesDal,
  getMemberInvoiceForBureauDal,
  getMemberInvoicesForBureauDal,
} from './member-invoice-dal'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const INVOICE_ID = '66666666-6666-4666-8666-666666666666'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: ORG_A} as never)
  vi.mocked(canManageMemberInvoicesService).mockResolvedValue(true)
})

describe('member-invoice-dal — factures d’une fiche, pour le bureau (s19)', () => {
  it('dit si le compte gère les factures de l’association du domaine', async () => {
    await expect(canManageCurrentMemberInvoicesDal()).resolves.toBe(true)
    expect(canManageMemberInvoicesService).toHaveBeenCalledWith(ORG_A)
  })

  it('lit les factures d’une fiche quand le compte les gère', async () => {
    const invoices = {canWrite: true, invoices: []}
    vi.mocked(listMemberInvoicesService).mockResolvedValue(invoices)

    await expect(
      getMemberInvoicesForBureauDal(ORG_A, PROFILE_ID)
    ).resolves.toBe(invoices)
    expect(listMemberInvoicesService).toHaveBeenCalledWith(ORG_A, PROFILE_ID)
  })

  it('rien, sans lecture, pour un compte qui ne les gère pas : la carte n’est pas rendue', async () => {
    vi.mocked(canManageMemberInvoicesService).mockResolvedValue(false)

    await expect(
      getMemberInvoicesForBureauDal(ORG_A, PROFILE_ID)
    ).resolves.toBeUndefined()
    expect(listMemberInvoicesService).not.toHaveBeenCalled()
  })

  it('lit une facture de la fiche', async () => {
    vi.mocked(getMemberInvoiceService).mockResolvedValue(undefined)

    await expect(
      getMemberInvoiceForBureauDal(ORG_A, PROFILE_ID, INVOICE_ID)
    ).resolves.toBeUndefined()
    expect(getMemberInvoiceService).toHaveBeenCalledWith(
      ORG_A,
      PROFILE_ID,
      INVOICE_ID
    )
  })
})
