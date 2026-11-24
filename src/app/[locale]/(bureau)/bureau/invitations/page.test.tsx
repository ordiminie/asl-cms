import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

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
}))
vi.mock('@/app/dal/member-invitation-campaign-dal', () => ({
  getMemberInvitationsOverviewDal: vi.fn(),
}))
vi.mock('./actions', () => ({
  launchMemberInvitationsAction: vi.fn(),
  remindNeverSignedInAction: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: {debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn()},
}))

import {render, screen} from '@/__tests__/customRender'
import {canManageCurrentCampaignsDal} from '@/app/dal/campaign-dal'
import {getMemberInvitationsOverviewDal} from '@/app/dal/member-invitation-campaign-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {logger} from '@/lib/logger'

import BureauMemberInvitationsPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

const renderPage = async (searchParams: {page?: string} = {}) => {
  const element = (await BureauMemberInvitationsPage({
    params: Promise.resolve({locale: 'fr'}),
    searchParams: Promise.resolve(searchParams),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>

  render(await type(section.props))
}

const emptyPage = {
  launch: null,
  reminders: [],
  launchCounts: {
    nature: 'statutaire',
    profilesWithEmail: 0,
    profilesByLetter: 0,
    profilesRefused: 0,
    profiles: 0,
    recipients: 0,
    unsubscribed: 0,
    pendingAddresses: 0,
  },
  reminderCounts: {
    nature: 'statutaire',
    recipients: 0,
    neverInvited: 0,
    unsubscribed: 0,
    pendingAddresses: 0,
  },
  plan: {today: '2026-11-24', dailySendCap: 100, allottedToday: 0, parts: []},
  linkDays: 7,
  overview: {
    invited: 0,
    signedIn: 0,
    neverSignedIn: 0,
    pending: 0,
    coverage: {byEmail: 0, byLetter: 0, neither: 0},
    refusedProfiles: [],
    addresses: {
      items: [],
      page: 1,
      pageSize: 25,
      total: 0,
      totalPages: 1,
      pendingCount: 0,
    },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(getMemberInvitationsOverviewDal).mockResolvedValue(
    emptyPage as never
  )
})

describe('/bureau/invitations — accès et lecture (s42b, écrans 1 et 2)', () => {
  it('montre la page de l’association du domaine au bureau, à la page demandée', async () => {
    vi.mocked(canManageCurrentCampaignsDal).mockResolvedValue(true)

    await renderPage({page: '2'})

    expect(
      screen.getByRole('heading', {level: 1, name: 'Invitations des membres'})
    ).toBeInTheDocument()
    expect(getMemberInvitationsOverviewDal).toHaveBeenCalledWith(TENANT_ID, 2)
  })

  it('sans campaign.manage : accès refusé, rien n’est lu', async () => {
    vi.mocked(canManageCurrentCampaignsDal).mockResolvedValue(false)

    await renderPage()

    expect(getMemberInvitationsOverviewDal).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('heading', {level: 1, name: 'Invitations des membres'})
    ).toBeNull()
  })

  it('une page invalide se lit comme la première', async () => {
    vi.mocked(canManageCurrentCampaignsDal).mockResolvedValue(true)

    await renderPage({page: 'abc'})

    expect(getMemberInvitationsOverviewDal).toHaveBeenCalledWith(TENANT_ID, 1)
  })

  it('1l · une lecture en échec rend l’erreur, journalisée sans adresse', async () => {
    vi.mocked(canManageCurrentCampaignsDal).mockResolvedValue(true)
    vi.mocked(getMemberInvitationsOverviewDal).mockRejectedValue(
      new Error('panne')
    )

    await renderPage()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Les invitations ne peuvent pas être lues pour l’instant.'
    )
    expect(vi.mocked(logger.error).mock.calls[0][1]).toEqual({
      organizationId: TENANT_ID,
      errorName: 'Error',
    })
  })
})
