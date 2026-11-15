import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', async () => {
  const actual =
    await vi.importActual<typeof import('next-intl/server')>('next-intl/server')

  return {...actual, setRequestLocale: vi.fn()}
})
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/member-question-dal', () => ({
  canManageCurrentMemberQuestionsDal: vi.fn(),
}))
vi.mock('@/app/dal/association-category-dal', () => ({
  getQuestionCategoriesForBureauDal: vi.fn(),
}))
vi.mock('@/app/dal/association-settings-dal', () => ({
  getAssociationSettingsDal: vi.fn(),
}))
vi.mock('./actions', () => ({
  createQuestionCategoryAction: vi.fn(),
  deleteQuestionCategoryAction: vi.fn(),
  updateQuestionCategoryAction: vi.fn(),
}))

import {render, screen} from '@/__tests__/customRender'
import {getQuestionCategoriesForBureauDal} from '@/app/dal/association-category-dal'
import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {canManageCurrentMemberQuestionsDal} from '@/app/dal/member-question-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import BureauQuestionCategoriesPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

const renderPage = async () => {
  const element = (await BureauQuestionCategoriesPage({
    params: Promise.resolve({locale: 'fr'}),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>

  render(await type(section.props))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(getQuestionCategoriesForBureauDal).mockResolvedValue({
    items: [],
    max: 10,
  })
  vi.mocked(getAssociationSettingsDal).mockResolvedValue({
    'contact.email': {value: 'contact@techcorp.test', isDefault: false},
  } as never)
})

describe('/bureau/questions/sujets — accès par rôle (s23)', () => {
  it('montre les sujets au bureau, avec l’adresse de contact dans la phrase de routage', async () => {
    vi.mocked(canManageCurrentMemberQuestionsDal).mockResolvedValue(true)

    await renderPage()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Sujets des questions'})
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Chaque question part vers l’adresse de son sujet. Un sujet sans adresse envoie à l’adresse de contact de l’association (contact@techcorp.test).'
      )
    ).toBeInTheDocument()
    expect(getQuestionCategoriesForBureauDal).toHaveBeenCalledWith(TENANT_ID)
  })

  it('sans adresse de contact, la phrase renvoie aux Réglages', async () => {
    vi.mocked(canManageCurrentMemberQuestionsDal).mockResolvedValue(true)
    vi.mocked(getAssociationSettingsDal).mockResolvedValue({} as never)

    await renderPage()

    expect(
      screen.getByText(/à renseigner dans les Réglages/)
    ).toBeInTheDocument()
  })

  it('refuse un membre simple, sans lire les sujets', async () => {
    vi.mocked(canManageCurrentMemberQuestionsDal).mockResolvedValue(false)

    await renderPage()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: "Cette page est réservée au bureau de l'association",
      })
    ).toBeInTheDocument()
    expect(getQuestionCategoriesForBureauDal).not.toHaveBeenCalled()
  })
})
