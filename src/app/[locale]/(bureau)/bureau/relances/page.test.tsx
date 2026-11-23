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
}))
vi.mock('@/app/dal/unpaid-reminder-dal', () => ({
  getUnpaidRemindersOverviewDal: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: {debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn()},
}))

import {render, screen} from '@/__tests__/customRender'
import {canManageCurrentCampaignsDal} from '@/app/dal/campaign-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {getUnpaidRemindersOverviewDal} from '@/app/dal/unpaid-reminder-dal'

import BureauUnpaidRemindersPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

const renderPage = async (searchParams: {page?: string} = {}) => {
  const element = (await BureauUnpaidRemindersPage({
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
  vi.mocked(getUnpaidRemindersOverviewDal).mockResolvedValue({
    status: 'ready',
    enabled: true,
    delaysWeeks: [3, 2, 1],
    rankCount: 3,
    schedules: [],
    members: {items: [], page: 1, pageSize: 25, total: 0, totalPages: 1},
    counts: {unpaid: 0, byEmail: 0, byLetter: 0},
  })
})

describe('/bureau/relances — accès et lecture (s29, écran 1)', () => {
  it('montre le suivi de l’association du domaine au bureau, à la page demandée', async () => {
    vi.mocked(canManageCurrentCampaignsDal).mockResolvedValue(true)

    await renderPage({page: '2'})

    expect(
      screen.getByRole('heading', {level: 1, name: 'Relances des impayés'})
    ).toBeInTheDocument()
    expect(getUnpaidRemindersOverviewDal).toHaveBeenCalledWith(TENANT_ID, 2)
  })

  it('hors bureau : accès refusé, rien n’est lu', async () => {
    vi.mocked(canManageCurrentCampaignsDal).mockResolvedValue(false)

    await renderPage()

    expect(getUnpaidRemindersOverviewDal).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('heading', {level: 1, name: 'Relances des impayés'})
    ).toBeNull()
  })

  it('une page invalide se lit comme la première', async () => {
    vi.mocked(canManageCurrentCampaignsDal).mockResolvedValue(true)

    await renderPage({page: 'abc'})

    expect(getUnpaidRemindersOverviewDal).toHaveBeenCalledWith(TENANT_ID, 1)
  })

  it('une lecture en échec rend l’erreur, jamais une page blanche', async () => {
    vi.mocked(canManageCurrentCampaignsDal).mockResolvedValue(true)
    vi.mocked(getUnpaidRemindersOverviewDal).mockRejectedValue(
      new Error('panne')
    )

    await renderPage()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La page des relances n’a pas pu être lue.'
    )
  })
})
