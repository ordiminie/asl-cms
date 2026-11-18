import {beforeEach, describe, expect, it, vi} from 'vitest'

const router = vi.hoisted(() => ({push: vi.fn(), refresh: vi.fn()}))
vi.mock('next/navigation', () => ({useRouter: () => router}))

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/__tests__/customRender'
import type {
  DeleteRecipientGroupActionResult,
  RecipientGroupDetailDTO,
  RecipientGroupNameActionResult,
} from '@/services/types/domain/recipient-group-types'

import {RecipientGroupDetail} from './recipient-group-detail'
import {
  RecipientGroupList,
  RecipientGroupListSkeleton,
} from './recipient-group-list'

const GROUP_ID = '33333333-3333-4333-8333-333333333333'

type NameAction = (
  state: RecipientGroupNameActionResult | undefined,
  formData: FormData
) => Promise<RecipientGroupNameActionResult>
type DeleteAction = (
  state: DeleteRecipientGroupActionResult | undefined,
  formData: FormData
) => Promise<DeleteRecipientGroupActionResult>

let nameAction: ReturnType<typeof vi.fn<NameAction>>
let deleteAction: ReturnType<typeof vi.fn<DeleteAction>>

const detail = (
  overrides: Partial<RecipientGroupDetailDTO> = {}
): RecipientGroupDetailDTO => ({
  id: GROUP_ID,
  name: 'Riverains du chemin des Crêtes',
  profileCount: 38,
  counts: {
    profilesWithEmail: 31,
    profilesWithoutEmail: 7,
    profiles: 38,
    recipients: 33,
    unsubscribed: 2,
  },
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  nameAction = vi.fn(async () => ({
    status: 'saved' as const,
    group: {id: GROUP_ID, name: 'Riverains', profileCount: 0},
  }))
  deleteAction = vi.fn(async () => ({status: 'deleted' as const}))
})

describe('RecipientGroupList — écran 3, liste', () => {
  it('titre la page et liste chaque groupe avec son nombre de fiches et « Ouvrir »', () => {
    render(
      <RecipientGroupList
        groups={[
          {id: GROUP_ID, name: 'Riverains', profileCount: 38},
          {id: 'g2', name: 'Commission voirie', profileCount: 6},
        ]}
        createAction={nameAction}
      />
    )

    expect(
      screen.getByRole('heading', {level: 1, name: 'Groupes de destinataires'})
    ).toBeInTheDocument()
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('Riverains')).toBeInTheDocument()
    expect(within(rows[0]).getByText('38')).toBeInTheDocument()
    expect(within(rows[0]).getByRole('link', {name: 'Ouvrir'})).toHaveAttribute(
      'href',
      `/bureau/groupes/${GROUP_ID}`
    )
  })

  it('vide : le dit, et propose de créer le premier', () => {
    render(<RecipientGroupList groups={[]} createAction={nameAction} />)

    expect(screen.getByText(/Aucun groupe pour l’instant/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Créer le premier'})
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('après une suppression : le dit, sans nommer le groupe ni toucher aux fiches (revue m2)', () => {
    render(<RecipientGroupList groups={[]} deleted createAction={nameAction} />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Groupe supprimé. Ses fiches n’ont pas changé.'
    )
  })

  it('« Créer un groupe » ouvre un dialogue à un champ, puis ouvre le groupe créé', async () => {
    render(<RecipientGroupList groups={[]} createAction={nameAction} />)

    await userEvent.click(screen.getByRole('button', {name: 'Créer un groupe'}))
    const dialog = await screen.findByRole('dialog', {name: 'Créer un groupe'})
    await userEvent.type(
      within(dialog).getByRole('textbox', {name: 'Nom du groupe'}),
      'Riverains'
    )
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Créer le groupe'})
    )

    await waitFor(() => expect(nameAction).toHaveBeenCalledTimes(1))
    expect((nameAction.mock.calls[0][1] as FormData).get('name')).toBe(
      'Riverains'
    )
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(`/bureau/groupes/${GROUP_ID}`)
    )
  })

  it('nom déjà pris : l’erreur s’ancre sous le champ, le dialogue reste ouvert', async () => {
    nameAction.mockResolvedValue({
      status: 'invalid',
      message: 'Un groupe porte déjà ce nom. Choisissez-en un autre.',
    })
    render(<RecipientGroupList groups={[]} createAction={nameAction} />)

    await userEvent.click(screen.getByRole('button', {name: 'Créer un groupe'}))
    const dialog = await screen.findByRole('dialog')
    const field = within(dialog).getByRole('textbox', {name: 'Nom du groupe'})
    await userEvent.type(field, 'riverains')
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Créer le groupe'})
    )

    expect(
      await within(dialog).findByText(
        'Un groupe porte déjà ce nom. Choisissez-en un autre.'
      )
    ).toBeInTheDocument()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(router.push).not.toHaveBeenCalled()
  })

  it('nom vide : refusé avant tout envoi', async () => {
    render(<RecipientGroupList groups={[]} createAction={nameAction} />)

    await userEvent.click(screen.getByRole('button', {name: 'Créer un groupe'}))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Créer le groupe'})
    )

    expect(
      await within(dialog).findByText('Donnez un nom au groupe.')
    ).toBeInTheDocument()
    expect(nameAction).not.toHaveBeenCalled()
  })

  it('chargement : skeleton', () => {
    const {container} = render(<RecipientGroupListSkeleton />)

    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
  })
})

