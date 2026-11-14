import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string) => `MemberQuestionPage.${key}`)
  ),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/app/dal/member-question-dal', () => ({
  getMyQuestionCategoriesDal: vi.fn(),
}))
vi.mock('@/services/facades/member-question-service-facade', () => ({
  createMyQuestionService: vi.fn(),
}))

import {getMyQuestionCategoriesDal} from '@/app/dal/member-question-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {ValidationError} from '@/services/errors/validation-error'
import {createMyQuestionService} from '@/services/facades/member-question-service-facade'

import {submitMyQuestionAction} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const CATEGORY_ID = '44444444-4444-4444-8444-444444444444'

const questionForm = (overrides: Record<string, string> = {}) => {
  const formData = new FormData()
  const values = {
    locale: 'fr',
    categoryId: CATEGORY_ID,
    body: 'Quand le chemin sera-t-il refait ?',
    ...overrides,
  }
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireActionAuth).mockResolvedValue(
    {} as Awaited<ReturnType<typeof requireActionAuth>>
  )
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({
    id: TENANT_ID,
  } as Awaited<ReturnType<typeof requireCurrentTenantDal>>)
  vi.mocked(getMyQuestionCategoriesDal).mockResolvedValue([
    {id: CATEGORY_ID, name: 'Voirie'},
  ])
  vi.mocked(createMyQuestionService).mockResolvedValue({
    status: 'created',
    id: '33333333-3333-4333-8333-333333333333',
    notificationFailed: false,
  })
})

describe('submitMyQuestionAction — le membre pose sa question (s23)', () => {
  it('refuse sans session, sans rien écrire', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    await expect(
      submitMyQuestionAction({status: 'idle'}, questionForm())
    ).resolves.toEqual({status: 'failed'})
    expect(createMyQuestionService).not.toHaveBeenCalled()
  })

  it('rend les erreurs traduites pour une saisie invalide, sans écriture', async () => {
    const result = await submitMyQuestionAction(
      {status: 'idle'},
      questionForm({categoryId: '', body: '   '})
    )

    expect(result).toEqual({
      status: 'invalid',
      errors: [
        {
          field: 'categoryId',
          message: 'MemberQuestionPage.validation.categoryRequired',
        },
        {field: 'body', message: 'MemberQuestionPage.validation.bodyRequired'},
      ],
    })
    expect(createMyQuestionService).not.toHaveBeenCalled()
  })

  it('refuse un sujet que l’association ne propose pas', async () => {
    const result = await submitMyQuestionAction(
      {status: 'idle'},
      questionForm({categoryId: '99999999-9999-4999-8999-999999999999'})
    )

    expect(result).toMatchObject({status: 'invalid'})
    expect(createMyQuestionService).not.toHaveBeenCalled()
  })

  it('refuse une question de plus de 2 000 caractères', async () => {
    const result = await submitMyQuestionAction(
      {status: 'idle'},
      questionForm({body: 'a'.repeat(2001)})
    )

    expect(result).toEqual({
      status: 'invalid',
      errors: [
        {field: 'body', message: 'MemberQuestionPage.validation.bodyMax'},
      ],
    })
  })

  it('transmet la question sans aucune identité, puis revient à l’espace', async () => {
    const formData = questionForm()
    formData.set('name', 'Quelqu’un d’autre')
    formData.set('email', 'autre@example.test')
    formData.set('memberId', '99999999-9999-4999-8999-999999999999')

    await expect(
      submitMyQuestionAction({status: 'idle'}, formData)
    ).rejects.toThrow('NEXT_REDIRECT:/dashboard?question=envoyee')
    expect(createMyQuestionService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      locale: 'fr',
      categoryId: CATEGORY_ID,
      body: 'Quand le chemin sera-t-il refait ?',
    })
  })

  it('revient à l’espace même quand la notification n’est pas partie', async () => {
    vi.mocked(createMyQuestionService).mockResolvedValue({
      status: 'created',
      id: '33333333-3333-4333-8333-333333333333',
      notificationFailed: true,
    })

    await expect(
      submitMyQuestionAction({status: 'idle'}, questionForm())
    ).rejects.toThrow('NEXT_REDIRECT:/dashboard?question=envoyee')
  })

  it.each([
    ['sans fiche dans l’association', async () => ({status: 'not_found'})],
    [
      'quand le service refuse',
      async () => {
        throw new ValidationError('sujet')
      },
    ],
  ])('rend un échec générique %s', async (_label, outcome) => {
    vi.mocked(createMyQuestionService).mockImplementation(outcome as never)

    await expect(
      submitMyQuestionAction({status: 'idle'}, questionForm())
    ).resolves.toEqual({status: 'failed'})
  })

  it('rend un échec sans sujet ouvert ni fiche', async () => {
    vi.mocked(getMyQuestionCategoriesDal).mockResolvedValue(undefined)

    await expect(
      submitMyQuestionAction({status: 'idle'}, questionForm())
    ).resolves.toEqual({status: 'failed'})
    expect(createMyQuestionService).not.toHaveBeenCalled()
  })
})
