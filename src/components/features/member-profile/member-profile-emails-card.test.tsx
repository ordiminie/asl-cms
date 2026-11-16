import {beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import type {
  MemberProfileDTO,
  MemberProfileEmailDTO,
} from '@/services/types/domain/member-profile-types'

import {MemberProfileEmailsCard} from './member-profile-emails-card'

// Radix RadioGroup mesure ses items : jsdom n'a pas ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const JEAN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CLAIRE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const MARC_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const HOLDER_ACCOUNT_ID = '77777777-7777-4777-8777-777777777777'

const email = (
  overrides: Partial<MemberProfileEmailDTO> & {id: string; email: string}
): MemberProfileEmailDTO => ({
  role: 'additional',
  status: 'active',
  origin: 'site',
  addedByName: null,
  expiresAt: null,
  replacesEmailId: null,
  boardRole: null,
  otherProfiles: [],
  ...overrides,
})

const jean = email({
  id: JEAN_ID,
  email: 'jean.dubois@exemple.fr',
  role: 'holder',
  origin: 'file',
})
const claire = email({
  id: CLAIRE_ID,
  email: 'claire.dubois@exemple.fr',
  otherProfiles: [
    {id: 'fiche-40', name: 'Claire Dubois', parcelNumbers: ['40']},
  ],
})
const marc = email({
  id: MARC_ID,
  email: 'marc.dubois@exemple.fr',
  status: 'pending',
  addedByName: 'Claire Dubois',
  expiresAt: '2026-11-23T10:00:00.000Z',
})

const profile = (emails: MemberProfileEmailDTO[]) =>
  ({
    id: PROFILE_ID,
    name: 'Jean Dubois',
    emails,
  }) as unknown as MemberProfileDTO

const actions = () => ({
  addEmailAction: vi.fn(),
  updateEmailAction: vi.fn(),
  removeEmailAction: vi.fn(),
  designateHolderAction: vi.fn(),
})

let calls: ReturnType<typeof actions>

const renderCard = (emails: MemberProfileEmailDTO[]) =>
  render(<MemberProfileEmailsCard profile={profile(emails)} {...calls} />)

const sentForm = (action: ReturnType<typeof vi.fn>) =>
  Object.fromEntries(
    (action.mock.calls.at(-1)?.[1] as FormData | undefined)?.entries() ?? []
  )

const table = () => screen.getByRole('table')

beforeEach(() => {
  calls = actions()
})

describe('MemberProfileEmailsCard — lecture (4a)', () => {
  it('liste chaque adresse avec son rôle, son origine et son statut', () => {
    renderCard([jean, claire, marc])

    const rows = within(table()).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByText('jean.dubois@exemple.fr')).toBeVisible()
    expect(within(rows[0]).getByText('Titulaire')).toBeVisible()
    expect(within(rows[0]).getByText('Fichier Pennylane')).toBeVisible()
    expect(within(rows[0]).getByText('Active')).toBeVisible()
    expect(within(rows[1]).getByText('Supplémentaire')).toBeVisible()
    expect(within(rows[1]).getByText('Saisie sur le site')).toBeVisible()
    expect(
      within(rows[2]).getByText('En attente de confirmation')
    ).toBeVisible()
    expect(
      within(rows[2]).getByText('ajoutée par Claire Dubois · jusqu’au 23/11')
    ).toBeVisible()
  })

  it('nomme les autres fiches du compte d’une adresse, en liens', () => {
    renderCard([jean, claire])

    const [, row] = within(table()).getAllByRole('row').slice(1)
    expect(within(row).getByText('Se connecte aussi à :')).toBeVisible()
    expect(
      within(row).getByRole('link', {name: 'Claire Dubois, parcelle 40'})
    ).toHaveAttribute('href', expect.stringContaining('fiche-40'))
  })

  it('une seule action par ligne : « Gérer », nommée par l’adresse', () => {
    renderCard([jean, claire, marc])

    for (const row of within(table()).getAllByRole('row').slice(1)) {
      expect(within(row).getAllByRole('button')).toHaveLength(1)
    }
    expect(
      within(table()).getByRole('button', {
        name: 'Gérer jean.dubois@exemple.fr',
      })
    ).toBeVisible()
  })

  it('fiche sans adresse : l’état vide, et le bouton d’ajout', () => {
    renderCard([])

    expect(
      screen.getByText(
        'Aucune adresse email : cette fiche reçoit tout par courrier.'
      )
    ).toBeVisible()
    expect(screen.queryByRole('table')).toBeNull()
    expect(
      screen.getByRole('button', {name: 'Ajouter une adresse'})
    ).toBeVisible()
  })

  it('ne met aucun identifiant d’adresse dans le DOM', () => {
    const {container} = renderCard([jean, claire, marc])

    for (const id of [JEAN_ID, CLAIRE_ID, MARC_ID]) {
      expect(container.innerHTML).not.toContain(id)
    }
  })
})

