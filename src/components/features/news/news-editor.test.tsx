import {describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, waitFor} from '@/__tests__/customRender'
import {NewsDTO} from '@/services/types/domain/news-types'

import {NewsEditor} from './news-editor'

const ORG_ID = '22222222-2222-4222-8222-222222222222'
const NEWS_ID = '11111111-1111-4111-8111-111111111111'

const newsOf = (overrides: Partial<NewsDTO> = {}): NewsDTO => ({
  id: NEWS_ID,
  organizationId: ORG_ID,
  slug: 'assemblee-generale',
  title: 'Assemblée générale',
  publishedOn: '2026-10-10',
  imageKey: null,
  imageAlt: '',
  content: 'Rendez-vous le 10 octobre.',
  status: 'draft',
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-02'),
  ...overrides,
})

const editorOf = (news: NewsDTO, actions: Record<string, unknown> = {}) => (
  <NewsEditor
    news={news}
    saveAction={vi.fn(async () => ({status: 'saved', news}) as never)}
    publishAction={vi.fn(async () => ({status: 'published', news}) as never)}
    unpublishAction={vi.fn(
      async () => ({status: 'unpublished', news}) as never
    )}
    uploadAction={vi.fn(
      async () => ({status: 'error', message: 'non'}) as never
    )}
    {...actions}
  />
)

describe('NewsEditor — bouton principal contextuel', () => {
  it('propose de publier un brouillon, sans proposer de dépublier', () => {
    render(editorOf(newsOf({status: 'draft'})))

    expect(
      screen.getByRole('button', {name: "Publier l'actualité"})
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: 'Dépublier'})).toBeNull()
  })

  it('propose de mettre à jour et de dépublier une actualité publiée', () => {
    render(editorOf(newsOf({status: 'published'})))

    expect(
      screen.getByRole('button', {name: 'Enregistrer et mettre à jour'})
    ).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Dépublier'})).toBeInTheDocument()
  })

  it('une actualité dépubliée se republie', () => {
    render(editorOf(newsOf({status: 'unpublished'})))

    expect(
      screen.getByRole('button', {name: "Publier l'actualité"})
    ).toBeInTheDocument()
  })
})

describe('NewsEditor — adresse sur le site', () => {
  it("affiche l'adresse en lecture seule quand elle existe", () => {
    render(editorOf(newsOf()))

    expect(
      screen.getByText(/\/actualites\/assemblee-generale/)
    ).toBeInTheDocument()
  })

  it("n'affiche aucune adresse tant que l'actualité n'a pas de titre", () => {
    render(editorOf(newsOf({slug: null, title: ''})))

    expect(screen.queryByText(/\/actualites\//)).toBeNull()
  })
})

describe('NewsEditor — publication refusée', () => {
  it("écrit l'erreur sous le champ Texte alternatif", async () => {
    const news = newsOf({
      imageKey: `${ORG_ID}/news/${NEWS_ID}/image-a.png`,
      imageAlt: '',
    })
    const publishAction = vi.fn(async () => ({
      status: 'incomplete' as const,
      issues: ['missing_image_alt' as const],
    }))

    render(editorOf(news, {publishAction}))
    await userEvent.click(
      screen.getByRole('button', {name: "Publier l'actualité"})
    )

    await waitFor(() => expect(publishAction).toHaveBeenCalled())
    const alt = screen.getByLabelText(/Texte alternatif/)
    expect(alt).toHaveAttribute('aria-invalid', 'true')
    expect(
      screen.getByText(
        'Ajoutez un texte alternatif à l’image pour publier cette actualité.'
      )
    ).toBeInTheDocument()
  })

  it('écrit le titre manquant sous le champ Titre', async () => {
    const publishAction = vi.fn(async () => ({
      status: 'incomplete' as const,
      issues: ['missing_title' as const],
    }))

    render(editorOf(newsOf({title: '', slug: null}), {publishAction}))
    await userEvent.click(
      screen.getByRole('button', {name: "Publier l'actualité"})
    )

    await waitFor(() => expect(publishAction).toHaveBeenCalled())
    expect(screen.getByLabelText('Titre')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect(
      screen.getByText(
        'Donnez un titre à cette actualité pour pouvoir la publier.'
      )
    ).toBeInTheDocument()
  })
})

describe('NewsEditor — enregistrement refusé sur une actualité publiée', () => {
  it('écrit le titre manquant sous le champ Titre, comme à la publication', async () => {
    const saveAction = vi.fn(async () => ({
      status: 'incomplete' as const,
      issues: ['missing_title' as const],
    }))

    render(editorOf(newsOf({status: 'published'}), {saveAction}))
    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer le brouillon'})
    )

    await waitFor(() => expect(saveAction).toHaveBeenCalled())
    expect(screen.getByLabelText('Titre')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect(
      screen.getByText(
        'Donnez un titre à cette actualité pour pouvoir la publier.'
      )
    ).toBeInTheDocument()
  })

  it("écrit le texte alternatif manquant sous son champ, sans effacer l'image", async () => {
    const saveAction = vi.fn(async () => ({
      status: 'incomplete' as const,
      issues: ['missing_image_alt' as const],
    }))
    const news = newsOf({
      status: 'published',
      imageKey: `${ORG_ID}/news/${NEWS_ID}/image-a.png`,
    })

    render(editorOf(news, {saveAction}))
    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer le brouillon'})
    )

    await waitFor(() => expect(saveAction).toHaveBeenCalled())
    expect(screen.getByLabelText(/Texte alternatif/)).toHaveAttribute(
      'aria-invalid',
      'true'
    )
  })
})

describe("NewsEditor — la clé déposée part à l'enregistrement", () => {
  it('transmet la clé du dépôt, jamais un simple « retirer »', async () => {
    const key = `${ORG_ID}/news/${NEWS_ID}/image-b.png`
    const news = newsOf({imageKey: `${ORG_ID}/news/${NEWS_ID}/image-a.png`})
    const saveAction = vi.fn(async () => ({status: 'saved', news}) as never)
    const uploadAction = vi.fn(async () => ({
      status: 'uploaded' as const,
      key,
      fileName: 'mare.png',
    }))

    render(editorOf(news, {saveAction, uploadAction}))
    await userEvent.upload(
      screen.getByLabelText("Remplacer l'image"),
      new File(['x'], 'mare.png', {type: 'image/png'})
    )
    await waitFor(() => expect(uploadAction).toHaveBeenCalled())

    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer le brouillon'})
    )

    await waitFor(() => expect(saveAction).toHaveBeenCalled())
    expect(saveAction).toHaveBeenCalledWith(
      expect.objectContaining({imageKey: key})
    )
  })

  it('rend une clé nulle quand le bureau retire l’image', async () => {
    const news = newsOf({imageKey: `${ORG_ID}/news/${NEWS_ID}/image-a.png`})
    const saveAction = vi.fn(async () => ({status: 'saved', news}) as never)

    render(editorOf(news, {saveAction}))
    await userEvent.click(screen.getByRole('button', {name: "Retirer l'image"}))
    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer le brouillon'})
    )

    await waitFor(() => expect(saveAction).toHaveBeenCalled())
    expect(saveAction).toHaveBeenCalledWith(
      expect.objectContaining({imageKey: null})
    )
  })
})
