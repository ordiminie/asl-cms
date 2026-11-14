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
vi.mock('@/app/dal/email-sending-dal', () => ({
  getEmailSendingOverviewDal: vi.fn(),
}))

import {render, screen} from '@/__tests__/customRender'
import {canManageCurrentCampaignsDal} from '@/app/dal/campaign-dal'
import {getEmailSendingOverviewDal} from '@/app/dal/email-sending-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import BureauEmailSendingPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

const renderPage = async (searchParams: {page?: string} = {}) => {
  const element = (await BureauEmailSendingPage({
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
  vi.mocked(getEmailSendingOverviewDal).mockResolvedValue({
    day: '2026-11-14',
    limit: 300,
    reserve: 100,
    sentToday: 87,
    loginSentToday: 9,
    remainingReportable: 122,
    limitReached: false,
    reserveExhausted: false,
    pending: [],
    pendingRecipientTotal: 0,
    nextSendOn: null,
  })
})

describe('/bureau/envois — accès et lecture (s52, écran 1)', () => {
  it('montre les envois de l’association du domaine au bureau', async () => {
    vi.mocked(canManageCurrentCampaignsDal).mockResolvedValue(true)

    await renderPage()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Envois d’emails'})
    ).toBeInTheDocument()
    expect(getEmailSendingOverviewDal).toHaveBeenCalledWith(TENANT_ID)
  })

  it('hors bureau : accès refusé, rien n’est lu', async () => {
    vi.mocked(canManageCurrentCampaignsDal).mockResolvedValue(false)

    await renderPage()

    expect(getEmailSendingOverviewDal).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('heading', {level: 1, name: 'Envois d’emails'})
    ).toBeNull()
  })

  it('une lecture en échec rend l’erreur, jamais une page blanche', async () => {
    vi.mocked(canManageCurrentCampaignsDal).mockResolvedValue(true)
    vi.mocked(getEmailSendingOverviewDal).mockRejectedValue(new Error('panne'))

    await renderPage()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Les envois n’ont pas pu être lus.'
    )
  })
})
