import {beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import type {
  AssociationCategoryListDTO,
  ManagedCategoryDTO,
} from '@/services/types/domain/association-category-types'

import {ReportCategoriesManager} from './report-categories-manager'

const ORG_ID = '11111111-1111-4111-8111-111111111111'

const category = (
  overrides: Partial<ManagedCategoryDTO> = {}
): ManagedCategoryDTO => ({
  id: '33333333-3333-4333-8333-333333333333',
  organizationId: ORG_ID,
  domain: 'report',
  name: "Fuite d'eau",
  routingEmail: null,
  createdAt: new Date('2026-09-01T08:00:00Z'),
  usageCount: 0,
  ...overrides,
})

const listOf = (items: ManagedCategoryDTO[]): AssociationCategoryListDTO => ({
  items,
  max: 10,
})

const tenCategories = () =>
  Array.from({length: 10}, (_, index) =>
    category({
      id: `33333333-3333-4333-8333-3333333333${String(index).padStart(2, '0')}`,
      name: `Catégorie ${index + 1}`,
    })
  )

const actions = {
  createAction: vi.fn(),
  updateAction: vi.fn(),
  deleteAction: vi.fn(),
}

const renderManager = (items: ManagedCategoryDTO[]) =>
  render(<ReportCategoriesManager list={listOf(items)} {...actions} />)

const tableRows = () =>
  within(screen.getByRole('table')).getAllByRole('row').slice(1)

beforeEach(() => {
  vi.clearAllMocks()
  actions.createAction.mockResolvedValue({status: 'saved', name: 'Voirie'})
  actions.updateAction.mockResolvedValue({status: 'saved', name: 'Voirie'})
  actions.deleteAction.mockResolvedValue({status: 'deleted'})
})

describe('ReportCategoriesManager — écran 4 du design s10', () => {
  it('titre l’écran, compte les places et garde le bouton d’ajout actif', () => {
    renderManager([category()])

    expect(
      screen.getByRole('heading', {level: 1, name: 'Catégories de signalement'})
    ).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Signalements'})).toHaveAttribute(
      'href',
      '/bureau/signalements'
    )
    expect(
      screen.getByText('1 catégorie sur 10 possibles.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Ajouter une catégorie'})
    ).toBeEnabled()
  })

  it('écrit « Aucune » pour une adresse absente, l’adresse telle quelle sinon (critère 6)', () => {
    renderManager([
      category(),
      category({
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Voirie et chemins',
        routingEmail: 'voirie@amis-etang.test',
      }),
    ])

    const [first, second] = tableRows()
    expect(within(first).getAllByRole('cell')[1]).toHaveTextContent(/^Aucune$/)
    expect(within(second).getAllByRole('cell')[1]).toHaveTextContent(
      /^voirie@amis-etang\.test$/
    )
  })

  it('ne désactive jamais le bouton d’ajout, et oppose le plafond en alert sous le titre (4.E)', async () => {
    const user = userEvent.setup()
    renderManager(tenCategories())

    const add = screen.getByRole('button', {name: 'Ajouter une catégorie'})
    expect(add).toBeEnabled()
    expect(add).not.toHaveAttribute('aria-disabled')

    await user.click(add)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Vous avez déjà 10 catégories, le maximum. Supprimez-en une avant d’en ajouter une autre.'
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('rend l’alert du plafond quand le serveur refuse la 11ᵉ', async () => {
    actions.createAction.mockResolvedValue({status: 'limit_reached', max: 10})
    const user = userEvent.setup()
    renderManager([category()])

    await user.click(
      screen.getByRole('button', {name: 'Ajouter une catégorie'})
    )
    await user.type(
      within(screen.getByRole('dialog')).getByRole('textbox', {
        name: 'Nom de la catégorie',
      }),
      'Onzième'
    )
    await user.click(
      screen.getByRole('button', {name: 'Enregistrer la catégorie'})
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Vous avez déjà 10 catégories, le maximum.'
    )
  })

  it('ajoute une catégorie : nom compté sur 40, adresse facultative expliquée', async () => {
    const user = userEvent.setup()
    renderManager([])

    await user.click(
      screen.getByRole('button', {name: 'Ajouter une catégorie'})
    )
    const dialog = screen.getByRole('dialog', {name: 'Ajouter une catégorie'})
    const name = within(dialog).getByRole('textbox', {
      name: 'Nom de la catégorie',
    })
    await user.type(name, 'Voirie')

    expect(within(dialog).getByText('6 / 40')).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        'Les signalements de cette catégorie sont aussi envoyés à cette adresse, en plus de l’adresse de contact des Réglages.'
      )
    ).toBeInTheDocument()
    expect(within(dialog).getByText('Facultatif')).toBeInTheDocument()

    await user.click(
      within(dialog).getByRole('button', {name: 'Enregistrer la catégorie'})
    )

    const [, formData] = actions.createAction.mock.calls[0]
    expect(formData.get('name')).toBe('Voirie')
    expect(formData.get('routingEmail')).toBe('')
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Catégorie « Voirie » enregistrée.'
    )
  })

  it('refuse dans le dialog un nom vide et une adresse mal formée, sans appeler l’action', async () => {
    const user = userEvent.setup()
    renderManager([])

    await user.click(
      screen.getByRole('button', {name: 'Ajouter une catégorie'})
    )
    const dialog = screen.getByRole('dialog')
    await user.type(
      within(dialog).getByRole('textbox', {name: /Adresse de routage/}),
      'espaces-verts@'
    )
    await user.click(
      within(dialog).getByRole('button', {name: 'Enregistrer la catégorie'})
    )

    expect(
      await within(dialog).findByText('Donnez un nom à la catégorie.')
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        'Cette adresse semble incomplète. Corrigez-la, ou laissez le champ vide.'
      )
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText('La catégorie n’a pas été enregistrée.')
    ).toBeInTheDocument()
    expect(actions.createAction).not.toHaveBeenCalled()
  })

  it('dit sous le nom qu’une catégorie porte déjà ce nom', async () => {
    actions.createAction.mockResolvedValue({
      status: 'invalid',
      errors: [{field: 'name', message: 'Une catégorie porte déjà ce nom.'}],
    })
    const user = userEvent.setup()
    renderManager([category({name: 'Nuisance'})])

    await user.click(
      screen.getByRole('button', {name: 'Ajouter une catégorie'})
    )
    const dialog = screen.getByRole('dialog')
    const name = within(dialog).getByRole('textbox', {
      name: 'Nom de la catégorie',
    })
    await user.type(name, 'nuisance')
    await user.click(
      within(dialog).getByRole('button', {name: 'Enregistrer la catégorie'})
    )

    expect(
      await within(dialog).findByText('Une catégorie porte déjà ce nom.')
    ).toBeInTheDocument()
    expect(name).toHaveAttribute('aria-invalid', 'true')
  })

  it('relit l’adresse inchangée dans le dialog de modification (critère 6)', async () => {
    const user = userEvent.setup()
    renderManager([
      category({name: 'Voirie et chemins', routingEmail: 'voirie@x.test'}),
    ])

    await user.click(screen.getAllByRole('button', {name: 'Modifier'})[0])
    const dialog = screen.getByRole('dialog', {name: 'Modifier la catégorie'})

    expect(
      within(dialog).getByRole('textbox', {name: 'Nom de la catégorie'})
    ).toHaveValue('Voirie et chemins')
    expect(
      within(dialog).getByRole('textbox', {name: /Adresse de routage/})
    ).toHaveValue('voirie@x.test')
  })

  it('annonce, avant de supprimer, combien de signalements sont conservés (critère 5)', async () => {
    const user = userEvent.setup()
    renderManager([category({name: 'Nuisance', usageCount: 3})])

    await user.click(screen.getAllByRole('button', {name: 'Modifier'})[0])
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Supprimer la catégorie',
      })
    )

    const confirm = await screen.findByRole('alertdialog')
    expect(confirm).toHaveTextContent('Supprimer la catégorie « Nuisance » ?')
    expect(confirm).toHaveTextContent(
      'Les 3 signalements déjà reçus dans cette catégorie sont conservés.'
    )

    await user.click(
      within(confirm).getByRole('button', {name: 'Supprimer la catégorie'})
    )

    expect(actions.deleteAction).toHaveBeenCalledWith(
      '33333333-3333-4333-8333-333333333333'
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Catégorie « Nuisance » supprimée.'
    )
  })

  it('état vide : le formulaire du site fonctionne sans (4.F)', () => {
    renderManager([])

    expect(
      screen.getByText('0 catégorie sur 10 possibles.')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Aucune catégorie. Le formulaire du site fonctionne sans, mais vos visiteurs ne pourront pas préciser ce qu’ils signalent.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('ReportCategoriesManager — paramétré pour les sujets des questions (s23, écran D)', () => {
  const INTRO =
    'Chaque question part vers l’adresse de son sujet. Un sujet sans adresse envoie à l’adresse de contact de l’association (contact@techcorp.test).'

  const renderQuestionManager = (items: ManagedCategoryDTO[]) =>
    render(
      <ReportCategoriesManager
        list={listOf(items.map((item) => ({...item, domain: 'question'})))}
        labels="BureauQuestionCategoriesPage"
        backHref="/bureau/questions"
        intro={INTRO}
        showUsageCount
        {...actions}
      />
    )

  it('D1 : titre « Sujets des questions », retour aux questions, phrase de routage, compteur', () => {
    renderQuestionManager([category({name: 'Voirie et portails'})])

    expect(
      screen.getByRole('heading', {level: 1, name: 'Sujets des questions'})
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Questions des membres'})
    ).toHaveAttribute('href', '/bureau/questions')
    expect(screen.getByText(INTRO)).toBeInTheDocument()
    expect(screen.getByText('1 sur 10')).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Ajouter un sujet'})).toBeEnabled()
  })

  it('D1 : une adresse vide se lit « Adresse de contact », chaque ligne dit son nombre de questions', () => {
    renderQuestionManager([
      category({usageCount: 0}),
      category({
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Factures et cotisation',
        routingEmail: 'tresorerie@techcorp.test',
        usageCount: 4,
      }),
    ])

    const [first, second] = tableRows()
    expect(within(first).getAllByRole('cell')[1]).toHaveTextContent(
      /^Adresse de contact$/
    )
    expect(within(first).getAllByRole('cell')[2]).toHaveTextContent(
      /^0 question$/
    )
    expect(within(second).getAllByRole('cell')[1]).toHaveTextContent(
      /^tresorerie@techcorp\.test$/
    )
    expect(within(second).getAllByRole('cell')[2]).toHaveTextContent(
      /^4 questions$/
    )
  })

  it('D2 : le 11ᵉ sujet est refusé avec le message explicite (critère 3)', async () => {
    const user = userEvent.setup()
    renderQuestionManager(tenCategories())

    await user.click(screen.getByRole('button', {name: 'Ajouter un sujet'}))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Vous avez déjà 10 sujets, le maximum. Supprimez-en un avant d’en ajouter un autre.'
    )
  })

  it('D2 : le refus du serveur pour le 11ᵉ sujet est dit de même', async () => {
    actions.createAction.mockResolvedValue({status: 'limit_reached', max: 10})
    const user = userEvent.setup()
    renderQuestionManager([category()])

    await user.click(screen.getByRole('button', {name: 'Ajouter un sujet'}))
    const dialog = screen.getByRole('dialog', {name: 'Ajouter un sujet'})
    await user.type(
      within(dialog).getByRole('textbox', {name: 'Nom du sujet'}),
      'Onzième'
    )
    expect(
      within(dialog).getByText(
        'Laissée vide : l’adresse de contact de l’association.'
      )
    ).toBeInTheDocument()
    await user.click(
      within(dialog).getByRole('button', {name: 'Enregistrer le sujet'})
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Vous avez déjà 10 sujets, le maximum.'
    )
  })

  it('D2 : la suppression dit combien de questions restent consultables (critère 5)', async () => {
    const user = userEvent.setup()
    renderQuestionManager([
      category({name: 'Voirie et portails', usageCount: 4}),
    ])

    await user.click(screen.getAllByRole('button', {name: 'Modifier'})[0])
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Supprimer le sujet',
      })
    )

    const confirm = await screen.findByRole('alertdialog')
    expect(confirm).toHaveTextContent('Supprimer « Voirie et portails » ?')
    expect(confirm).toHaveTextContent(
      'Les 4 questions déjà reçues dans ce sujet restent consultables, avec la mention « catégorie supprimée ».'
    )

    await user.click(
      within(confirm).getByRole('button', {name: 'Supprimer le sujet'})
    )

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Sujet « Voirie et portails » supprimé.'
    )
  })
})
