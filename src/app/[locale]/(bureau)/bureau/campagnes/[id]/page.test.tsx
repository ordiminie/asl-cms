import {ReactElement} from 'react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({useRouter: () => ({refresh: vi.fn()})}))
vi.mock('next-intl/server', async () => {
  const actual =
    await vi.importActual<typeof import('next-intl/server')>('next-intl/server')

  return {...actual, setRequestLocale: vi.fn()}
})
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/campaign-dal', () => ({
  canManageCurrentCampaignsDal: vi.fn(),
  getCampaignDal: vi.fn(),
}))

import {render, screen} from '@/__tests__/customRender'
import {
  canManageCurrentCampaignsDal,
  getCampaignDal,
} from '@/app/dal/campaign-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {campaignOf} from '@/components/features/campaigns/campaign-test-data'

import BureauCampaignPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const CAMPAIGN_ID = '33333333-3333-4333-8333-333333333333'

const renderPage = async (searchParams: {envoi?: string} = {}) => {
  const element = (await BureauCampaignPage({
    params: Promise.resolve({locale: 'fr', id: CAMPAIGN_ID}),
    searchParams: Promise.resolve(searchParams),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>

  render(await type(section.props))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({toFake: ['Date']})
  vi.setSystemTime(new Date('2026-11-12T14:00:00.000Z'))
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({
    id: TENANT_ID,
    name: 'ASL Les Pins',
  } as never)
  vi.mocked(canManageCurrentCampaignsDal).mockResolvedValue(true)
  vi.mocked(getCampaignDal).mockResolvedValue({
    status: 'found',
    campaign: campaignOf(CAMPAIGN_ID),
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('/bureau/campagnes/[id]', () => {
  it('montre la campagne de l’association, succès si on arrive de l’envoi', async () => {
    await renderPage({envoi: '1'})

    expect(getCampaignDal).toHaveBeenCalledWith(TENANT_ID, CAMPAIGN_ID)
    expect(screen.getByRole('status')).toHaveTextContent('Campagne envoyée')
  })

  it('statut effectif calculé avec l’heure de la page : « sending » figé depuis longtemps → interrompue', async () => {
    vi.mocked(getCampaignDal).mockResolvedValue({
      status: 'found',
      campaign: campaignOf(CAMPAIGN_ID, {
        status: 'sending',
        sentCount: 3,
        updatedAt: '2026-11-12T13:00:00.000Z',
      }),
    })

    await renderPage()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'L’envoi s’est arrêté après 3 membres sur 296.'
    )
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('« sending » récent → progression', async () => {
    vi.mocked(getCampaignDal).mockResolvedValue({
      status: 'found',
      campaign: campaignOf(CAMPAIGN_ID, {
        status: 'sending',
        sentCount: 120,
        updatedAt: '2026-11-12T13:59:00.000Z',
      }),
    })

    await renderPage()

    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('campagne introuvable (ou d’une autre association)', async () => {
    vi.mocked(getCampaignDal).mockResolvedValue({status: 'not_found'})

    await renderPage()

    expect(
      screen.getByText(
        'Cette campagne n’existe pas ou n’appartient pas à votre association.'
      )
    ).toBeInTheDocument()
  })

  it('refuse un membre simple sans lire la campagne', async () => {
    vi.mocked(canManageCurrentCampaignsDal).mockResolvedValue(false)

    await renderPage()

    expect(getCampaignDal).not.toHaveBeenCalled()
  })
})
