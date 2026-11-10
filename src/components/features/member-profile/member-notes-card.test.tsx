import fs from 'node:fs'
import path from 'node:path'

import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

import {act, render, screen, userEvent, within} from '@/__tests__/customRender'
import type {
  MemberNoteDTO,
  MemberNotesPageDTO,
} from '@/services/types/domain/member-note-types'

import {MemberNotesCard} from './member-notes-card'

const PROFILE_ID = '33333333-3333-4333-8333-333333333333'

const entry = (overrides: Partial<MemberNoteDTO> = {}): MemberNoteDTO => ({
  id: 'n1',
  kind: 'note',
  channel: null,
  entryDate: '2026-11-06',
  body: 'Souhaite vendre sa parcelle 14 au printemps.',
  authorName: 'Marie Delorme',
  createdAt: '2026-11-06T09:15:00.000Z',
  updatedAt: null,
  ...overrides,
})

/** État a : quatre entrées, dont une note modifiée. */
const FILLED: MemberNoteDTO[] = [
  entry(),
  entry({
    id: 'e1',
    kind: 'exchange',
    channel: 'phone',
    entryDate: '2026-10-28',
    body: 'Appelé au sujet de la cotisation 2026.',
    authorName: 'Jean-Paul Rivière',
    createdAt: '2026-10-29T08:00:00.000Z',
  }),
  entry({
    id: 'n2',
    entryDate: '2026-09-14',
    body: 'Ne pas appeler avant 10 h : travaille de nuit.\nPréfère le courrier.',
    createdAt: '2026-09-14T16:02:00.000Z',
    updatedAt: '2026-11-04T13:32:00.000Z',
  }),
  entry({
    id: 'e2',
    kind: 'exchange',
    channel: 'in_person',
    entryDate: '2026-03-12',
    body: 'Rencontré à l’assemblée générale.',
    authorName: 'Hélène Marchal',
    createdAt: '2026-03-12T19:00:00.000Z',
  }),
]

const pageOf = (
  items: MemberNoteDTO[],
  overrides: Partial<MemberNotesPageDTO> = {}
): MemberNotesPageDTO => ({
  items,
  page: 1,
  pageSize: 10,
  total: items.length,
  totalPages: Math.max(1, Math.ceil(items.length / 10)),
  ...overrides,
})

const actions = {
  addNoteAction: vi.fn(),
  addExchangeAction: vi.fn(),
  updateNoteAction: vi.fn(),
  deleteNoteAction: vi.fn(),
}

const cardOf = (notesPromise: Promise<MemberNotesPageDTO | undefined>) => (
  <MemberNotesCard
    memberProfileId={PROFILE_ID}
    notesPromise={notesPromise}
    today="2026-11-09"
    {...actions}
  />
)

/** Le fil se deroule par `use()` : le rendu se fait sous `act`. */
const renderCard = async (
  notesPromise: Promise<MemberNotesPageDTO | undefined>
) => {
  let rendered: ReturnType<typeof render> | undefined
  await act(async () => {
    rendered = render(cardOf(notesPromise))
  })
  return rendered as ReturnType<typeof render>
}

const thread = () =>
  screen.findByRole('list', {
    name: 'Notes et échanges, du plus récent au plus ancien',
  })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MemberNotesCard — en-tête', () => {
  it('titre la carte, dit qu’elle est interne au bureau et propose les deux ajouts', async () => {
    await renderCard(Promise.resolve(pageOf(FILLED)))

    expect(
      screen.getByRole('heading', {level: 2, name: 'Notes et échanges'})
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Visible du bureau seulement. Le propriétaire ne les voit pas.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Ajouter une note'})
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Consigner un échange'})
    ).toBeInTheDocument()
    await thread()
  })
})