describe('MemberProfileEmailsCard — ajouter (4b, 4c, 4g)', () => {
  it('ajoute une adresse puis dit qu’elle peut se connecter, sans parler d’email envoyé', async () => {
    calls.addEmailAction.mockResolvedValue({
      status: 'saved',
      change: 'added',
      email: 'marc@exemple.fr',
    })
    renderCard([jean])

    await userEvent.click(
      screen.getByRole('button', {name: 'Ajouter une adresse'})
    )
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByText(
        'Active tout de suite : elle peut se connecter et reçoit les envois. Aucun email ne part.'
      )
    ).toBeVisible()
    await userEvent.type(
      within(dialog).getByLabelText('Adresse email'),
      'marc@exemple.fr'
    )
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Ajouter l’adresse'})
    )

    expect(sentForm(calls.addEmailAction)).toEqual({
      memberProfileId: PROFILE_ID,
      email: 'marc@exemple.fr',
    })
    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent(
      'Adresse ajoutée : elle peut se connecter dès maintenant.'
    )
    expect(status).toHaveFocus()
  })

  it('fiche sans adresse active : l’aide dit qu’elle sera titulaire', async () => {
    renderCard([])

    await userEvent.click(
      screen.getByRole('button', {name: 'Ajouter une adresse'})
    )

    expect(
      within(screen.getByRole('dialog')).getByText(
        'Ce sera l’adresse titulaire de la fiche.'
      )
    ).toBeVisible()
  })

  it('adresse déjà sur la fiche : erreur de champ, la fenêtre reste ouverte', async () => {
    calls.addEmailAction.mockResolvedValue({status: 'already_listed'})
    renderCard([jean])

    await userEvent.click(
      screen.getByRole('button', {name: 'Ajouter une adresse'})
    )
    const dialog = screen.getByRole('dialog')
    await userEvent.type(
      within(dialog).getByLabelText('Adresse email'),
      'jean.dubois@exemple.fr'
    )
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Ajouter l’adresse'})
    )

    expect(
      await within(dialog).findByText(
        'Cette adresse figure déjà dans la liste.'
      )
    ).toBeVisible()
    expect(within(dialog).getByLabelText('Adresse email')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
  })

  it('adresse portée par une autre fiche : rien n’est écrit avant « Oui », puis le rôle choisi est envoyé (critère 8)', async () => {
    calls.addEmailAction
      .mockResolvedValueOnce({
        status: 'email_shared',
        holder: {
          userId: HOLDER_ACCOUNT_ID,
          name: 'Bernard Lefèvre',
          profiles: [
            {id: 'fiche-12', name: 'Bernard Lefèvre', parcelNumbers: ['12']},
          ],
        },
      })
      .mockResolvedValueOnce({
        status: 'saved',
        change: 'added',
        email: 'bernard@exemple.fr',
      })
    renderCard([jean])

    await userEvent.click(
      screen.getByRole('button', {name: 'Ajouter une adresse'})
    )
    const dialog = screen.getByRole('dialog')
    await userEvent.type(
      within(dialog).getByLabelText('Adresse email'),
      'bernard@exemple.fr'
    )
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Ajouter l’adresse'})
    )

    expect(
      await within(dialog).findByText(
        'Cette adresse est déjà celle du compte de Bernard Lefèvre.'
      )
    ).toBeVisible()
    const additional = within(dialog).getByRole('radio', {
      name: 'Supplémentaire',
    })
    expect(additional).toBeChecked()
    await userEvent.click(
      within(dialog).getByRole('radio', {name: /Titulaire de cette fiche/})
    )
    expect(
      within(dialog).getByText('jean.dubois@exemple.fr devient supplémentaire')
    ).toBeVisible()
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Oui, ajouter à cette fiche'})
    )

    expect(sentForm(calls.addEmailAction)).toEqual({
      memberProfileId: PROFILE_ID,
      email: 'bernard@exemple.fr',
      role: 'holder',
      confirmedAccountUserId: HOLDER_ACCOUNT_ID,
    })
  })

  it('erreur serveur : alerte destructive dans la fenêtre, jamais un toast', async () => {
    calls.addEmailAction.mockResolvedValue({
      status: 'error',
      message: 'L’enregistrement a échoué.',
    })
    renderCard([jean])

    await userEvent.click(
      screen.getByRole('button', {name: 'Ajouter une adresse'})
    )
    const dialog = screen.getByRole('dialog')
    await userEvent.type(
      within(dialog).getByLabelText('Adresse email'),
      'marc@exemple.fr'
    )
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Ajouter l’adresse'})
    )

    expect(
      await within(dialog).findByText('L’enregistrement a échoué.')
    ).toBeVisible()
  })
})

