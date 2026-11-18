import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  useRouter: () => ({push: vi.fn(), refresh: vi.fn()}),
}))
vi.mock('next-intl/server', async () => {
  const actual =
    await vi.importActual<typeof import('next-intl/server')>('next-intl/server')
  return {...actual, setRequestLocale: vi.fn()}
})
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/recipient-group-dal', () => ({
  canManageCurrentRecipientGroupsDal: vi.fn(),
  getRecipientGroupForBureauDal: vi.fn(),
}))
vi.mock('../actions', () => ({
  renameRecipientGroupAction: vi.fn(),
  deleteRecipientGroupAction: vi.fn(),
}))

import {render, screen} from '@/__tests__/customRender'
import {
  canManageCurrentRecipientGroupsDal,
  getRecipientGroupForBureauDal,
} from '@/app/dal/recipient-group-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import RecipientGroupPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const GROUP_ID = '33333333-3333-4333-8333-333333333333'

const renderPage = async () => {
  const element = (await RecipientGroupPage({
    params: Promise.resolve({locale: 'fr', id: GROUP_ID}),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>

  render(await type(section.props))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(canManageCurrentRecipientGroupsDal).mockResolvedValue(true)
  vi.mocked(getRecipientGroupForBureauDal).mockResolvedValue({
    id: GROUP_ID,
    name: 'Riverains',
    profileCount: 1,
    counts: {
      profilesWithEmail: 1,
      profilesWithoutEmail: 0,
      profiles: 1,
      recipients: 1,
      unsubscribed: 0,
    },
  })
})

describe('/bureau/groupes/[id] (s27)', () => {
  it('ouvre le groupe du tenant', async () => {
    await renderPage()

    expect(getRecipientGroupForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      GROUP_ID
    )
    expect(
      screen.getByRole('heading', {level: 1, name: 'Riverains'})
    ).toBeInTheDocument()
  })

  it('un groupe inconnu ou d’une autre association → 404', async () => {
    vi.mocked(getRecipientGroupForBureauDal).mockResolvedValue(undefined)

    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('refuse un membre simple, sans lire le groupe', async () => {
    vi.mocked(canManageCurrentRecipientGroupsDal).mockResolvedValue(false)

    await renderPage()

    expect(getRecipientGroupForBureauDal).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', {name: 'Riverains'})).toBeNull()
  })
})
