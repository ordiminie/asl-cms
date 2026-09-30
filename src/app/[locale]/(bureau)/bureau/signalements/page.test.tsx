import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', async () => {
  const actual =
    await vi.importActual<typeof import('next-intl/server')>('next-intl/server')

  return {...actual, setRequestLocale: vi.fn()}
})
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/incident-report-dal', () => ({
  canManageCurrentReportsDal: vi.fn(),
  getIncidentReportsForBureauDal: vi.fn(),
}))

import {render, screen} from '@/__tests__/customRender'
import {
  canManageCurrentReportsDal,
  getIncidentReportsForBureauDal,
} from '@/app/dal/incident-report-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import BureauReportsPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

/** Le composant de page est asynchrone : on resout son arbre avant de rendre. */
const renderPage = async (page?: string) => {
  const element = (await BureauReportsPage({
    params: Promise.resolve({locale: 'fr'}),
    searchParams: Promise.resolve(page ? {page} : {}),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>

  render(await type(section.props))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(getIncidentReportsForBureauDal).mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
    counts: {reported: 0, in_progress: 0, resolved: 0},
  })
})

describe('/bureau/signalements — accès par rôle', () => {
  it('montre la file au bureau, à la page demandée', async () => {
    vi.mocked(canManageCurrentReportsDal).mockResolvedValue(true)

    await renderPage('2')

    expect(
      screen.getByRole('heading', {level: 1, name: 'Signalements'})
    ).toBeInTheDocument()
    expect(getIncidentReportsForBureauDal).toHaveBeenCalledWith(TENANT_ID, 2)
  })

  it('refuse un membre simple, sans lire la file', async () => {
    vi.mocked(canManageCurrentReportsDal).mockResolvedValue(false)

    await renderPage()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: "Cette page est réservée au bureau de l'association",
      })
    ).toBeInTheDocument()
    expect(getIncidentReportsForBureauDal).not.toHaveBeenCalled()
  })

  it('charge avec l’en-tête du tableau en place', async () => {
    const element = (await BureauReportsPage({
      params: Promise.resolve({locale: 'fr'}),
      searchParams: Promise.resolve({}),
    })) as ReactElement<{fallback: ReactElement}>

    render(element.props.fallback)

    expect(
      screen.getByRole('columnheader', {name: 'Catégorie'})
    ).toBeInTheDocument()
  })
})