describe('MemberProfileEmailsCard — gérer (4d)', () => {
  it('désigne une supplémentaire active titulaire, après confirmation', async () => {
    calls.designateHolderAction.mockResolvedValue({
      status: 'saved',
      change: 'designated',
      email: 'claire.dubois@exemple.fr',
    })
    renderCard([jean, claire])

    await userEvent.click(
      within(table()).getByRole('button', {
        name: 'Gérer claire.dubois@exemple.fr',
      })
    )
    const dialog = screen.getByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Désigner titulaire'})
    )
    expect(
      within(dialog).getByText(
        'claire.dubois@exemple.fr devient l’adresse titulaire. jean.dubois@exemple.fr reste sur la fiche, comme supplémentaire.'
      )
    ).toBeVisible()
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Désigner titulaire'})
    )

    expect(sentForm(calls.designateHolderAction)).toEqual({
      memberProfileId: PROFILE_ID,
      emailId: CLAIRE_ID,
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      'claire.dubois@exemple.fr est désormais l’adresse titulaire.'
    )
  })

  it('ne propose pas de désigner la titulaire ni une adresse en attente', async () => {
    renderCard([jean, marc])

    await userEvent.click(
      within(table()).getByRole('button', {
        name: 'Gérer jean.dubois@exemple.fr',
      })
    )
    expect(
      within(screen.getByRole('dialog')).queryByRole('button', {
        name: 'Désigner titulaire',
      })
    ).toBeNull()
  })

  it('modifie une adresse, qui garde son rôle', async () => {
    calls.updateEmailAction.mockResolvedValue({
      status: 'saved',
      change: 'updated',
      email: 'jean@exemple.fr',
    })
    renderCard([jean])

    await userEvent.click(
      within(table()).getByRole('button', {
        name: 'Gérer jean.dubois@exemple.fr',
      })
    )
    const dialog = screen.getByRole('dialog')
    const input = within(dialog).getByLabelText('Modifier l’adresse')
    await userEvent.clear(input)
    await userEvent.type(input, 'jean@exemple.fr')
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Enregistrer l’adresse'})
    )

    expect(sentForm(calls.updateEmailAction)).toEqual({
      memberProfileId: PROFILE_ID,
      emailId: JEAN_ID,
      email: 'jean@exemple.fr',
    })
  })
})

