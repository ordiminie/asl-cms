import {describe, expect, it, vi} from 'vitest'

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/__tests__/customRender'
import {PageWithBlocksDTO} from '@/services/types/domain/page-types'

import {PageEditor} from './page-editor'

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const ORG_ID = '22222222-2222-4222-8222-222222222222'
const PAGE_ID = '11111111-1111-4111-8111-111111111111'
const SHARE_KEY = `${ORG_ID}/pages/${PAGE_ID}/share-66666666-6666-4666-8666-666666666666.webp`

const pageOf = (
  overrides: Partial<PageWithBlocksDTO> = {}
): PageWithBlocksDTO => ({
  id: PAGE_ID,
  organizationId: ORG_ID,
  slug: 'qualite-de-l-eau',
  title: 'Qualité de l’eau',
  status: 'draft',
  seoTitle: null,
  seoDescription: null,
  shareImageKey: null,
  shareImageAlt: null,
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-02'),
  blocks: [],
  ...overrides,
})

const ASSOCIATION_DESCRIPTION =
  'Association syndicale libre du domaine de l’Étang.'

const renderEditor = (
  page = pageOf(),
  {
    withAssociationDescription = true,
    actions = {} as Record<string, unknown>,
  } = {}
) => {
  const props = {
    page,
    association: {
      host: 'lesamisdeletang.fr',
      description: withAssociationDescription
        ? ASSOCIATION_DESCRIPTION
        : undefined,
    },
    saveAction: vi.fn(async () => ({status: 'saved', page}) as never),
    publishAction: vi.fn(async () => ({status: 'published', page}) as never),
    unpublishAction: vi.fn(
      async () => ({status: 'unpublished', page}) as never
    ),
    uploadAction: vi.fn(
      async () => ({status: 'error', message: 'non'}) as never
    ),
    uploadShareImageAction: vi.fn(
      async () =>
        ({
          status: 'uploaded',
          key: SHARE_KEY,
          fileName: 'prelevement.jpg',
          fileSize: 412_000,
        }) as never
    ),
    ...actions,
  }
  render(<PageEditor {...props} />)
  return props
}

const section = () =>
  screen.getByRole('region', {name: 'Référencement et partage'})
const preview = () => screen.getByRole('region', {name: 'Dans Google'})
const titleField = () =>
  screen.getByLabelText(/Titre dans les moteurs de recherche/)
const descriptionField = () => within(section()).getByLabelText(/^Description/)

