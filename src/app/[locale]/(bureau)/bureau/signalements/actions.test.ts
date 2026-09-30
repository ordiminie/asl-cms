import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({revalidatePath: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string) => `BureauReportsPage.errors.${key}`)
  ),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/facades/incident-report-service-facade', () => ({
  changeIncidentReportStatusService: vi.fn(),
}))

import {revalidatePath} from 'next/cache'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {changeIncidentReportStatusService} from '@/services/facades/incident-report-service-facade'

import {changeReportStatusAction} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const REPORT_ID = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(requireActionAuth).mockResolvedValue({id: 'u1'} as never)
  vi.mocked(changeIncidentReportStatusService).mockResolvedValue({
    status: 'changed',
    reportStatus: 'in_progress',
  })
})

describe('changeReportStatusAction', () => {
  it('fait avancer le statut pour l’association du domaine, puis revalide la file et le détail', async () => {
    const result = await changeReportStatusAction(REPORT_ID, 'in_progress')

    expect(result).toEqual({status: 'changed'})
    expect(changeIncidentReportStatusService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      reportId: REPORT_ID,
      to: 'in_progress',
    })
    expect(revalidatePath).toHaveBeenCalledWith(
      '/[locale]/(bureau)/bureau/signalements',
      'layout'
    )
    expect(
      vi.mocked(changeIncidentReportStatusService).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(revalidatePath).mock.invocationCallOrder[0])
  })

  it('refuse sans session, sans appeler la façade ni revalider', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    const result = await changeReportStatusAction(REPORT_ID, 'in_progress')

    expect(result).toEqual({
      status: 'error',
      message: 'BureauReportsPage.errors.forbidden',
    })
    expect(changeIncidentReportStatusService).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('refuse sans rôle au bureau, sans revalider', async () => {
    vi.mocked(changeIncidentReportStatusService).mockRejectedValue(
      new AuthorizationError()
    )

    const result = await changeReportStatusAction(REPORT_ID, 'in_progress')

    expect(result).toEqual({
      status: 'error',
      message: 'BureauReportsPage.errors.forbidden',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('dit que le signalement avait déjà changé, et recharge sur le statut réel', async () => {
    vi.mocked(changeIncidentReportStatusService).mockResolvedValue({
      status: 'stale',
    })

    const result = await changeReportStatusAction(REPORT_ID, 'in_progress')

    expect(result).toEqual({
      status: 'stale',
      message: 'BureauReportsPage.errors.stale',
    })
    expect(revalidatePath).toHaveBeenCalled()
  })

  it('rend un échec lisible sans revalider', async () => {
    vi.mocked(changeIncidentReportStatusService).mockRejectedValue(
      new Error('connexion perdue')
    )

    const result = await changeReportStatusAction(REPORT_ID, 'in_progress')

    expect(result).toEqual({
      status: 'error',
      message: 'BureauReportsPage.errors.failed',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
