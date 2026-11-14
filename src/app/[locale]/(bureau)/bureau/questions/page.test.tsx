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
  getMemberQuestionsForBureauDal: vi.fn(),
}))

import {render, screen} from '@/__tests__/customRender'
import {
  canManageCurrentMemberQuestionsDal,
  getMemberQuestionsForBureauDal,
} from '@/app/dal/member-question-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import BureauMemberQuestionsPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

const renderPage = async (page?: string) => {
  const element = (await BureauMemberQuestionsPage({
    params: Promise.resolve({locale: 'fr'}),
    searchParams: Promise.resolve(page ? {page} : {}),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>

  render(await type(section.props))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(getMemberQuestionsForBureauDal).mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
    hasOpenCategories: true,
  })
})

describe('/bureau/questions — accès par rôle (s23)', () => {
  it('montre la file au bureau, à la page demandée', async () => {
    vi.mocked(canManageCurrentMemberQuestionsDal).mockResolvedValue(true)

    await renderPage('2')

    expect(
      screen.getByRole('heading', {level: 1, name: 'Questions des membres'})
    ).toBeInTheDocument()
    expect(getMemberQuestionsForBureauDal).toHaveBeenCalledWith(TENANT_ID, 2)
  })

  it('lit la page 1 pour un numéro absent ou invalide', async () => {
    vi.mocked(canManageCurrentMemberQuestionsDal).mockResolvedValue(true)

    await renderPage('abc')

    expect(getMemberQuestionsForBureauDal).toHaveBeenCalledWith(TENANT_ID, 1)
  })

  it('refuse un membre simple, sans lire les questions', async () => {
    vi.mocked(canManageCurrentMemberQuestionsDal).mockResolvedValue(false)

    await renderPage()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: "Cette page est réservée au bureau de l'association",
      })
    ).toBeInTheDocument()
    expect(getMemberQuestionsForBureauDal).not.toHaveBeenCalled()
  })
})
