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
}))
vi.mock('@/app/dal/association-category-dal', () => ({
  getReportCategoriesForBureauDal: vi.fn(),
}))
vi.mock('./actions', () => ({
  createReportCategoryAction: vi.fn(),
  deleteReportCategoryAction: vi.fn(),
  updateReportCategoryAction: vi.fn(),
}))

import {render, screen} from '@/__tests__/customRender'
import {getReportCategoriesForBureauDal} from '@/app/dal/association-category-dal'
import {canManageCurrentReportsDal} from '@/app/dal/incident-report-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import BureauReportCategoriesPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

const renderPage = async () => {
  const element = (await BureauReportCategoriesPage({
    params: Promise.resolve({locale: 'fr'}),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>

  render(await type(section.props))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(getReportCategoriesForBureauDal).mockResolvedValue({
    items: [],
    max: 10,
  })
})

describe('/bureau/signalements/categories — accès par rôle', () => {
  it('montre les catégories au bureau', async () => {
    vi.mocked(canManageCurrentReportsDal).mockResolvedValue(true)

    await renderPage()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Catégories de signalement'})
    ).toBeInTheDocument()
    expect(getReportCategoriesForBureauDal).toHaveBeenCalledWith(TENANT_ID)
  })

  it('refuse un membre simple, sans lire les catégories', async () => {
    vi.mocked(canManageCurrentReportsDal).mockResolvedValue(false)

    await renderPage()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: "Cette page est réservée au bureau de l'association",
      })
    ).toBeInTheDocument()
    expect(getReportCategoriesForBureauDal).not.toHaveBeenCalled()
  })
})