describe('PageEditor — section « Referencement et partage » (s11)', () => {
  it('l apercu suit la saisie du titre, et revient au titre de la page quand on le vide', async () => {
    renderEditor()

    expect(within(preview()).getByText('Qualité de l’eau')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Vide : le titre de la page, « Qualité de l’eau », sera utilisé.'
      )
    ).toBeInTheDocument()

    await userEvent.type(titleField(), 'Analyses de l’eau')
    expect(within(preview()).getByText('Analyses de l’eau')).toBeInTheDocument()

    await userEvent.clear(titleField())
    expect(within(preview()).getByText('Qualité de l’eau')).toBeInTheDocument()
  })

  it('l apercu suit la description, et revient a celle de l association quand on la vide', async () => {
    renderEditor()

    expect(
      within(preview()).getByText(ASSOCIATION_DESCRIPTION)
    ).toBeInTheDocument()
    expect(
      screen.getByText('Vide : la description de l’association sera utilisée.')
    ).toBeInTheDocument()

    await userEvent.type(descriptionField(), 'Résultats des analyses.')
    expect(
      within(preview()).getByText('Résultats des analyses.')
    ).toBeInTheDocument()

    await userEvent.clear(descriptionField())
    expect(
      within(preview()).getByText(ASSOCIATION_DESCRIPTION)
    ).toBeInTheDocument()
  })

  it('association sans description : Google choisira, et un lien vers les reglages', () => {
    renderEditor(pageOf(), {withAssociationDescription: false})

    expect(
      screen.getByText(
        /^Vide, comme la description de l’association : Google choisira un extrait de la page\./
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: 'Renseigner la description de l’association',
      })
    ).toHaveAttribute('href', '/bureau/reglages')
    expect(
      within(preview()).getByText('Extrait choisi par Google dans la page.')
    ).toBeInTheDocument()
  })

  it('compteur depasse : erreur avec le nombre de caracteres de trop', async () => {
    renderEditor()

    await userEvent.click(titleField())
    await userEvent.paste('a'.repeat(73))

    expect(screen.getByText('13 caractères de trop.')).toBeInTheDocument()
    expect(screen.getByText('73 / 60')).toHaveClass('text-destructive-text')
    expect(titleField()).toHaveAttribute('aria-invalid', 'true')
  })

  it('un seul caractere de trop : le message est au singulier (revue s11, m1)', async () => {
    renderEditor()

    await userEvent.click(titleField())
    await userEvent.paste('a'.repeat(61))

    expect(screen.getByText('1 caractère de trop.')).toBeInTheDocument()
  })

  it('le compteur mesure ce que mesure l erreur : espaces de fin exclus (revue s11, m2)', async () => {
    renderEditor()

    await userEvent.click(titleField())
    await userEvent.paste(`${'a'.repeat(60)}   `)

    expect(screen.getByText('60 / 60')).not.toHaveClass('text-destructive-text')
    expect(titleField()).not.toHaveAttribute('aria-invalid')
  })

  it('un texte trop long n est pas envoye : la barre dit le refus', async () => {
    const props = renderEditor()

    await userEvent.click(descriptionField())
    await userEvent.paste('a'.repeat(161))
    await userEvent.click(
      screen.getByRole('button', {name: /Enregistrer le brouillon/})
    )

    expect(props.saveAction).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enregistrement refusé : un texte dépasse sa longueur. Rien n’est perdu.'
    )
  })

  it('le texte alternatif n est demande qu avec une image', () => {
    renderEditor()
    expect(
      screen.queryByLabelText(/Texte alternatif de l’image/)
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('Vide : le logo de l’association sera montré.')
    ).toBeInTheDocument()
  })

  it('image presente : texte alternatif « Obligatoire avec une image », remplacer et retirer', () => {
    renderEditor(pageOf({shareImageKey: SHARE_KEY}))

    expect(
      screen.getByLabelText(/Texte alternatif de l’image/)
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText(
        /Texte alternatif de l’image — Obligatoire avec une image/
      )
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Remplacer l’image')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Retirer l’image'})
    ).toBeInTheDocument()
  })

  it('depose une image par l action dediee, puis demande son texte alternatif', async () => {
    const props = renderEditor()

    const file = new File(['x'], 'prelevement.jpg', {type: 'image/jpeg'})
    await userEvent.upload(screen.getByLabelText('Choisir un fichier'), file)

    await waitFor(() =>
      expect(props.uploadShareImageAction).toHaveBeenCalledTimes(1)
    )
    const formData = vi.mocked(props.uploadShareImageAction).mock
      .calls[0] as unknown as [FormData]
    expect(formData[0].get('pageId')).toBe(PAGE_ID)
    expect(formData[0].get('file')).toBe(file)
    expect(
      await screen.findByLabelText(/Texte alternatif de l’image/)
    ).toBeInTheDocument()
  })

  it('enregistre les champs de referencement avec la page', async () => {
    const props = renderEditor(pageOf({shareImageKey: SHARE_KEY}))

    await userEvent.type(titleField(), 'Analyses')
    await userEvent.type(descriptionField(), 'Résultats.')
    await userEvent.type(
      screen.getByLabelText(/Texte alternatif de l’image/),
      'Prélèvement'
    )
    await userEvent.click(
      screen.getByRole('button', {name: /Enregistrer le brouillon/})
    )

    await waitFor(() => expect(props.saveAction).toHaveBeenCalledTimes(1))
    expect(vi.mocked(props.saveAction).mock.calls[0]).toEqual([
      expect.objectContaining({
        seoTitle: 'Analyses',
        seoDescription: 'Résultats.',
        shareImageKey: SHARE_KEY,
        shareImageAlt: 'Prélèvement',
      }),
    ])
  })

  it('publication refusee pour une image sans texte alternatif : la barre le dit, avec « Decrire l image »', async () => {
    renderEditor(pageOf({shareImageKey: SHARE_KEY}), {
      actions: {
        publishAction: vi.fn(async () => ({
          status: 'incomplete',
          issues: [{code: 'share_image_alt_missing'}],
        })),
      },
    })

    await userEvent.click(screen.getByRole('button', {name: 'Publier la page'}))

    const bar = await screen.findByRole('alert')
    expect(bar).toHaveTextContent(
      'Publication refusée : l’image de partage n’a pas de texte alternatif. Rien n’est perdu.'
    )
    const link = within(bar.parentElement as HTMLElement).getByRole('link', {
      name: 'Décrire l’image',
    })
    expect(
      screen.getByText(
        'Décrivez l’image avant de publier : sans texte alternatif, la page ne peut pas être publiée.'
      )
    ).toBeInTheDocument()

    await userEvent.click(link)
    expect(screen.getByLabelText(/Texte alternatif de l’image/)).toHaveFocus()
  })

  it('aucun jargon a l ecran : ni SEO, ni meta, ni Open Graph, ni sitemap', () => {
    renderEditor(pageOf({shareImageKey: SHARE_KEY}))

    expect(section().textContent).not.toMatch(
      /SEO|\bmeta\b|Open Graph|sitemap/i
    )
  })
})
