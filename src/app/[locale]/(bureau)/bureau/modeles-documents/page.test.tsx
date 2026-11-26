import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({push: vi.fn(), refresh: vi.fn()}),
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
vi.mock('@/app/dal/document-template-dal', () => ({
  canManageCurrentDocumentTemplatesDal: vi.fn(),
  getDocumentTemplatesForBureauDal: vi.fn(),
  getDocumentTemplateForBureauDal: vi.fn(),
}))
vi.mock('./actions', () => ({
  createDocumentTemplateAction: vi.fn(),
  updateDocumentTemplateAction: vi.fn(),
  deleteDocumentTemplateAction: vi.fn(),
}))

import {render, screen} from '@/__tests__/customRender'
import {
  canManageCurrentDocumentTemplatesDal,
  getDocumentTemplateForBureauDal,
  getDocumentTemplatesForBureauDal,
} from '@/app/dal/document-template-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import DocumentTemplatePage from './[id]/page'
import NewDocumentTemplatePage from './nouveau/page'
import DocumentTemplatesPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const TEMPLATE_ID = '33333333-3333-4333-8333-333333333333'

/** Rend la section placee derriere le `<Suspense>` de la page. */
const renderSection = async (page: Promise<unknown>) => {
  const element = (await page) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>
  render(await type(section.props))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(getDocumentTemplatesForBureauDal).mockResolvedValue([
    {
      id: TEMPLATE_ID,
      name: 'Convocation AG',
      variables: ['nom'],
      updatedAt: new Date('2026-11-18T10:00:00Z'),
    },
  ])
  vi.mocked(getDocumentTemplateForBureauDal).mockResolvedValue({
    id: TEMPLATE_ID,
    name: 'Convocation AG',
    subject: 'Convocation',
    bodyMarkdown: 'Bonjour {nom}',
    updatedAt: new Date(),
  })
})

describe('/bureau/modeles-documents (s36, écran 1)', () => {
  const page = (searchParams: {supprime?: string} = {}) =>
    DocumentTemplatesPage({
      params: Promise.resolve({locale: 'fr'}),
      searchParams: Promise.resolve(searchParams),
    })

  it('montre les modèles du tenant au bureau', async () => {
    vi.mocked(canManageCurrentDocumentTemplatesDal).mockResolvedValue(true)

    await renderSection(page())

    expect(getDocumentTemplatesForBureauDal).toHaveBeenCalledWith(TENANT_ID)
    expect(screen.getAllByText('Convocation AG').length).toBeGreaterThan(0)
  })

  it('dit la suppression, sans texte venu de l’URL', async () => {
    vi.mocked(canManageCurrentDocumentTemplatesDal).mockResolvedValue(true)

    await renderSection(page({supprime: '1'}))
    expect(screen.getByRole('status')).toHaveTextContent('Modèle supprimé.')
  })

  it('1d : une lecture en échec est dite, rien n’est perdu', async () => {
    vi.mocked(canManageCurrentDocumentTemplatesDal).mockResolvedValue(true)
    vi.mocked(getDocumentTemplatesForBureauDal).mockRejectedValue(
      new Error('panne')
    )

    await renderSection(page())
    expect(screen.getByRole('alert')).toHaveTextContent(
      'La liste des modèles n’a pas pu être lue.'
    )
  })

  it('refuse un membre simple, sans lire les modèles', async () => {
    vi.mocked(canManageCurrentDocumentTemplatesDal).mockResolvedValue(false)

    await renderSection(page())

    expect(getDocumentTemplatesForBureauDal).not.toHaveBeenCalled()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('heading', {level: 1})).not.toHaveTextContent(
      'Modèles de documents'
    )
  })
})

describe('/bureau/modeles-documents/nouveau (s36, écran 2)', () => {
  const page = () =>
    NewDocumentTemplatePage({params: Promise.resolve({locale: 'fr'})})

  it('ouvre un modèle vide au bureau', async () => {
    vi.mocked(canManageCurrentDocumentTemplatesDal).mockResolvedValue(true)

    await renderSection(page())
    expect(
      screen.getByRole('heading', {level: 1, name: 'Nouveau modèle'})
    ).toBeInTheDocument()
  })

  it('refuse un membre simple', async () => {
    vi.mocked(canManageCurrentDocumentTemplatesDal).mockResolvedValue(false)

    await renderSection(page())
    expect(screen.queryByRole('textbox', {name: 'Nom du modèle'})).toBeNull()
  })
})

describe('/bureau/modeles-documents/[id] (s36, écran 2)', () => {
  const page = (searchParams: {enregistre?: string} = {}) =>
    DocumentTemplatePage({
      params: Promise.resolve({locale: 'fr', id: TEMPLATE_ID}),
      searchParams: Promise.resolve(searchParams),
    })

  it('ouvre le modèle du tenant, succès 2d au retour d’un enregistrement', async () => {
    vi.mocked(canManageCurrentDocumentTemplatesDal).mockResolvedValue(true)

    await renderSection(page({enregistre: '1'}))

    expect(getDocumentTemplateForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      TEMPLATE_ID
    )
    expect(screen.getByRole('textbox', {name: 'Nom du modèle'})).toHaveValue(
      'Convocation AG'
    )
    expect(screen.getByRole('status')).toHaveTextContent('Modèle enregistré.')
  })

  it('critère 5 — un modèle d’une autre association rend une 404', async () => {
    vi.mocked(canManageCurrentDocumentTemplatesDal).mockResolvedValue(true)
    vi.mocked(getDocumentTemplateForBureauDal).mockResolvedValue(undefined)

    await expect(renderSection(page())).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('refuse un membre simple, sans lire le modèle', async () => {
    vi.mocked(canManageCurrentDocumentTemplatesDal).mockResolvedValue(false)

    await renderSection(page())
    expect(getDocumentTemplateForBureauDal).not.toHaveBeenCalled()
  })
})