describe('RecipientGroupDetail — écran 3, un groupe', () => {
  const renderDetail = (group = detail()) =>
    render(
      <RecipientGroupDetail
        group={group}
        renameAction={nameAction}
        deleteAction={deleteAction}
      />
    )

  it('fil d’Ariane, titre, et composition comptée en fiches puis en adresses (critère 5)', () => {
    renderDetail()

    expect(screen.getByRole('link', {name: 'Groupes'})).toHaveAttribute(
      'href',
      '/bureau/groupes'
    )
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Riverains du chemin des Crêtes',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText('Fiches avec au moins une adresse email active')
    ).toBeInTheDocument()
    expect(screen.getByText('31')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('38')).toBeInTheDocument()
    expect(
      screen.getByText(
        '33 adresses recevraient une campagne envoyée aujourd’hui.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Voir et modifier les fiches du groupe'})
    ).toHaveAttribute('href', `/bureau/proprietaires?groupe=${GROUP_ID}`)
  })

  it('« Renommer le groupe » envoie le nouveau nom du groupe, puis rafraîchit', async () => {
    renderDetail()

    await userEvent.click(
      screen.getByRole('button', {name: 'Renommer le groupe'})
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Renommer le groupe',
    })
    const field = within(dialog).getByRole('textbox', {name: 'Nom du groupe'})
    expect(field).toHaveValue('Riverains du chemin des Crêtes')
    await userEvent.clear(field)
    await userEvent.type(field, 'Bord de mer')
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Renommer le groupe'})
    )

    await waitFor(() => expect(nameAction).toHaveBeenCalledTimes(1))
    const sent = nameAction.mock.calls[0][1] as FormData
    expect(sent.get('groupId')).toBe(GROUP_ID)
    expect(sent.get('name')).toBe('Bord de mer')
    await waitFor(() => expect(router.refresh).toHaveBeenCalled())
  })

  it('« Supprimer le groupe » nomme l’acte, puis revient à la liste (critère 6)', async () => {
    renderDetail()

    await userEvent.click(
      screen.getByRole('button', {name: 'Supprimer le groupe'})
    )
    const dialog = await screen.findByRole('alertdialog')
    expect(
      within(dialog).getByText('Supprimer « Riverains du chemin des Crêtes » ?')
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(/Ses 38 fiches restent dans la liste/)
    ).toBeInTheDocument()
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Supprimer le groupe'})
    )

    await waitFor(() => expect(deleteAction).toHaveBeenCalledTimes(1))
    expect((deleteAction.mock.calls[0][1] as FormData).get('groupId')).toBe(
      GROUP_ID
    )
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith('/bureau/groupes?supprime=1')
    )
    expect(String(vi.mocked(router.push).mock.calls[0][0])).not.toContain(
      'Riverains'
    )
  })

  it('une suppression refusée reste dans le dialogue, avec le message', async () => {
    deleteAction.mockResolvedValue({
      status: 'error',
      message: 'Ce groupe n’existe plus.',
    })
    renderDetail()

    await userEvent.click(
      screen.getByRole('button', {name: 'Supprimer le groupe'})
    )
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Supprimer le groupe'})
    )

    expect(
      await screen.findByText('Ce groupe n’existe plus.')
    ).toBeInTheDocument()
    expect(router.push).not.toHaveBeenCalled()
  })
})
