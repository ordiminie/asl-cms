import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', async () => {
  const actual =
    await vi.importActual<typeof import('next-intl/server')>('next-intl/server')

  return {...actual, setRequestLocale: vi.fn()}
})
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/member-annual-import-dal', () => ({
  canImportCurrentMemberContactsDal: vi.fn(),
}))
vi.mock('./actions', () => ({importAnnualMemberContactsAction: vi.fn()}))

import {render, screen} from '@/__tests__/customRender'
import {canImportCurrentMemberContactsDal} from '@/app/dal/member-annual-import-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import BureauMemberAnnualImportPage from './page'

/** Le composant de page est asynchrone : on resout son arbre avant de rendre. */
const renderPage = async () => {
  const element = (await BureauMemberAnnualImportPage({
    params: Promise.resolve({locale: 'fr'}),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>

  render(await type(section.props))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Rives Vertes',
  } as never)
})

describe('/bureau/proprietaires/mise-a-jour (s56)', () => {
  it('la présidence a l’écran de dépôt', async () => {
    vi.mocked(canImportCurrentMemberContactsDal).mockResolvedValue(true)

    await renderPage()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Mettre à jour les coordonnées',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Mettre à jour les fiches'})
    ).toBeDisabled()
  })

  it('1f : un membre du Bureau reçoit le refus, sans formulaire', async () => {
    vi.mocked(canImportCurrentMemberContactsDal).mockResolvedValue(false)

    await renderPage()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Cette page ne vous est pas accessible',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Revenir aux propriétaires'})
    ).toHaveAttribute('href', '/bureau/proprietaires')
    expect(
      screen.queryByRole('button', {name: 'Mettre à jour les fiches'})
    ).toBeNull()
  })
})
