import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen} from '@/__tests__/customRender'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  redirect: vi.fn(),
  forbidden: vi.fn(),
}))
vi.mock('next-intl/server', async () => {
  const messages = (await import('../../../../../../messages/fr.json')).default

  return {
    getTranslations: async (namespace: string) => (key: string) =>
      [...namespace.split('.'), ...key.split('.')].reduce<unknown>(
        (node, part) => (node as Record<string, unknown>)?.[part],
        messages
      ) as string,
  }
})
vi.mock('@/services/authentication/auth-service', () => ({
  getAuthUser: vi.fn(async () => ({
    id: '3f5a0a5e-0000-4000-8000-000000000001',
    name: 'Lucie Moreau',
    email: 'lucie.moreau@exemple.fr',
    role: 'user',
    visibility: 'private',
  })),
  getSessionAuth: vi.fn(),
}))
vi.mock('@/app/dal/member-question-dal', () => ({
  getMyQuestionCategoriesDal: vi.fn(),
  getMyQuestionIdentityDal: vi.fn(),
}))
vi.mock('./actions', () => ({submitMyQuestionAction: vi.fn()}))

import {
  getMyQuestionCategoriesDal,
  getMyQuestionIdentityDal,
} from '@/app/dal/member-question-dal'

import MyQuestionPage from './page'

const renderPage = async () => {
  const outer = (await MyQuestionPage({})) as ReactElement
  const type = outer.type as (props: unknown) => Promise<ReactElement>
  render(await type(outer.props))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getMyQuestionCategoriesDal).mockResolvedValue([
    {id: '44444444-4444-4444-8444-444444444444', name: 'Voirie'},
  ])
  vi.mocked(getMyQuestionIdentityDal).mockResolvedValue({
    name: 'Lucie Moreau',
    email: 'lucie.moreau@exemple.fr',
  })
})

describe('/dashboard/question — écran B (s23)', () => {
  it('B1 : ramène à l’espace, titre la page et propose le formulaire', async () => {
    await renderPage()

    expect(
      screen.getByRole('link', {name: 'Revenir à mon espace'})
    ).toHaveAttribute('href', '/dashboard')
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Poser une question au bureau',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', {name: 'Sujet de votre question'})
    ).toBeInTheDocument()
  })

  it('B4 : sans aucun sujet ouvert, pas de formulaire mais un renvoi vers la page Contact', async () => {
    vi.mocked(getMyQuestionCategoriesDal).mockResolvedValue([])

    await renderPage()

    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(
      screen.getByText(
        'Le bureau n’a pas encore choisi les sujets de questions. En attendant, écrivez-lui depuis la page Contact du site.'
      )
    ).toBeInTheDocument()
    const contact = screen.getByRole('link', {name: 'Écrire au bureau'})
    expect(contact).toHaveAttribute('href', '/contact')
    expect(contact).not.toHaveClass('bg-primary')
  })

  it('n’existe pas pour un compte sans fiche dans l’association', async () => {
    vi.mocked(getMyQuestionIdentityDal).mockResolvedValue(undefined)
    vi.mocked(getMyQuestionCategoriesDal).mockResolvedValue(undefined)

    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
