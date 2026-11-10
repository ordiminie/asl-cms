import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', async () => {
  const actual =
    await vi.importActual<typeof import('next-intl/server')>('next-intl/server')

  return {...actual, setRequestLocale: vi.fn()}
})
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/campaign-dal', () => ({
  canManageCurrentCampaignsDal: vi.fn(),
  getCampaignsPageDal: vi.fn(),
}))

import {render, screen} from '@/__tests__/customRender'
import {
  canManageCurrentCampaignsDal,
  getCampaignsPageDal,
} from '@/app/dal/campaign-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  campaignListOf,
  campaignOf,
} from '@/components/features/campaigns/campaign-test-data'

import BureauCampaignsPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

const renderPage = async (searchParams: {page?: string} = {}) => {
  const element = (await BureauCampaignsPage({
    params: Promise.resolve({locale: 'fr'}),
    searchParams: Promise.resolve(searchParams),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>

  render(await type(section.props))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(getCampaignsPageDal).mockResolvedValue(
    campaignListOf([campaignOf('a')])
  )
})

describe('/bureau/campagnes — accès et archive', () => {
  it('montre l’archive au bureau, à la page demandée', async () => {
    vi.mocked(canManageCurrentCampaignsDal).mockResolvedValue(true)

    await renderPage({page: '2'})

    expect(
      screen.getByRole('heading', {level: 1, name: 'Campagnes'})
    ).toBeInTheDocument()
    expect(getCampaignsPageDal).toHaveBeenCalledWith(TENANT_ID, 2)
  })

  it('page absente ou hors forme → première page', async () => {
    vi.mocked(canManageCurrentCampaignsDal).mockResolvedValue(true)

    await renderPage({page: 'abc'})

    expect(getCampaignsPageDal).toHaveBeenCalledWith(TENANT_ID, 1)
  })

  it('refuse un membre simple sans lire l’archive', async () => {
    vi.mocked(canManageCurrentCampaignsDal).mockResolvedValue(false)

    await renderPage()

    expect(getCampaignsPageDal).not.toHaveBeenCalled()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('archive illisible → état d’erreur, sans planter la page', async () => {
    vi.mocked(canManageCurrentCampaignsDal).mockResolvedValue(true)
    vi.mocked(getCampaignsPageDal).mockRejectedValue(new Error('panne'))

    await renderPage()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La liste des campagnes n’a pas pu être chargée.'
    )
  })
})
