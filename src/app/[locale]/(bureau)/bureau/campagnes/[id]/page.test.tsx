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
vi.mock('@/app/dal/association-settings-dal', () => ({
  getAssociationSettingsDal: vi.fn(),
}))
vi.mock('@/app/dal/campaign-dal', () => ({
  canManageCurrentCampaignsDal: vi.fn(),
  getCampaignDal: vi.fn(),
  getCampaignRecipientsDal: vi.fn(),
}))

import {render, screen} from '@/__tests__/customRender'
import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {
  canManageCurrentCampaignsDal,
  getCampaignDal,
  getCampaignRecipientsDal,
} from '@/app/dal/campaign-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  campaignOf,
  recipientOf,
} from '@/components/features/campaigns/campaign-test-data'

import BureauCampaignPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const CAMPAIGN_ID = '33333333-3333-4333-8333-333333333333'

const renderPage = async (
  searchParams: {envoi?: string; statut?: string; page?: string} = {}
) => {
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
  vi.mocked(getAssociationSettingsDal).mockResolvedValue({
    'campaign.daily_send_cap': {
      value: 150,
      storedValue: '150',
      defaultFromKey: null,
    },
  })
  vi.mocked(getCampaignRecipientsDal).mockResolvedValue({
    status: 'found',
    recipients: {
      items: [recipientOf('r1', {name: 'Anne Arnaud'})],
      filter: 'all',
      page: 1,
      pageSize: 25,
      total: 0,
      totalPages: 1,
    },
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('/bureau/campagnes/[id]', () => {
  it('montre la campagne de l’association, « Campagne lancée » si on arrive de l’envoi', async () => {
    await renderPage({envoi: '1'})

    expect(getCampaignDal).toHaveBeenCalledWith(TENANT_ID, CAMPAIGN_ID)
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(
      'Campagne lancée.'
    )
  })

  it('montre les destinataires lus et le plafond du tenant (s26)', async () => {
    await renderPage()

    expect(screen.getAllByText('Anne Arnaud').length).toBeGreaterThan(0)
    expect(getAssociationSettingsDal).toHaveBeenCalledWith(TENANT_ID)
    expect(document.body).toHaveTextContent('Plafond150 envois par jour')
  })

  it('« sending » sans progrès depuis longtemps reste en cours : une part programmée n’est pas une interruption (s26)', async () => {
    vi.mocked(getCampaignDal).mockResolvedValue({
      status: 'found',
      campaign: campaignOf(CAMPAIGN_ID, {
        status: 'sending',
        displayState: 'sending',
        sentCount: 3,
        updatedAt: '2026-11-11T13:00:00.000Z',
      }),
    })

    await renderPage()

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('lit ?statut= et ?page= pour la liste des destinataires (s26)', async () => {
    await renderPage({statut: 'a-verifier', page: '2'})

    expect(getCampaignRecipientsDal).toHaveBeenCalledWith(
      TENANT_ID,
      CAMPAIGN_ID,
      'to_verify',
      2
    )
  })

  it.each([
    [{}, 'all', 1],
    [{statut: 'inconnu', page: 'x'}, 'all', 1],
    [{statut: 'recue', page: '0'}, 'received', 1],
    [{statut: 'programmee'}, 'scheduled', 1],
    [{statut: 'en-echec', page: '3'}, 'failed', 3],
  ])('%j → filtre %s, page %i', async (searchParams, filter, page) => {
    await renderPage(searchParams)

    expect(getCampaignRecipientsDal).toHaveBeenCalledWith(
      TENANT_ID,
      CAMPAIGN_ID,
      filter,
      page
    )
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
    expect(getCampaignRecipientsDal).not.toHaveBeenCalled()
  })
})