describe('MemberProfileEmailsCard — retirer (4e, 4f)', () => {
  const openRemoval = async (address: string) => {
    await userEvent.click(
      within(table()).getByRole('button', {name: `Gérer ${address}`})
    )
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Retirer cette adresse',
      })
    )
    return screen.getByRole('alertdialog')
  }

  it('retirer la titulaire exige une remplaçante : bouton désactivé tant que rien n’est choisi', async () => {
    calls.removeEmailAction.mockResolvedValue({
      status: 'saved',
      change: 'removed',
      email: 'jean.dubois@exemple.fr',
    })
    renderCard([jean, claire])

    const dialog = await openRemoval('jean.dubois@exemple.fr')
    expect(
      within(dialog).getByText('Choisissez l’adresse qui la remplace.')
    ).toBeVisible()
    const replace = within(dialog).getByRole('button', {
      name: 'Retirer et remplacer',
    })
    expect(replace).toBeDisabled()
    expect(
      within(dialog).queryByRole('button', {
        name: 'Retirer, passer en courrier',
      })
    ).toBeNull()

    await userEvent.click(
      within(dialog).getByRole('radio', {name: 'claire.dubois@exemple.fr'})
    )
    expect(replace).toBeEnabled()
    await userEvent.click(replace)

    expect(sentForm(calls.removeEmailAction)).toEqual({
      memberProfileId: PROFILE_ID,
      emailId: JEAN_ID,
      replacementEmailId: CLAIRE_ID,
    })
  })

  it('remplace la titulaire par une nouvelle adresse saisie', async () => {
    calls.removeEmailAction.mockResolvedValue({
      status: 'saved',
      change: 'removed',
      email: 'jean.dubois@exemple.fr',
    })
    renderCard([jean, claire])

    const dialog = await openRemoval('jean.dubois@exemple.fr')
    await userEvent.click(
      within(dialog).getByRole('radio', {name: 'Une nouvelle adresse'})
    )
    await userEvent.type(
      within(dialog).getByLabelText('Nouvelle adresse titulaire'),
      'odile@exemple.fr'
    )
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Retirer et remplacer'})
    )

    expect(sentForm(calls.removeEmailAction)).toEqual({
      memberProfileId: PROFILE_ID,
      emailId: JEAN_ID,
      replacementEmail: 'odile@exemple.fr',
    })
  })

  it('dernière adresse active : « Retirer, passer en courrier » est proposé', async () => {
    calls.removeEmailAction.mockResolvedValue({
      status: 'saved',
      change: 'removed',
      email: 'jean.dubois@exemple.fr',
    })
    renderCard([jean, marc])

    const dialog = await openRemoval('jean.dubois@exemple.fr')
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Retirer, passer en courrier'})
    )

    expect(sentForm(calls.removeEmailAction)).toEqual({
      memberProfileId: PROFILE_ID,
      emailId: JEAN_ID,
    })
  })

  it('retirer une supplémentaire : dit que ses autres fiches restent accessibles', async () => {
    calls.removeEmailAction.mockResolvedValue({
      status: 'saved',
      change: 'removed',
      email: 'claire.dubois@exemple.fr',
    })
    renderCard([jean, claire])

    const dialog = await openRemoval('claire.dubois@exemple.fr')
    expect(
      within(dialog).getByText('Ses autres fiches restent accessibles.', {
        exact: false,
      })
    ).toBeVisible()
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Retirer l’adresse'})
    )

    expect(sentForm(calls.removeEmailAction)).toEqual({
      memberProfileId: PROFILE_ID,
      emailId: CLAIRE_ID,
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Adresse retirée : elle ne se connecte plus à cette fiche.'
    )
  })

  it('rend le refus du bureau sur sa dernière fiche, sans rien retirer', async () => {
    calls.removeEmailAction.mockResolvedValue({status: 'board_email_required'})
    renderCard([jean, claire])

    const dialog = await openRemoval('claire.dubois@exemple.fr')
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Retirer l’adresse'})
    )

    expect(
      await within(dialog).findByText(
        'L’adresse d’un membre du bureau ne se retire pas : modifiez-la.'
      )
    ).toBeVisible()
  })
})
