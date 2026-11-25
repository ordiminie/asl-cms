import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import type {DocumentTemplateListItemDTO} from '@/services/types/domain/document-template-types'

import {DocumentTemplateForm} from './document-template-form'
import {
  DocumentTemplateList,
  DocumentTemplateListError,
} from './document-template-list'

const TEMPLATE_ID = '33333333-3333-4333-8333-333333333333'

const TEMPLATES: DocumentTemplateListItemDTO[] = [
  {
    id: TEMPLATE_ID,
    name: 'Convocation à l’assemblée générale',
    variables: ['nom', 'parcelle', 'date', 'association'],
    updatedAt: new Date('2026-11-18T10:00:00Z'),
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Procès-verbal',
    variables: [],
    updatedAt: new Date('2026-07-02T10:00:00Z'),
  },
]

const saveAction = vi.fn()
const deleteAction = vi.fn()

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
  saveAction.mockResolvedValue({status: 'idle'})
  deleteAction.mockResolvedValue({status: 'idle'})
})

describe('DocumentTemplateList — écran 1 (critère 1)', () => {
  it('1a : la liste triée, variables employées, date de modification, « Modifier »', () => {
    render(<DocumentTemplateList templates={TEMPLATES} />)

    expect(
      screen.getByRole('heading', {level: 1, name: 'Modèles de documents'})
    ).toBeInTheDocument()
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Convocation à l’assemblée générale')
    expect(rows[1]).toHaveTextContent('{nom} {parcelle} {date} {association}')
    expect(rows[1]).toHaveTextContent('18/11/2026')
    expect(rows[2]).toHaveTextContent('Aucune')
    expect(
      within(rows[1]).getByRole('link', {name: 'Modifier'})
    ).toHaveAttribute('href', `/bureau/modeles-documents/${TEMPLATE_ID}`)
    expect(
      screen.getAllByRole('link', {name: 'Créer un modèle'})[0]
    ).toHaveAttribute('href', '/bureau/modeles-documents/nouveau')
    expect(
      screen.getAllByRole('link', {name: 'Générer en lot'})[0]
    ).toHaveAttribute('href', '/bureau/modeles-documents/lot')
  })

  it('1b : sans modèle, ce qui manque et l’action pour le combler, pas de lot', () => {
    render(<DocumentTemplateList templates={[]} />)

    expect(
      screen.getByText(/Aucun modèle de document pour l’instant/)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Créer le premier modèle'})
    ).toHaveAttribute('href', '/bureau/modeles-documents/nouveau')
    expect(screen.queryByRole('link', {name: 'Générer en lot'})).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('1e : la suppression dite en tête, sans nom venu de l’URL', () => {
    render(<DocumentTemplateList templates={TEMPLATES} deleted />)

    expect(screen.getByRole('status')).toHaveTextContent('Modèle supprimé.')
  })

  it('1d : la lecture en échec dit que rien n’est perdu', () => {
    render(<DocumentTemplateListError />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La liste des modèles n’a pas pu être lue.'
    )
  })
})

const nameField = () => screen.getByRole('textbox', {name: 'Nom du modèle'})
const subjectField = () => screen.getByRole('textbox', {name: 'Objet'})
const bodyField = () => screen.getByRole('textbox', {name: 'Texte du document'})
const submitButton = () =>
  screen.getByRole('button', {name: /Enregistrer le modèle|Enregistrement…/})

const fill = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(nameField(), 'Convocation AG')
  await user.type(subjectField(), 'Convocation')
  await user.type(bodyField(), 'Bonjour à {{adresse}, le {{date_ag}.')
}

describe('DocumentTemplateForm — écran 2 (critères 1 et 4)', () => {
  it('2a : trois champs, les quatre variables listées, pas de suppression pour un nouveau modèle', () => {
    render(<DocumentTemplateForm saveAction={saveAction} />)

    expect(
      screen.getByRole('heading', {level: 1, name: 'Nouveau modèle'})
    ).toBeInTheDocument()
    expect(nameField()).toHaveValue('')
    for (const variable of ['{nom}', '{parcelle}', '{date}', '{association}']) {
      expect(screen.getByText(variable)).toBeInTheDocument()
    }
    expect(
      screen.queryByRole('button', {name: 'Supprimer le modèle'})
    ).toBeNull()
  })

  it('envoie les trois champs en une soumission', async () => {
    const user = userEvent.setup()
    render(<DocumentTemplateForm saveAction={saveAction} />)

    await fill(user)
    await user.click(submitButton())

    expect(saveAction).toHaveBeenCalledTimes(1)
    const formData = saveAction.mock.calls[0][1] as FormData
    expect(formData.get('name')).toBe('Convocation AG')
    expect(formData.get('subject')).toBe('Convocation')
    expect(formData.get('bodyMarkdown')).toBe(
      'Bonjour à {adresse}, le {date_ag}.'
    )
    expect(formData.get('templateId')).toBeNull()
  })

  it('2b : refus serveur — le message de champ nomme {adresse} et {date_ag}, focus sur le résumé', async () => {
    saveAction.mockResolvedValue({
      status: 'rejected',
      issues: {
        bodyMarkdown: {
          code: 'unknownVariables',
          variables: ['adresse', 'date_ag'],
        },
      },
    })
    const user = userEvent.setup()
    render(<DocumentTemplateForm saveAction={saveAction} />)

    await fill(user)
    await user.click(submitButton())

    const summary = await screen.findByRole('alert')
    expect(summary).toHaveTextContent('Le modèle n’a pas été enregistré.')
    expect(
      within(summary).getByRole('link', {
        name: 'Texte du document : variables inconnues {adresse} et {date_ag}.',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Variables inconnues : {adresse} et {date_ag}. Les variables possibles sont {nom}, {parcelle}, {date} et {association}.'
      )
    ).toBeInTheDocument()
    expect(summary).toHaveFocus()
    expect(bodyField()).toHaveValue('Bonjour à {adresse}, le {date_ag}.')
  })

  it('une seule variable inconnue dans l’objet : au singulier', async () => {
    saveAction.mockResolvedValue({
      status: 'rejected',
      issues: {subject: {code: 'unknownVariables', variables: ['adresse']}},
    })
    const user = userEvent.setup()
    render(<DocumentTemplateForm saveAction={saveAction} />)

    await fill(user)
    await user.click(submitButton())

    expect(
      await screen.findByText(
        'Variable inconnue : {adresse}. Les variables possibles sont {nom}, {parcelle}, {date} et {association}.'
      )
    ).toBeInTheDocument()
  })

  it('nom vide : refusé dans le navigateur, rien n’est envoyé', async () => {
    const user = userEvent.setup()
    render(<DocumentTemplateForm saveAction={saveAction} />)

    await user.click(submitButton())

    const summary = await screen.findByRole('alert')
    expect(summary).toHaveTextContent('Saisissez le nom du modèle.')
    expect(saveAction).not.toHaveBeenCalled()
  })

  it('2d et 2e : modèle enregistré — succès, lot présélectionné, suppression confirmée', async () => {
    const user = userEvent.setup()
    render(
      <DocumentTemplateForm
        template={{
          id: TEMPLATE_ID,
          name: 'Convocation AG',
          subject: 'Convocation',
          bodyMarkdown: 'Bonjour {nom}',
          updatedAt: new Date(),
        }}
        saved
        saveAction={saveAction}
        deleteAction={deleteAction}
      />
    )

    expect(screen.getByRole('status')).toHaveTextContent('Modèle enregistré.')
    expect(
      screen.getByRole('link', {name: 'Générer en lot avec ce modèle'})
    ).toHaveAttribute(
      'href',
      `/bureau/modeles-documents/lot?modele=${TEMPLATE_ID}`
    )

    await user.click(screen.getByRole('button', {name: 'Supprimer le modèle'}))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Supprimer le modèle « Convocation AG » ?')
    await user.click(
      within(dialog).getByRole('button', {name: 'Supprimer le modèle'})
    )

    expect(deleteAction).toHaveBeenCalledWith(TEMPLATE_ID)
  })

  it('un modèle existant envoie son identifiant', async () => {
    const user = userEvent.setup()
    render(
      <DocumentTemplateForm
        template={{
          id: TEMPLATE_ID,
          name: 'Convocation AG',
          subject: 'Convocation',
          bodyMarkdown: 'Bonjour {nom}',
          updatedAt: new Date(),
        }}
        saveAction={saveAction}
        deleteAction={deleteAction}
      />
    )

    await user.click(submitButton())

    const formData = saveAction.mock.calls[0][1] as FormData
    expect(formData.get('templateId')).toBe(TEMPLATE_ID)
  })
})
