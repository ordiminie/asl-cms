import {describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import {BoardMemberDTO} from '@/services/types/domain/board-member-types'

import {BoardMemberList} from './board-member-list'

const ORG_ID = '11111111-1111-4111-8111-111111111111'

const member = (
  id: string,
  name: string,
  rank: number,
  photoKey: string | null = `${ORG_ID}/board/${id}/photo-1.webp`
): BoardMemberDTO => ({
  id,
  organizationId: ORG_ID,
  name,
  roleLabel: 'Présidente',
  photoKey,
  biography: '',
  rank,
})

const bureau = (): BoardMemberDTO[] => [
  member('a', 'Claire Besson', 0),
  member('b', 'Michel Arnaud', 1),
  member('c', 'Sylvie Renard', 2),
  member('d', 'Jean-Pierre Vasseur', 3, null),
]

const renderList = (members = bureau(), memberCount: number | null = 412) =>
  render(
    <BoardMemberList
      members={members}
      memberCount={memberCount}
      reorderAction={vi.fn(async () => ({status: 'ok'}) as const)}
      removeAction={vi.fn(async () => ({status: 'ok'}) as const)}
    />
  )

describe('BoardMemberList — état vide', () => {
  it('invite à créer la première fiche, par un lien', () => {
    renderList([])

    expect(screen.getByText(/Aucune fiche pour l’instant/)).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: /premier membre du bureau/})
    ).toHaveAttribute('href', '/bureau/le-bureau/nouveau')
  })

  it('omet la phrase du nombre de membres quand le paramètre est absent', () => {
    renderList([], null)

    expect(screen.queryByText(/412/)).not.toBeInTheDocument()
    expect(screen.queryByText(/0 membre/)).not.toBeInTheDocument()
  })
})

describe('BoardMemberList — liste', () => {
  it('écrit le rang de chaque fiche, dans l’ordre reçu', () => {
    renderList()

    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(4)
    expect(rows[0]).toHaveTextContent('1 sur 4')
    expect(rows[0]).toHaveTextContent('Claire Besson')
    expect(rows[3]).toHaveTextContent('4 sur 4')
    expect(rows[3]).toHaveTextContent('Jean-Pierre Vasseur')
  })

  it('« Monter » de la première ligne est annoncé désactivé, pas retiré du clavier', () => {
    renderList()

    const first = screen.getAllByRole('listitem')[0]
    const up = within(first).getByRole('button', {name: 'Monter'})

    expect(up).toHaveAttribute('aria-disabled', 'true')
    expect(up).not.toBeDisabled()
  })

  it('« Descendre » de la dernière ligne, de même', () => {
    renderList()

    const last = screen.getAllByRole('listitem')[3]
    const down = within(last).getByRole('button', {name: 'Descendre'})

    expect(down).toHaveAttribute('aria-disabled', 'true')
    expect(down).not.toBeDisabled()
  })

  it('rend les initiales de la fiche sans photo, sans image cassée', () => {
    renderList()

    const withoutPhoto = screen.getAllByRole('listitem')[3]
    expect(within(withoutPhoto).getByText('JV')).toBeInTheDocument()
    expect(within(withoutPhoto).queryByRole('img')).not.toBeInTheDocument()
  })

  it('nomme la personne dans le dialogue de suppression', async () => {
    const user = userEvent.setup()
    renderList()

    const row = screen.getAllByRole('listitem')[3]
    await user.click(within(row).getByRole('button', {name: 'Supprimer'}))

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Jean-Pierre Vasseur')
    expect(dialog).toHaveTextContent(/définitive/)
  })

  it('annonce la renumérotation après une suppression', async () => {
    const user = userEvent.setup()
    renderList()

    const row = screen.getAllByRole('listitem')[3]
    await user.click(within(row).getByRole('button', {name: 'Supprimer'}))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(
      within(dialog).getByRole('button', {name: /Supprimer la fiche/})
    )

    expect(await screen.findByText(/renumérotées/)).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it("écrit l'échec du réordonnancement dans la page, jamais en toast", async () => {
    const user = userEvent.setup()
    render(
      <BoardMemberList
        members={bureau()}
        memberCount={412}
        reorderAction={vi.fn(async () => ({
          status: 'error' as const,
          message: "L'ordre n'a pas pu être enregistré.",
        }))}
        removeAction={vi.fn(async () => ({status: 'ok'}) as const)}
      />
    )

    const second = screen.getAllByRole('listitem')[1]
    await user.click(within(second).getByRole('button', {name: 'Monter'}))

    expect(
      await screen.findByText(
        /n’a pas pu être enregistré|n'a pas pu être enregistré/
      )
    ).toBeInTheDocument()
  })
})
