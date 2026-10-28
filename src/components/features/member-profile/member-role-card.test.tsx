import {beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import type {MemberProfileDTO} from '@/services/types/domain/member-profile-types'
import type {MemberRoleCardDTO} from '@/services/types/domain/member-role-types'

import {MemberRoleCard} from './member-role-card'

const PROFILE_ID = '33333333-3333-4333-8333-333333333333'

const card = (
  overrides: Partial<MemberRoleCardDTO> = {}
): MemberRoleCardDTO => ({
  reading: 'member',
  canEdit: true,
  notice: null,
  options: ['member', 'board'],
  self: false,
  ...overrides,
})

const profileWith = (
  roleCard: MemberRoleCardDTO,
  name = 'Lucie Moreau'
): Pick<MemberProfileDTO, 'id' | 'name' | 'roleCard'> => ({
  id: PROFILE_ID,
  name,
  roleCard,
})

const action = vi.fn()
const onSaved = vi.fn()

const renderCard = (roleCard: MemberRoleCardDTO, name?: string) =>
  render(
    <MemberRoleCard
      profile={profileWith(roleCard, name)}
      action={action}
      onSaved={onSaved}
    />
  )

const sent = () =>
  Object.fromEntries(
    [...(action.mock.calls[0][1] as FormData).entries()].map(([key, value]) => [
      key,
      String(value),
    ])
  )

const openEdit = () =>
  userEvent.click(screen.getByRole('button', {name: 'Modifier le rôle'}))

const roleGroup = () => screen.getByRole('radiogroup', {name: 'Rôle'})

beforeEach(() => {
  vi.clearAllMocks()
  action.mockResolvedValue({
    status: 'saved',
    change: 'assigned',
    message: 'Lucie Moreau fait maintenant partie du bureau.',
  })
})

describe('MemberRoleCard — lecture', () => {
  it('A1 : une phrase écrite pour un Membre, et le bouton « Modifier le rôle »', () => {
    renderCard(card())

    expect(screen.getByText('Membre.').tagName).toBe('STRONG')
    expect(
      screen.getByText(/Lucie Moreau accède à son espace personnel\./)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Modifier le rôle'})
    ).toBeInTheDocument()
  })

  it('A5 : la fiche de la Président(e) vue par le Bureau, sans bouton', () => {
    renderCard(
      card({
        reading: 'owner',
        canEdit: false,
        notice: 'presidency_reserved',
        options: [],
      }),
      'Hélène Roux'
    )

    expect(
      screen.getByText(
        /Hélène Roux gère le site de l’association et peut transmettre la présidence\./
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Seul(e) la Président(e) peut transmettre la présidence.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('la Président(e) sur sa propre fiche : la phrase de passation, sans bouton', () => {
    renderCard(
      card({
        reading: 'owner',
        canEdit: false,
        notice: 'own_presidency',
        options: [],
        self: true,
      }),
      'Hélène Roux'
    )

    expect(
      screen.getByText(
        'Pour transmettre la présidence, ouvrez la fiche de la personne qui vous succède.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('A8 : une fiche Bureau se lit avec sa phrase', () => {
    renderCard(card({reading: 'board'}), 'Paul Vidal')

    expect(
      screen.getByText(
        /Paul Vidal gère le site de l’association avec le reste du bureau\./
      )
    ).toBeInTheDocument()
  })

  it('A11 : fiche sans compte — aucun rôle possible, pas de bouton', () => {
    renderCard(
      card({reading: 'no_account', canEdit: false, options: []}),
      'Marc Fabre'
    )

    expect(
      screen.getByText(
        'Aucun rôle possible : ajoutez d’abord une adresse email pour lui ouvrir un compte.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('MemberRoleCard — modification', () => {
  it('A2 : le Bureau voit Membre et Bureau, sans Président(e) ; choisir Bureau avertit', async () => {
    renderCard(card())
    await openEdit()

    const radios = within(roleGroup()).getAllByRole('radio')
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual([
      'member',
      'board',
    ])
    expect(screen.getByRole('radio', {name: 'Membre'})).toBeChecked()
    expect(screen.getByText('Accède à son espace personnel.')).toBeVisible()
    expect(screen.queryByText(/Attention\./)).toBeNull()

    await userEvent.click(screen.getByRole('radio', {name: 'Bureau'}))

    expect(
      screen.getByText(
        /Lucie Moreau pourra gérer tout le site de l’association dès maintenant : pages, actualités, propriétaires\./
      )
    ).toBeInTheDocument()
  })

  it('A3 : « Enregistrer le rôle » envoie la fiche et le rôle, puis confirme en haut de la fiche', async () => {
    renderCard(card())
    await openEdit()
    await userEvent.click(screen.getByRole('radio', {name: 'Bureau'}))
    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer le rôle'})
    )

    expect(sent()).toEqual({memberProfileId: PROFILE_ID, role: 'board'})
    expect(onSaved).toHaveBeenCalledWith(
      'Lucie Moreau fait maintenant partie du bureau.'
    )
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('A4 : retirer le Bureau avertit que le site ne sera plus géré', async () => {
    renderCard(card({reading: 'board'}))
    await openEdit()
    await userEvent.click(screen.getByRole('radio', {name: 'Membre'}))

    expect(
      screen.getByText(
        /Lucie Moreau ne pourra plus gérer le site de l’association dès maintenant\. Son espace personnel reste ouvert\./
      )
    ).toBeInTheDocument()
  })

  it('A9 : sur sa propre fiche, l’avertissement est à la 2ᵉ personne', async () => {
    renderCard(card({reading: 'board', self: true}), 'Paul Vidal')
    await openEdit()
    await userEvent.click(screen.getByRole('radio', {name: 'Membre'}))

    expect(
      screen.getByText(
        /Vous ne pourrez plus gérer le site de l’association dès l’enregistrement\. Votre espace personnel reste ouvert\./
      )
    ).toBeInTheDocument()
  })

  it('A6 : la Président(e) voit trois options ; un choix égal n’avertit pas et n’écrit rien', async () => {
    renderCard(
      card({reading: 'board', options: ['member', 'board', 'owner']}),
      'Paul Vidal'
    )
    await openEdit()

    expect(within(roleGroup()).getAllByRole('radio')).toHaveLength(3)
    expect(
      screen.getByText('Vous lui transmettez la présidence.')
    ).toBeVisible()
    expect(screen.queryByText(/Attention\./)).toBeNull()

    const save = screen.getByRole('button', {name: 'Enregistrer le rôle'})
    expect(save).toBeEnabled()
    await userEvent.click(save)

    expect(action).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('« Annuler » referme sans rien envoyer', async () => {
    renderCard(card())
    await openEdit()
    await userEvent.click(screen.getByRole('radio', {name: 'Bureau'}))
    await userEvent.click(screen.getByRole('button', {name: 'Annuler'}))

    expect(action).not.toHaveBeenCalled()
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })
})

describe('MemberRoleCard — passation (A7)', () => {
  const presidentCard = () =>
    card({reading: 'board', options: ['member', 'board', 'owner']})

  const choosePresidency = async () => {
    renderCard(presidentCard(), 'Paul Vidal')
    await openEdit()
    await userEvent.click(screen.getByRole('radio', {name: 'Président(e)'}))
    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer le rôle'})
    )
  }

  it('ouvre un alert-dialog, sans encart warning en plus', async () => {
    await choosePresidency()

    const dialog = screen.getByRole('alertdialog', {
      name: 'Transmettre la présidence à Paul Vidal ?',
    })
    expect(
      within(dialog).getByText(
        'Paul Vidal devient Président(e) dès maintenant. Vous redevenez membre du bureau. Vous ne pourrez pas reprendre la présidence vous-même : seul(e) Paul Vidal pourra la transmettre à nouveau.'
      )
    ).toBeInTheDocument()
    expect(action).not.toHaveBeenCalled()
    expect(screen.queryByText(/Attention\./)).toBeNull()
  })

  it('« Transmettre la présidence » envoie le rôle owner', async () => {
    action.mockResolvedValue({
      status: 'saved',
      change: 'presidency_transferred',
      message: 'Paul Vidal est maintenant Président(e).',
    })
    await choosePresidency()
    await userEvent.click(
      screen.getByRole('button', {name: 'Transmettre la présidence'})
    )

    expect(sent()).toEqual({memberProfileId: PROFILE_ID, role: 'owner'})
    expect(onSaved).toHaveBeenCalledWith(
      'Paul Vidal est maintenant Président(e).'
    )
  })

  it('« Annuler » ferme le dialogue sans rien envoyer', async () => {
    await choosePresidency()
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Annuler',
      })
    )

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(action).not.toHaveBeenCalled()
  })
})

describe('MemberRoleCard — refus (A10)', () => {
  it('résumé d’erreurs destructive en haut de la carte, formulaire ouvert, choix et encart conservés', async () => {
    action.mockResolvedValue({
      status: 'refused',
      message:
        'Votre compte est le dernier qui peut désigner le bureau de l’association. Désignez d’abord une autre personne au bureau. Rien n’a été enregistré.',
    })
    renderCard(card({reading: 'board', self: true}), 'Paul Vidal')
    await openEdit()
    await userEvent.click(screen.getByRole('radio', {name: 'Membre'}))
    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer le rôle'})
    )

    const region = screen.getByRole('region', {name: 'Rôle dans l’association'})
    const [alert] = within(region).getAllByRole('alert')
    expect(alert).toHaveTextContent(
      'Votre compte est le dernier qui peut désigner le bureau de l’association.'
    )
    expect(screen.getByRole('radio', {name: 'Membre'})).toBeChecked()
    expect(screen.getByText(/Vous ne pourrez plus gérer/)).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('une panne s’écrit dans la carte', async () => {
    action.mockResolvedValue({status: 'error', message: 'Échec.'})
    renderCard(card())
    await openEdit()
    await userEvent.click(screen.getByRole('radio', {name: 'Bureau'}))
    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer le rôle'})
    )

    const region = screen.getByRole('region', {name: 'Rôle dans l’association'})
    expect(within(region).getAllByRole('alert')[0]).toHaveTextContent('Échec.')
  })
})
