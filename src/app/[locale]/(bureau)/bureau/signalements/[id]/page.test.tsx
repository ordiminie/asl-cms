import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', async () => {
  const actual =
    await vi.importActual<typeof import('next-intl/server')>('next-intl/server')

  return {...actual, setRequestLocale: vi.fn()}
})
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/incident-report-dal', () => ({
  canManageCurrentReportsDal: vi.fn(),
  getIncidentReportForBureauDal: vi.fn(),
}))
vi.mock('../actions', () => ({changeReportStatusAction: vi.fn()}))

import {render, screen} from '@/__tests__/customRender'
import {
  canManageCurrentReportsDal,
  getIncidentReportForBureauDal,
} from '@/app/dal/incident-report-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import BureauReportPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const REPORT_ID = '33333333-3333-4333-8333-333333333333'

const renderPage = async () => {
  const element = (await BureauReportPage({
    params: Promise.resolve({locale: 'fr', id: REPORT_ID}),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>

  render(await type(section.props))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
})

describe('/bureau/signalements/[id] — accès par rôle', () => {
  it('montre le signalement au bureau', async () => {
    vi.mocked(canManageCurrentReportsDal).mockResolvedValue(true)
    vi.mocked(getIncidentReportForBureauDal).mockResolvedValue({
      id: REPORT_ID,
      organizationId: TENANT_ID,
      categoryName: "Fuite d'eau",
      categoryDeleted: false,
      location: 'Chemin des Pins',
      description: 'Ça coule.',
      reporterName: null,
      reporterEmail: null,
      reporterPhone: null,
      status: 'reported',
      notificationFailed: false,
      createdAt: new Date('2026-09-29T05:42:00Z'),
      events: [],
    })

    await renderPage()

    expect(
      screen.getByRole('heading', {level: 1, name: "Fuite d'eau"})
    ).toBeInTheDocument()
    expect(getIncidentReportForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      REPORT_ID
    )
  })

  it('refuse un membre simple, sans lire le signalement', async () => {
    vi.mocked(canManageCurrentReportsDal).mockResolvedValue(false)

    await renderPage()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: "Cette page est réservée au bureau de l'association",
      })
    ).toBeInTheDocument()
    expect(getIncidentReportForBureauDal).not.toHaveBeenCalled()
  })

  it('rend introuvable un signalement absent', async () => {
    vi.mocked(canManageCurrentReportsDal).mockResolvedValue(true)
    vi.mocked(getIncidentReportForBureauDal).mockResolvedValue(undefined)

    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