describe('MemberNotesCard — état a, fil rempli', () => {
  it('range notes et échanges dans un seul fil, dans l’ordre reçu', async () => {
    await renderCard(Promise.resolve(pageOf(FILLED)))

    const items = within(await thread()).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    expect(
      items.map(
        (item) => within(item).getByText(/^(Note|Échange)$/).textContent
      )
    ).toEqual(['Note', 'Échange', 'Note', 'Échange'])
  })

  it('porte type, date et heure, texte et auteur sur une note', async () => {
    await renderCard(Promise.resolve(pageOf(FILLED)))

    const [note] = within(await thread()).getAllByRole('listitem')
    expect(within(note).getByText('Note')).toBeInTheDocument()
    expect(within(note).getByText('06/11/2026 10:15')).toBeInTheDocument()
    expect(
      within(note).getByText('Souhaite vendre sa parcelle 14 au printemps.')
    ).toBeInTheDocument()
    expect(
      within(note).getByText('Écrit par Marie Delorme')
    ).toBeInTheDocument()
  })

  it('porte le canal écrit et le jour seul sur un échange', async () => {
    await renderCard(Promise.resolve(pageOf(FILLED)))

    const exchange = within(await thread()).getAllByRole('listitem')[1]
    expect(within(exchange).getByText('Échange')).toBeInTheDocument()
    expect(within(exchange).getByText('· Téléphone')).toBeInTheDocument()
    expect(within(exchange).getByText('28/10/2026')).toBeInTheDocument()
    expect(
      within(exchange).getByText('Écrit par Jean-Paul Rivière')
    ).toBeInTheDocument()
  })

  it('dit « Modifiée le … à … » seulement sur l’entrée modifiée', async () => {
    await renderCard(Promise.resolve(pageOf(FILLED)))

    const items = within(await thread()).getAllByRole('listitem')
    expect(items[2]).toHaveTextContent('Modifiée le 04/11/2026 à 14:32')
    expect(items[2]).toHaveTextContent('Écrit par Marie Delorme')
    for (const item of [items[0], items[1], items[3]]) {
      expect(item).not.toHaveTextContent('Modifiée le')
    }
  })

  it('conserve les retours à la ligne du texte, rendu en texte', async () => {
    await renderCard(
      Promise.resolve(pageOf([entry({body: '<b>gras</b>\nligne 2'})]))
    )

    const [item] = within(await thread()).getAllByRole('listitem')
    const body = within(item).getByText(/<b>gras<\/b>/)
    expect(body).toHaveClass('whitespace-pre-wrap')
    expect(item.querySelector('b')).toBeNull()
  })

  it('nomme chaque action par son entrée', async () => {
    await renderCard(Promise.resolve(pageOf(FILLED)))

    await thread()
    expect(
      screen.getByRole('button', {name: 'Modifier la note du 06/11/2026'})
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Supprimer l’échange du 28/10/2026'})
    ).toBeInTheDocument()
  })
})

