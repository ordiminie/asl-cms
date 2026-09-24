import {describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, waitFor} from '@/__tests__/customRender'
import {
  BOARD_MEMBER_BIOGRAPHY_MAX_LENGTH,
  BoardMemberDTO,
} from '@/services/types/domain/board-member-types'

import {BoardMemberForm, BoardMemberSaveState} from './board-member-form'

const ORG_ID = '11111111-1111-4111-8111-111111111111'

const existing: BoardMemberDTO = {
  id: '33333333-3333-4333-8333-333333333333',
  organizationId: ORG_ID,
  name: 'Claire Besson',
  roleLabel: 'Présidente',
  photoKey: null,
  biography: 'Quelques phrases.',
  rank: 0,
}

const saved = () =>
  vi.fn(async (formData: FormData): Promise<BoardMemberSaveState> => {
    void formData
    return {status: 'saved'}
  })

const renderForm = (saveAction = saved(), member?: BoardMemberDTO) =>
  render(<BoardMemberForm member={member} saveAction={saveAction} />)

describe('BoardMemberForm — champs obligatoires', () => {
  it('refuse un nom vide, et le dit sous le champ', async () => {
    const user = userEvent.setup()
    const action = saved()
    renderForm(action)

    await user.type(screen.getByLabelText(/Rôle dans le bureau/), 'Trésorier')
    await user.click(screen.getByRole('button', {name: /Enregistrer la fiche/}))

    expect(
      await screen.findByText(/Le nom est obligatoire/)
    ).toBeInTheDocument()
    expect(action).not.toHaveBeenCalled()
  })

  it('refuse un rôle vide', async () => {
    const user = userEvent.setup()
    const action = saved()
    renderForm(action)

    await user.type(screen.getByLabelText(/^Nom/), 'Claire Besson')
    await user.click(screen.getByRole('button', {name: /Enregistrer la fiche/}))

    expect(
      await screen.findByText(/Le rôle est obligatoire/)
    ).toBeInTheDocument()
    expect(action).not.toHaveBeenCalled()
  })

  it('enregistre une fiche complète', async () => {
    const user = userEvent.setup()
    const action = saved()
    renderForm(action)

    await user.type(screen.getByLabelText(/^Nom/), 'Claire Besson')
    await user.type(screen.getByLabelText(/Rôle dans le bureau/), 'Présidente')
    await user.click(screen.getByRole('button', {name: /Enregistrer la fiche/}))

    expect(action).toHaveBeenCalledTimes(1)
    const formData = action.mock.calls[0][0]
    expect(formData.get('name')).toBe('Claire Besson')
    expect(formData.get('roleLabel')).toBe('Présidente')
  })
})

describe('BoardMemberForm — après une création', () => {
  it('ne peut pas créer une seconde fois la même fiche, et renvoie à la liste', async () => {
    const user = userEvent.setup()
    const action = saved()
    renderForm(action)

    await user.type(screen.getByLabelText(/^Nom/), 'Claire Besson')
    await user.type(screen.getByLabelText(/Rôle dans le bureau/), 'Présidente')
    await user.click(screen.getByRole('button', {name: /Enregistrer la fiche/}))

    expect(await screen.findByText(/Fiche enregistrée/)).toBeInTheDocument()

    // `findBy…` et non `getBy…` : tant que la transition n'est pas retombée, le
    // bouton porte encore « Enregistrement en cours… ». Sans l'attente, le test
    // passe ou échoue selon la charge de la machine.
    const submit = await screen.findByRole('button', {
      name: 'Enregistrer la fiche',
    })
    // Ecart 3 du design : « Enregistrer » desactive est annonce par
    // `aria-disabled`, jamais par l'attribut `disabled` qui le sortirait de
    // l'ordre de tabulation. Le clic doit rester un non-evenement.
    expect(submit).toHaveAttribute('aria-disabled', 'true')
    expect(submit).not.toBeDisabled()

    await user.click(submit)
    expect(action).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Fiche enregistrée/)).toBeInTheDocument()
  })

  it('laisse enregistrer plusieurs fois une fiche existante', async () => {
    const user = userEvent.setup()
    const action = saved()
    renderForm(action, existing)

    await user.click(screen.getByRole('button', {name: /Enregistrer la fiche/}))
    expect(await screen.findByText(/Fiche enregistrée/)).toBeInTheDocument()

    await user.click(
      await screen.findByRole('button', {name: 'Enregistrer la fiche'})
    )
    expect(action).toHaveBeenCalledTimes(2)
  })
})

