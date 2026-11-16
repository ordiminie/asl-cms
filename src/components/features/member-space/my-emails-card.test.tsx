import {beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import type {
  MyEmailDTO,
  MyEmailsDTO,
} from '@/services/types/domain/member-email-types'

import {MyEmailsCard, MyEmailsCardLoading} from './my-emails-card'

const CLAIRE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const MARC_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

const email = (
  overrides: Partial<MyEmailDTO> & {email: string}
): MyEmailDTO => ({
  status: 'active',
  own: false,
  holder: false,
  pendingId: null,
  ownEmailId: null,
  replacesOwn: false,
  sentAt: null,
  expiresAt: null,
  onlyParcelNumbers: null,
  ...overrides,
})

const CLAIRE_VIEW: MyEmailsDTO = {
  landCount: 1,
  confirmationDays: 7,
  emails: [
    email({email: 'jean.dubois@exemple.fr', holder: true}),
    email({
      email: 'claire.dubois@exemple.fr',
      own: true,
      ownEmailId: CLAIRE_ID,
    }),
    email({
      email: 'marc.dubois@exemple.fr',
      status: 'pending',
      pendingId: MARC_ID,
      sentAt: '2026-11-16T10:00:00.000Z',
      expiresAt: '2026-11-23T10:00:00.000Z',
    }),
  ],
}

const actions = () => ({
  addEmailAction: vi.fn(),
  updateEmailAction: vi.fn(),
  correctEmailAction: vi.fn(),
  cancelEmailAction: vi.fn(),
})

let calls: ReturnType<typeof actions>

const renderCard = (emails: MyEmailsDTO = CLAIRE_VIEW) =>
  render(<MyEmailsCard emails={emails} {...calls} />)

const sentForm = (action: ReturnType<typeof vi.fn>) =>
  Object.fromEntries(
    (action.mock.calls.at(-1)?.[1] as FormData | undefined)?.entries() ?? []
  )

const card = () => screen.getByRole('region', {name: 'Mes adresses email'})

beforeEach(() => {
  calls = actions()
})

describe('MyEmailsCard — lecture (1a)', () => {
  it('liste les adresses : la sienne avec « Modifier », celle d’un autre sans action, son attente avec « Gérer »', () => {
    renderCard()

    expect(
      within(card()).getByText(
        'Chacune permet de se connecter à cet espace et reçoit les envois de l’association.'
      )
    ).toBeVisible()
    const items = within(card()).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(
      within(items[0]).getByText('Adresse titulaire du terrain')
    ).toBeVisible()
    expect(within(items[0]).queryByRole('button')).toBeNull()
    expect(within(items[1]).getByText('Votre adresse')).toBeVisible()
    expect(
      within(items[1]).getByRole('button', {
        name: 'Modifier claire.dubois@exemple.fr',
      })
    ).toBeVisible()
    expect(
      within(items[2]).getByText('En attente de confirmation')
    ).toBeVisible()
    expect(
      within(items[2]).getByText(
        'Lien envoyé le 16/11 · valable jusqu’au 23/11'
      )
    ).toBeVisible()
    expect(within(items[2]).getAllByRole('button')).toHaveLength(1)
    expect(
      within(items[2]).getByRole('button', {
        name: 'Gérer marc.dubois@exemple.fr',
      })
    ).toBeVisible()
    expect(
      within(card()).getByText('Pour retirer une adresse, écrivez au bureau.')
    ).toBeVisible()
  })

  it('une attente ajoutée par quelqu’un d’autre : sans action', () => {
    renderCard({
      ...CLAIRE_VIEW,
      emails: [
        email({
          email: 'marc.dubois@exemple.fr',
          status: 'pending',
          expiresAt: '2026-11-23T10:00:00.000Z',
          sentAt: '2026-11-16T10:00:00.000Z',
        }),
      ],
    })

    const [item] = within(card()).getAllByRole('listitem')
    expect(within(item).queryByRole('button')).toBeNull()
  })

  it('plusieurs terrains : le dit ; une adresse d’un seul terrain le dit aussi', () => {
    renderCard({
      ...CLAIRE_VIEW,
      landCount: 2,
      emails: [
        email({email: 'jean.dubois@exemple.fr', onlyParcelNumbers: ['21']}),
      ],
    })

    expect(
      within(card()).getByText('Elles valent pour vos 2 terrains.', {
        exact: false,
      })
    ).toBeVisible()
    expect(
      within(card()).getByText('Pour la parcelle 21 seulement')
    ).toBeVisible()
  })

  it('aucun identifiant d’adresse ni de fiche dans le DOM', () => {
    const {container} = renderCard()

    expect(container.innerHTML).not.toContain(CLAIRE_ID)
    expect(container.innerHTML).not.toContain(MARC_ID)
  })

  it('chargement : trois lignes, aria-busy', () => {
    render(<MyEmailsCardLoading />)

    expect(
      screen.getByRole('region', {name: 'Mes adresses email'})
    ).toHaveAttribute('aria-busy', 'true')
  })
})

describe('MyEmailsCard — ajouter (1b, 1c, 1d, 1f)', () => {
  const add = async (address: string) => {
    await userEvent.click(
      within(card()).getByRole('button', {name: 'Ajouter une adresse'})
    )
    const input = within(card()).getByLabelText('Nouvelle adresse email')
    expect(input).toHaveAttribute('type', 'email')
    expect(input).toHaveAttribute('autocomplete', 'email')
    expect(input).toHaveAttribute('inputmode', 'email')
    await userEvent.type(input, address)
    await userEvent.click(
      within(card()).getByRole('button', {
        name: 'Envoyer le lien de confirmation',
      })
    )
  }

  it('envoie le lien et le dit, sans pronom, avec le délai du tenant (1c)', async () => {
    calls.addEmailAction.mockResolvedValue({
      status: 'sent',
      email: 'sophie@exemple.fr',
      expiresAt: '2026-11-23T10:00:00.000Z',
    })
    renderCard()

    await add('sophie@exemple.fr')

    expect(sentForm(calls.addEmailAction)).toEqual({email: 'sophie@exemple.fr'})
    const status = await within(card()).findByRole('status')
    expect(status).toHaveTextContent(
      'Lien envoyé à sophie@exemple.fr. L’adresse s’activera dès que le lien reçu sera cliqué ; il vaut 7 jours.'
    )
    expect(status).toHaveFocus()
  })

  it('adresse portée par une autre fiche : erreur de champ qui ne nomme personne, et la page Contact (1d)', async () => {
    calls.addEmailAction.mockResolvedValue({status: 'taken'})
    renderCard()

    await add('bernard.lefevre@exemple.fr')

    expect(
      await within(card()).findByText(
        'Cette adresse est déjà enregistrée dans l’association. Pour l’ajouter ici, écrivez au bureau.'
      )
    ).toBeVisible()
    expect(
      within(card()).getByLabelText('Nouvelle adresse email')
    ).toHaveAttribute('aria-invalid', 'true')
    expect(card()).not.toHaveTextContent('Bernard')
  })

  it('le budget du jour est atteint : le lien partira demain (1f)', async () => {
    calls.addEmailAction.mockResolvedValue({
      status: 'deferred',
      email: 'sophie@exemple.fr',
      expiresAt: '2026-11-23T10:00:00.000Z',
    })
    renderCard()

    await add('sophie@exemple.fr')

    expect(
      await within(card()).findByText(
        'Le lien partira demain matin : l’association a atteint sa limite d’envois du jour.'
      )
    ).toBeVisible()
  })

  it('erreur serveur : alerte destructive dans la carte', async () => {
    calls.addEmailAction.mockResolvedValue({
      status: 'error',
      message: 'L’enregistrement a échoué.',
    })
    renderCard()

    await add('sophie@exemple.fr')

    expect(
      await within(card()).findByText('L’enregistrement a échoué.')
    ).toBeVisible()
  })
})

describe('MyEmailsCard — modifier la sienne, gérer son attente (1e)', () => {
  it('modifie sa propre adresse, désignée par sa ligne', async () => {
    calls.updateEmailAction.mockResolvedValue({
      status: 'sent',
      email: 'c.dubois@exemple.fr',
      expiresAt: '2026-11-23T10:00:00.000Z',
    })
    renderCard()

    await userEvent.click(
      within(card()).getByRole('button', {
        name: 'Modifier claire.dubois@exemple.fr',
      })
    )
    expect(
      within(card()).getByText(
        'Votre adresse actuelle reste valable jusqu’à la confirmation de la nouvelle. Ensuite, vous vous connecterez avec la nouvelle.'
      )
    ).toBeVisible()
    await userEvent.type(
      within(card()).getByLabelText('Votre nouvelle adresse'),
      'c.dubois@exemple.fr'
    )
    await userEvent.click(
      within(card()).getByRole('button', {
        name: 'Envoyer le lien de confirmation',
      })
    )

    expect(sentForm(calls.updateEmailAction)).toEqual({
      emailId: CLAIRE_ID,
      email: 'c.dubois@exemple.fr',
    })
  })

  it('annule son attente depuis « Gérer »', async () => {
    calls.cancelEmailAction.mockResolvedValue({status: 'cancelled'})
    renderCard()

    await userEvent.click(
      within(card()).getByRole('button', {name: 'Gérer marc.dubois@exemple.fr'})
    )
    await userEvent.click(
      within(card()).getByRole('button', {name: 'Annuler cette adresse'})
    )

    expect(sentForm(calls.cancelEmailAction)).toEqual({emailId: MARC_ID})
    expect(await within(card()).findByRole('status')).toHaveTextContent(
      'Adresse annulée : le lien envoyé ne sert plus.'
    )
  })

  it('corrige son attente et renvoie le lien depuis « Gérer »', async () => {
    calls.correctEmailAction.mockResolvedValue({
      status: 'sent',
      email: 'marc@exemple.fr',
      expiresAt: '2026-11-23T10:00:00.000Z',
    })
    renderCard()

    await userEvent.click(
      within(card()).getByRole('button', {name: 'Gérer marc.dubois@exemple.fr'})
    )
    const input = within(card()).getByLabelText('Corriger l’adresse')
    await userEvent.clear(input)
    await userEvent.type(input, 'marc@exemple.fr')
    await userEvent.click(
      within(card()).getByRole('button', {name: 'Corriger et renvoyer le lien'})
    )

    expect(sentForm(calls.correctEmailAction)).toEqual({
      emailId: MARC_ID,
      email: 'marc@exemple.fr',
    })
  })
})