describe('MemberNotesCard — état b, vide', () => {
  it('dit qu’il n’y a rien et propose la première note', async () => {
    await renderCard(Promise.resolve(pageOf([])))

    expect(
      await screen.findByText('Aucune note ni échange pour l’instant.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Ajouter la première note'})
    ).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('traite une fiche sans fil lisible comme un fil vide', async () => {
    await renderCard(Promise.resolve(undefined))

    expect(
      await screen.findByText('Aucune note ni échange pour l’instant.')
    ).toBeInTheDocument()
  })
})

describe('MemberNotesCard — état c, chargement', () => {
  it('montre trois entrées en squelette, titre et boutons déjà là', async () => {
    const {container} = await renderCard(new Promise(() => {}))

    expect(
      screen.getByRole('heading', {level: 2, name: 'Notes et échanges'})
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Ajouter une note'})
    ).toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(3)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})

describe('MemberNotesCard — état l, fil long', () => {
  const long = Array.from({length: 10}, (_, index) =>
    entry({id: `n${index}`, body: `Entrée ${index}`})
  )

  it('pagine par lien : « Précédent » désactivé en page 1, « Suivant » vers ?notes=2', async () => {
    await renderCard(Promise.resolve(pageOf(long, {total: 23, totalPages: 3})))

    const nav = await screen.findByRole('navigation', {
      name: 'Pages des notes et échanges',
    })
    expect(within(nav).getByRole('button', {name: 'Précédent'})).toBeDisabled()
    expect(within(nav).getByText('Page 1 sur 3')).toBeInTheDocument()
    expect(within(nav).getByRole('link', {name: 'Suivant'})).toHaveAttribute(
      'href',
      `/bureau/proprietaires/${PROFILE_ID}?notes=2`
    )
  })

  it('en dernière page, « Précédent » mène à la page d’avant et « Suivant » est désactivé', async () => {
    await renderCard(
      Promise.resolve(
        pageOf(long.slice(0, 3), {page: 3, total: 23, totalPages: 3})
      )
    )

    const nav = await screen.findByRole('navigation', {
      name: 'Pages des notes et échanges',
    })
    expect(within(nav).getByRole('link', {name: 'Précédent'})).toHaveAttribute(
      'href',
      `/bureau/proprietaires/${PROFILE_ID}?notes=2`
    )
    expect(within(nav).getByRole('button', {name: 'Suivant'})).toBeDisabled()
  })

  it('n’affiche pas de pagination sur une seule page', async () => {
    await renderCard(Promise.resolve(pageOf(FILLED)))

    await thread()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})

describe('MemberNotesCard — formulaires, modification, suppression (états d à k)', () => {
  beforeAll(() => {
    // Radix Select s'appuie sur des API de pointeur absentes de jsdom.
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    Element.prototype.releasePointerCapture = vi.fn()
    Element.prototype.scrollIntoView = vi.fn()
  })

  beforeEach(() => {
    actions.addNoteAction.mockResolvedValue({
      status: 'saved',
      message: 'Note enregistrée.',
    })
    actions.addExchangeAction.mockResolvedValue({
      status: 'saved',
      message: 'Échange enregistré.',
    })
    actions.updateNoteAction.mockResolvedValue({
      status: 'saved',
      message: 'Note modifiée.',
    })
    actions.deleteNoteAction.mockResolvedValue({
      status: 'deleted',
      message: 'Note supprimée.',
    })
  })

  const sent = (action: ReturnType<typeof vi.fn>) =>
    Object.fromEntries(
      [...(action.mock.calls[0][1] as FormData).entries()].map(
        ([key, value]) => [key, String(value)]
      )
    )

  const openNoteForm = () =>
    userEvent.click(screen.getByRole('button', {name: 'Ajouter une note'}))
  const openExchangeForm = () =>
    userEvent.click(screen.getByRole('button', {name: 'Consigner un échange'}))

  it('d : ouvre la note en place, compteur à zéro, focus dans le champ, les deux ajouts effacés', async () => {
    await renderCard(Promise.resolve(pageOf(FILLED)))

    await openNoteForm()

    const body = screen.getByRole('textbox', {name: 'Note'})
    expect(body).toHaveFocus()
    expect(screen.getByText('0 / 2 000')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Enregistrer la note'})
    ).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Annuler'})).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {name: 'Ajouter une note'})
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {name: 'Consigner un échange'})
    ).not.toBeInTheDocument()
  })

  it('d : « Annuler » referme le formulaire et rend le focus au bouton', async () => {
    await renderCard(Promise.resolve(pageOf(FILLED)))
    await openNoteForm()

    await userEvent.click(screen.getByRole('button', {name: 'Annuler'}))

    expect(
      screen.queryByRole('textbox', {name: 'Note'})
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Ajouter une note'})).toHaveFocus()
  })

  it('b → d : « Ajouter la première note » ouvre le même formulaire', async () => {
    await renderCard(Promise.resolve(pageOf([])))

    await userEvent.click(
      screen.getByRole('button', {name: 'Ajouter la première note'})
    )

    expect(screen.getByRole('textbox', {name: 'Note'})).toBeInTheDocument()
  })

  it('e : l’échange s’ouvre avec la date du jour, l’aide de format, le canal à choisir et le résumé', async () => {
    await renderCard(Promise.resolve(pageOf(FILLED)))

    await openExchangeForm()

    expect(
      screen.getByRole('textbox', {name: 'Date de l’échange'})
    ).toHaveValue('09/11/2026')
    expect(screen.getByText('Au format jj/mm/aaaa.')).toBeInTheDocument()
    expect(screen.getByRole('combobox', {name: 'Canal'})).toHaveTextContent(
      'Choisissez un canal'
    )
    expect(screen.getByRole('textbox', {name: 'Résumé'})).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Enregistrer l’échange'})
    ).toBeInTheDocument()
  })

  it('f : trois erreurs, résumé ancré, chaque champ signalé, rien n’est envoyé', async () => {
    await renderCard(Promise.resolve(pageOf(FILLED)))
    await openExchangeForm()

    const date = screen.getByRole('textbox', {name: 'Date de l’échange'})
    await userEvent.clear(date)
    await userEvent.type(date, '12122026')
    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer l’échange'})
    )

    const summary = await screen.findByText(
      '3 champs à corriger. Rien n’a été enregistré.'
    )
    const alert = summary.closest('[role="alert"]') as HTMLElement
    expect(
      within(alert).getByRole('link', {
        name: 'Date de l’échange : cette date n’est pas encore arrivée.',
      })
    ).toHaveAttribute('href', `#${date.id}`)
    expect(
      within(alert).getByRole('link', {name: 'Canal : choisissez un canal.'})
    ).toBeInTheDocument()
    expect(
      within(alert).getByRole('link', {
        name: 'Résumé : écrivez le résumé de l’échange.',
      })
    ).toBeInTheDocument()
    expect(date).toHaveAttribute('aria-invalid', 'true')
    expect(actions.addExchangeAction).not.toHaveBeenCalled()
  })

  it('g : au-delà du plafond, dit le nombre de caractères de trop', async () => {
    await renderCard(Promise.resolve(pageOf(FILLED)))
    await openNoteForm()

    const body = screen.getByRole('textbox', {name: 'Note'})
    await userEvent.click(body)
    await userEvent.paste('a'.repeat(2017))

    expect(screen.getByText('17 caractères de trop.')).toBeInTheDocument()
    expect(body).toHaveAttribute('aria-invalid', 'true')
  })

  it('h : enregistre la note, referme le formulaire et confirme par une alerte', async () => {
    await renderCard(Promise.resolve(pageOf(FILLED)))
    await openNoteForm()

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Note'}),
      'Les clés du portail ont été remises à son fils.'
    )
    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer la note'})
    )

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Note enregistrée.'
    )
    expect(sent(actions.addNoteAction)).toEqual({
      memberProfileId: PROFILE_ID,
      kind: 'note',
      body: 'Les clés du portail ont été remises à son fils.',
      channel: '',
      entryDate: '',
    })
    expect(
      screen.queryByRole('textbox', {name: 'Note'})
    ).not.toBeInTheDocument()
  })

  it('h : enregistre un échange avec son jour, son canal et son résumé', async () => {
    await renderCard(Promise.resolve(pageOf(FILLED)))
    await openExchangeForm()

    await userEvent.click(screen.getByRole('combobox', {name: 'Canal'}))
    await userEvent.click(screen.getByRole('option', {name: 'Téléphone'}))
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Résumé'}),
      'Appelé au sujet du portail.'
    )
    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer l’échange'})
    )

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Échange enregistré.'
    )
    expect(sent(actions.addExchangeAction)).toEqual({
      memberProfileId: PROFILE_ID,
      kind: 'exchange',
      body: 'Appelé au sujet du portail.',
      channel: 'phone',
      entryDate: '09/11/2026',
    })
  })

  it('h : l’alerte de succès reste jusqu’à la prochaine action', async () => {
    await renderCard(Promise.resolve(pageOf(FILLED)))
    await openNoteForm()
    await userEvent.type(screen.getByRole('textbox', {name: 'Note'}), 'Texte')
    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer la note'})
    )
    expect(await screen.findByRole('status')).toBeInTheDocument()

    await openExchangeForm()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('i : modifie une note en place, pré-remplie, et envoie son identifiant et son type', async () => {
    await renderCard(Promise.resolve(pageOf(FILLED)))

    await userEvent.click(
      screen.getByRole('button', {name: 'Modifier la note du 06/11/2026'})
    )

    const body = screen.getByRole('textbox', {name: 'Note'})
    expect(body).toHaveValue('Souhaite vendre sa parcelle 14 au printemps.')
    await userEvent.type(body, ' Rappeler en janvier.')
    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer les modifications'})
    )

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Note modifiée.'
    )
    expect(sent(actions.updateNoteAction)).toEqual({
      memberProfileId: PROFILE_ID,
      noteId: 'n1',
      kind: 'note',
      body: 'Souhaite vendre sa parcelle 14 au printemps. Rappeler en janvier.',
      channel: '',
      entryDate: '',
    })
  })

  it('i : modifier un échange rouvre ses trois champs, pré-remplis', async () => {
    await renderCard(Promise.resolve(pageOf(FILLED)))

    await userEvent.click(
      screen.getByRole('button', {name: 'Modifier l’échange du 28/10/2026'})
    )

    expect(
      screen.getByRole('textbox', {name: 'Date de l’échange'})
    ).toHaveValue('28/10/2026')
    expect(screen.getByRole('combobox', {name: 'Canal'})).toHaveTextContent(
      'Téléphone'
    )
    expect(screen.getByRole('textbox', {name: 'Résumé'})).toHaveValue(
      'Appelé au sujet de la cotisation 2026.'
    )
  })

  it('un seul formulaire à la fois : modifier une entrée referme l’ajout', async () => {
    await renderCard(Promise.resolve(pageOf(FILLED)))
    await openNoteForm()

    await userEvent.click(
      screen.getByRole('button', {name: 'Modifier la note du 06/11/2026'})
    )

    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(
      screen.getByRole('button', {name: 'Enregistrer les modifications'})
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {name: 'Enregistrer la note'})
    ).not.toBeInTheDocument()
  })

  it('j : confirme la suppression d’une note, « Garder » en premier et focalisé', async () => {
    await renderCard(Promise.resolve(pageOf(FILLED)))

    await userEvent.click(
      screen.getByRole('button', {name: 'Supprimer la note du 06/11/2026'})
    )

    const dialog = await screen.findByRole('alertdialog', {
      name: 'Supprimer cette note ?',
    })
    expect(dialog).toHaveTextContent(
      'Note écrite par Marie Delorme le 06/11/2026. Elle sera effacée de la fiche.'
    )
    const buttons = within(dialog).getAllByRole('button')
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Garder la note',
      'Supprimer la note',
    ])
    expect(buttons[0]).toHaveFocus()

    await userEvent.click(buttons[1])

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Note supprimée.'
    )
    expect(sent(actions.deleteNoteAction)).toEqual({
      memberProfileId: PROFILE_ID,
      noteId: 'n1',
      kind: 'note',
    })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('j : nomme l’échange dans la boîte de suppression, et « Garder » ne supprime rien', async () => {
    await renderCard(Promise.resolve(pageOf(FILLED)))

    await userEvent.click(
      screen.getByRole('button', {name: 'Supprimer l’échange du 28/10/2026'})
    )
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Supprimer cet échange ?',
    })
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Garder l’échange'})
    )

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(actions.deleteNoteAction).not.toHaveBeenCalled()
  })

  it('k : l’échec d’enregistrement est dit en alerte, la saisie est conservée', async () => {
    actions.addNoteAction.mockResolvedValue({
      status: 'error',
      message:
        'La note n’a pas pu être enregistrée. Ce que vous avez écrit est conservé dans le formulaire. Réessayez dans un instant.',
    })
    await renderCard(Promise.resolve(pageOf(FILLED)))
    await openNoteForm()

    const body = screen.getByRole('textbox', {name: 'Note'})
    await userEvent.type(body, 'Souhaite vendre sa parcelle.')
    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer la note'})
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La note n’a pas pu être enregistrée.'
    )
    expect(screen.getByRole('textbox', {name: 'Note'})).toHaveValue(
      'Souhaite vendre sa parcelle.'
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('k : l’échec de suppression est dit en alerte, l’entrée reste', async () => {
    actions.deleteNoteAction.mockResolvedValue({
      status: 'error',
      message:
        'La note n’a pas pu être supprimée. Elle est toujours sur la fiche. Réessayez dans un instant.',
    })
    await renderCard(Promise.resolve(pageOf(FILLED)))

    await userEvent.click(
      screen.getByRole('button', {name: 'Supprimer la note du 06/11/2026'})
    )
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Supprimer la note',
      })
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La note n’a pas pu être supprimée. Elle est toujours sur la fiche.'
    )
    expect(
      screen.getByText('Souhaite vendre sa parcelle 14 au printemps.')
    ).toBeInTheDocument()
  })

  it('les actions erronées de la saisie serveur retombent sur leurs champs', async () => {
    actions.addNoteAction.mockResolvedValue({
      status: 'invalid',
      errors: [{field: 'body', message: 'Écrivez le texte de la note.'}],
    })
    await renderCard(Promise.resolve(pageOf(FILLED)))
    await openNoteForm()

    await userEvent.type(screen.getByRole('textbox', {name: 'Note'}), 'x')
    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer la note'})
    )

    expect(
      await screen.findAllByText(/Écrivez le texte de la note\./)
    ).not.toHaveLength(0)
  })
})

describe('MemberNotesCard — aucun jeu sombre (ADR 033)', () => {
  it('n’écrit aucune classe `dark:` dans ses composants', () => {
    for (const file of [
      'member-notes-card.tsx',
      'member-note-form.tsx',
      'member-note-delete-dialog.tsx',
    ]) {
      const source = fs.readFileSync(
        path.join(import.meta.dirname, file),
        'utf8'
      )
      expect(source).not.toContain('dark:')
    }
  })
})
