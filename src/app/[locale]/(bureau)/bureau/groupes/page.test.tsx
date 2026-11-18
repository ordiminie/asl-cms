import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
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
  getRecipientGroupsForBureauDal: vi.fn(),
}))
vi.mock('./actions', () => ({createRecipientGroupAction: vi.fn()}))

import {render, screen} from '@/__tests__/customRender'
import {
  canManageCurrentRecipientGroupsDal,
  getRecipientGroupsForBureauDal,
} from '@/app/dal/recipient-group-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import RecipientGroupsPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

const renderPage = async (searchParams: {supprime?: string} = {}) => {
  const element = (await RecipientGroupsPage({
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
  vi.mocked(getRecipientGroupsForBureauDal).mockResolvedValue([
    {id: 'g1', name: 'Riverains', profileCount: 3},
  ])
})

describe('/bureau/groupes (s27)', () => {
  it('montre les groupes du tenant au bureau', async () => {
    vi.mocked(canManageCurrentRecipientGroupsDal).mockResolvedValue(true)

    await renderPage()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Groupes de destinataires'})
    ).toBeInTheDocument()
    expect(getRecipientGroupsForBureauDal).toHaveBeenCalledWith(TENANT_ID)
    expect(screen.getAllByText('Riverains').length).toBeGreaterThan(0)
  })

  it('dit la suppression qui vient d’avoir lieu, sans nom venu de l’URL (revue m2)', async () => {
    vi.mocked(canManageCurrentRecipientGroupsDal).mockResolvedValue(true)

    await renderPage({supprime: '1'})

    expect(screen.getByRole('status')).toHaveTextContent(
      'Groupe supprimé. Ses fiches n’ont pas changé.'
    )
  })

  it('n’affiche aucun texte arbitraire glissé dans l’URL', async () => {
    vi.mocked(canManageCurrentRecipientGroupsDal).mockResolvedValue(true)

    await renderPage({supprime: 'Texte arbitraire'})

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText(/Texte arbitraire/)).toBeNull()
  })

  it('refuse un membre simple, sans lire les groupes (contrôle répété dans la page)', async () => {
    vi.mocked(canManageCurrentRecipientGroupsDal).mockResolvedValue(false)

    await renderPage()

    expect(getRecipientGroupsForBureauDal).not.toHaveBeenCalled()
    expect(screen.queryByRole('table')).toBeNull()
  })
})
