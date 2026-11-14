import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
vi.mock('next-intl/server', async () => {
  const actual =
    await vi.importActual<typeof import('next-intl/server')>('next-intl/server')

  return {...actual, setRequestLocale: vi.fn()}
})
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/member-question-dal', () => ({
  canManageCurrentMemberQuestionsDal: vi.fn(),
  getMemberQuestionForBureauDal: vi.fn(),
}))

import {render, screen} from '@/__tests__/customRender'
import {
  canManageCurrentMemberQuestionsDal,
  getMemberQuestionForBureauDal,
} from '@/app/dal/member-question-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import BureauMemberQuestionPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const QUESTION_ID = '33333333-3333-4333-8333-333333333333'

const resolveSection = async () => {
  const element = (await BureauMemberQuestionPage({
    params: Promise.resolve({locale: 'fr', id: QUESTION_ID}),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>
  return type(section.props)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(getMemberQuestionForBureauDal).mockResolvedValue({
    id: QUESTION_ID,
    memberId: '66666666-6666-4666-8666-666666666666',
    memberName: 'Lucie Moreau',
    memberEmail: 'lucie.moreau@exemple.fr',
    categoryName: 'Voirie',
    categoryDeleted: false,
    body: 'Bonjour',
    notificationFailed: false,
    createdAt: new Date('2026-11-14T08:42:00Z'),
  })
})

describe('/bureau/questions/[id] — accès par rôle (s23)', () => {
  it('ouvre la question pour le bureau', async () => {
    vi.mocked(canManageCurrentMemberQuestionsDal).mockResolvedValue(true)

    render(await resolveSection())

    expect(
      screen.getByRole('heading', {level: 1, name: 'Question de Lucie Moreau'})
    ).toBeInTheDocument()
    expect(getMemberQuestionForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      QUESTION_ID
    )
  })

  it('rend une 404 pour une question absente ou d’une autre association', async () => {
    vi.mocked(canManageCurrentMemberQuestionsDal).mockResolvedValue(true)
    vi.mocked(getMemberQuestionForBureauDal).mockResolvedValue(undefined)

    await expect(resolveSection()).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('refuse un membre simple, sans lire la question', async () => {
    vi.mocked(canManageCurrentMemberQuestionsDal).mockResolvedValue(false)

    render(await resolveSection())

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: "Cette page est réservée au bureau de l'association",
      })
    ).toBeInTheDocument()
    expect(getMemberQuestionForBureauDal).not.toHaveBeenCalled()
  })
})
