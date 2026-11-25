import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import type {PublicCategoryDTO} from '@/services/types/domain/association-category-types'

import {TemplateDocumentGenerator} from './template-document-generator'

const PROFILE_ID = 'a1200000-0000-4000-8000-000000000001'
const TEMPLATE_ID = '33333333-3333-4333-8333-333333333333'
const DOCUMENT_ID = '55555555-5555-4555-8555-555555555555'
const CATEGORIES: PublicCategoryDTO[] = [
  {id: '44444444-4444-4444-8444-444444444444', name: 'Convocation'},
]
const TEMPLATES = [{id: TEMPLATE_ID, name: 'Convocation AG'}]

const depositAction = vi.fn()
const fetchMock = vi.fn()
const saved: string[] = []

const renderGenerator = (
  props: Partial<Parameters<typeof TemplateDocumentGenerator>[0]> = {}
) =>
  render(
    <TemplateDocumentGenerator
      memberProfile={{id: PROFILE_ID, name: 'Bernard Lefèvre'}}
      parcelNumbers={['12', '13']}
      addressLines={[
        'Bernard Lefèvre',
        '4 allée des Tilleuls',
        '69340 Francheville',
      ]}
      templates={TEMPLATES}
      categories={CATEGORIES}
      today="2026-11-25"
      depositAction={depositAction}
      {...props}
    />
  )

const templateField = () => screen.getByRole('combobox', {name: 'Modèle'})
const submitButton = () =>
  screen.getByRole('button', {name: /Télécharger|Préparation/})

const chooseTemplate = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(templateField())
  await user.click(screen.getByRole('option', {name: 'Convocation AG'}))
}