describe('BoardMemberForm — biographie plafonnée (design system §3.9)', () => {
  it('écrit le compteur, sans reproche tant que le plafond est tenu', () => {
    renderForm(saved(), existing)

    expect(
      screen.getByText(`17 / ${BOARD_MEMBER_BIOGRAPHY_MAX_LENGTH}`)
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Biographie/)).not.toHaveAttribute(
      'aria-invalid'
    )
  })

  it('au dépassement, écrit le nombre de caractères de trop et marque le champ', async () => {
    const user = userEvent.setup()
    const action = saved()
    renderForm(action, {
      ...existing,
      biography: 'a'.repeat(BOARD_MEMBER_BIOGRAPHY_MAX_LENGTH),
    })

    const biography = screen.getByLabelText(/Biographie/)
    await user.type(biography, 'bcd')

    expect(screen.getByText('3 caractères de trop.')).toBeInTheDocument()
    expect(biography).toHaveAttribute('aria-invalid', 'true')

    await user.click(screen.getByRole('button', {name: /Enregistrer la fiche/}))
    expect(action).not.toHaveBeenCalled()
  })
})

describe('BoardMemberForm — photo', () => {
  it("n'offre aucun champ de texte alternatif : il est déduit du nom", () => {
    renderForm(saved(), existing)

    expect(
      screen.queryByRole('textbox', {name: /alternatif/i})
    ).not.toBeInTheDocument()
  })

  it('annonce le texte alternatif déduit quand une photo est en place', () => {
    renderForm(saved(), {
      ...existing,
      photoKey: `${ORG_ID}/board/${existing.id}/photo-1.webp`,
    })

    expect(screen.getByText(/Portrait de Claire Besson/)).toBeInTheDocument()
  })

  it('écrit la limite de poids réellement appliquée, avant tout échec', () => {
    renderForm(saved(), existing)

    expect(screen.getByText(/5 Mo au plus/)).toBeInTheDocument()
  })
})

const PHOTO_KEY = `${ORG_ID}/board/${existing.id}/photo-1.webp`

/**
 * La zone de depot de `FileUpload` n'a pas de libelle : son champ de fichier
 * porte l'identifiant `file-upload-handle`. Le rendre nul est la preuve que la
 * zone n'est pas a l'ecran.
 */
const dropzoneInput = () =>
  document.querySelector<HTMLInputElement>('#file-upload-handle')

const withPhoto = {...existing, photoKey: PHOTO_KEY}

describe('BoardMemberForm — remplacement de la photo', () => {
  it('« Remplacer la photo » rouvre le dépôt et transmet le nouveau fichier', async () => {
    const user = userEvent.setup()
    const action = saved()
    renderForm(action, withPhoto)

    expect(dropzoneInput()).toBeNull()
    await user.click(screen.getByRole('button', {name: 'Remplacer la photo'}))

    const input = dropzoneInput()
    expect(input).not.toBeNull()
    await user.upload(
      input as HTMLInputElement,
      new File(['x'], 'portrait.png', {type: 'image/png'})
    )

    expect(await screen.findByText('portrait.png')).toBeInTheDocument()

    await user.click(screen.getByRole('button', {name: /Enregistrer la fiche/}))
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))

    const sent = action.mock.calls[0][0].get('photo')
    expect(sent).toBeInstanceOf(File)
    expect((sent as File).name).toBe('portrait.png')
    expect(action.mock.calls[0][0].get('removePhoto')).toBeNull()
  })

  it("n'affiche plus l'ancienne photo une fois la nouvelle enregistrée", async () => {
    const user = userEvent.setup()
    const action = saved()
    renderForm(action, withPhoto)

    await user.click(screen.getByRole('button', {name: 'Remplacer la photo'}))
    await user.upload(
      dropzoneInput() as HTMLInputElement,
      new File(['x'], 'portrait.png', {type: 'image/png'})
    )
    await user.click(screen.getByRole('button', {name: /Enregistrer la fiche/}))

    expect(await screen.findByText(/Fiche enregistrée/)).toBeInTheDocument()

    const preview = screen.queryByAltText('Aperçu du portrait')
    expect(preview?.getAttribute('src') ?? '').not.toContain('photo-1.webp')
    expect(screen.getByText('portrait.png')).toBeInTheDocument()
  })
})