const pdfResponse = () =>
  new Response('%PDF-1.7', {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="document-25-11-2026.pdf"',
    },
  })

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
  saved.length = 0
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation(async () => pdfResponse())
  URL.createObjectURL = vi.fn(() => 'blob:document')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    saved.push(this.download)
  })
  depositAction.mockResolvedValue({
    status: 'deposited',
    documentId: DOCUMENT_ID,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TemplateDocumentGenerator — écran 3 (critère 2)', () => {
  it('3b : pour qui, l’adresse imprimée, la date du jour, la case décochée', () => {
    renderGenerator()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Générer un document'})
    ).toBeInTheDocument()
    expect(screen.getByText('4 allée des Tilleuls')).toBeInTheDocument()
    expect(screen.getByRole('textbox', {name: 'Date du document'})).toHaveValue(
      '25/11/2026'
    )
    expect(
      screen.getByRole('checkbox', {
        name: 'Déposer aussi dans le dossier de la fiche',
      })
    ).not.toBeChecked()
    expect(screen.queryByRole('textbox', {name: 'Titre'})).toBeNull()
  })

  it('sans case : aucune action, la route reçoit modèle, fiche et date, rien n’est conservé', async () => {
    const user = userEvent.setup()
    renderGenerator()

    await chooseTemplate(user)
    await user.click(submitButton())

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Document téléchargé.'
    )
    expect(depositAction).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = new URL(fetchMock.mock.calls[0][0] as string, 'http://x')
    expect(url.pathname).toBe(`/api/document-templates/${TEMPLATE_ID}/document`)
    expect(url.searchParams.get('fiche')).toBe(PROFILE_ID)
    expect(url.searchParams.get('date')).toBe('2026-11-25')
    expect(saved).toEqual(['document-25-11-2026.pdf'])
    expect(screen.getByRole('status')).not.toHaveTextContent('déposé')
  })

  it('avec case : l’action passe avant le téléchargement du fichier déposé', async () => {
    const order: string[] = []
    depositAction.mockImplementation(async () => {
      order.push('deposit')
      return {status: 'deposited', documentId: DOCUMENT_ID}
    })
    fetchMock.mockImplementation(async (url: string) => {
      order.push(`fetch ${url}`)
      return pdfResponse()
    })
    const user = userEvent.setup()
    renderGenerator()

    await chooseTemplate(user)
    await user.click(
      screen.getByRole('checkbox', {
        name: 'Déposer aussi dans le dossier de la fiche',
      })
    )
    await user.click(screen.getByRole('combobox', {name: 'Catégorie'}))
    await user.click(screen.getByRole('option', {name: 'Convocation'}))
    await user.type(
      screen.getByRole('textbox', {name: 'Titre'}),
      'Convocation AG'
    )
    expect(submitButton()).toHaveTextContent('Télécharger et déposer le PDF')
    await user.click(submitButton())

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Il est aussi déposé dans le dossier de Bernard Lefèvre, catégorie « Convocation »'
    )
    expect(order).toEqual([
      'deposit',
      `fetch /api/member-documents/${DOCUMENT_ID}`,
    ])
    const formData = depositAction.mock.calls[0][0] as FormData
    expect(Object.fromEntries(formData)).toEqual({
      templateId: TEMPLATE_ID,
      memberProfileId: PROFILE_ID,
      documentDate: '2026-11-25',
      categoryId: CATEGORIES[0].id,
      title: 'Convocation AG',
    })
    expect(saved).toEqual(['document-25-11-2026.pdf'])
  })

  it('avec case : un refus de dépôt ne télécharge rien', async () => {
    depositAction.mockResolvedValue({
      status: 'failed',
      reason: 'Le dépôt a été refusé : la catégorie choisie n’est plus active.',
      issues: ['category_unavailable'],
    })
    const user = userEvent.setup()
    renderGenerator()

    await chooseTemplate(user)
    await user.click(
      screen.getByRole('checkbox', {
        name: 'Déposer aussi dans le dossier de la fiche',
      })
    )
    await user.click(screen.getByRole('combobox', {name: 'Catégorie'}))
    await user.click(screen.getByRole('option', {name: 'Convocation'}))
    await user.type(screen.getByRole('textbox', {name: 'Titre'}), 'AG')
    await user.click(submitButton())

    const summary = await screen.findByRole('alert')
    expect(summary).toHaveTextContent('Le document n’a pas été généré.')
    expect(summary).toHaveTextContent(
      'Cette catégorie n’est plus active : choisissez-en une autre.'
    )
    expect(fetchMock).not.toHaveBeenCalled()
    expect(saved).toEqual([])
  })

  it('échec du moteur : rien n’est téléchargé ni déposé', async () => {
    fetchMock.mockResolvedValue(new Response(null, {status: 500}))
    const user = userEvent.setup()
    renderGenerator()

    await chooseTemplate(user)
    await user.click(submitButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le PDF n’a pas pu être produit.'
    )
    expect(saved).toEqual([])
  })

  it('3e : modèle non choisi et date invalide refusés dans le navigateur', async () => {
    const user = userEvent.setup()
    renderGenerator()

    const date = screen.getByRole('textbox', {name: 'Date du document'})
    await user.clear(date)
    await user.type(date, '3111')
    await user.click(submitButton())

    const summary = await screen.findByRole('alert')
    expect(
      within(summary).getByText('Choisissez un modèle.')
    ).toBeInTheDocument()
    expect(
      within(summary).getByText('Saisissez une date au format jj/mm/aaaa.')
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('case non rendue sans member.document.manage', () => {
    renderGenerator({categories: null})

    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('3f : aucun modèle — formulaire non proposé, lien vers la création', () => {
    renderGenerator({templates: []})

    expect(screen.getByText('Aucun modèle de document.')).toBeInTheDocument()
    expect(screen.getByRole('link', {name: /Créer un modèle/})).toHaveAttribute(
      'href',
      '/bureau/modeles-documents/nouveau'
    )
    expect(screen.queryByRole('combobox', {name: 'Modèle'})).toBeNull()
  })

  it('3g : aucune catégorie — la case révèle l’alerte, le téléchargement seul reste possible', async () => {
    const user = userEvent.setup()
    renderGenerator({categories: []})

    await user.click(
      screen.getByRole('checkbox', {
        name: 'Déposer aussi dans le dossier de la fiche',
      })
    )

    expect(
      screen.getByText('Aucune catégorie de document nominatif.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: /Gérer les catégories/})
    ).toHaveAttribute('href', '/bureau/documents-nominatifs/categories')
  })

  it('fiche sans parcelle actuelle : l’avertissement {parcelle}', () => {
    renderGenerator({parcelNumbers: []})

    expect(
      screen.getByText(
        'Cette fiche n’a pas de parcelle actuelle : {parcelle} restera vide dans le document.'
      )
    ).toBeInTheDocument()
  })
})
