import {describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent} from '@/__tests__/customRender'

import {MemberImportForm} from './member-import-form'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const ORGANIZATIONS = [
  {id: ORG_ID, name: 'Rives Vertes'},
  {id: '22222222-2222-4222-8222-222222222222', name: 'Clos Fictif'},
]

const csv = () =>
  new File(['a;b\n1;2\n'], 'proprietaires-fictifs.csv', {type: 'text/csv'})

const renderForm = (
  props: Partial<React.ComponentProps<typeof MemberImportForm>> = {}
) => {
  const formAction = vi.fn()
  render(
    <MemberImportForm
      organizations={ORGANIZATIONS}
      formAction={formAction}
      pending={false}
      {...props}
    />
  )
  return {formAction}
}

const submitButton = () =>
  screen.getByRole('button', {name: 'Importer les membres'})

const fileInput = () => screen.getByLabelText('Fichier CSV des membres')

describe('MemberImportForm — écran 1', () => {
  it('1a : sans association ni fichier, le bouton est désactivé et le dit', () => {
    renderForm()

    expect(submitButton()).toBeDisabled()
    expect(
      screen.getByText(
        'Choisissez une association et un fichier pour continuer.'
      )
    ).toBeInTheDocument()
  })

  it('reste désactivé avec l’association seule', () => {
    renderForm({initialOrganizationId: ORG_ID})

    expect(submitButton()).toBeDisabled()
  })

  it('1b : association choisie et fichier déposé, envoie les deux', async () => {
    const {formAction} = renderForm({initialOrganizationId: ORG_ID})

    await userEvent.upload(fileInput(), csv())
    expect(screen.getByText('proprietaires-fictifs.csv')).toBeInTheDocument()
    expect(submitButton()).toBeEnabled()
    expect(
      screen.queryByText(
        'Choisissez une association et un fichier pour continuer.'
      )
    ).toBeNull()

    await userEvent.click(submitButton())

    const [formData] = formAction.mock.calls[0] as [FormData]
    expect(formData.get('organizationId')).toBe(ORG_ID)
    expect((formData.get('file') as File).name).toBe(
      'proprietaires-fictifs.csv'
    )
  })

  it('1c : pendant l’import, le formulaire est figé et la barre nomme le fichier', async () => {
    renderForm({initialOrganizationId: ORG_ID, pending: true})

    expect(
      screen.getByRole('button', {name: 'Import en cours…'})
    ).toBeDisabled()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('1d : fichier illisible, la cause et « Rien n’a été importé. »', () => {
    renderForm({
      initialOrganizationId: ORG_ID,
      state: {
        success: false,
        error: 'file_unreadable',
        title: 'Le fichier n’a pas pu être lu.',
        message: 'Rien n’a été importé.',
        detail: 'Il manque la colonne « Référence Client ».',
        nextStep: 'Choisissez un autre fichier.',
      },
    })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Le fichier n’a pas pu être lu.')
    expect(alert).toHaveTextContent('Rien n’a été importé.')
    expect(alert).toHaveTextContent(
      'Il manque la colonne « Référence Client ».'
    )
  })

  it('1e : association disparue, signalée sur le champ', () => {
    renderForm({
      initialOrganizationId: ORG_ID,
      state: {
        success: false,
        error: 'organization_missing',
        title: 'Cette association n’existe plus.',
        message: 'Rien n’a été importé.',
        nextStep: 'Choisissez une autre association.',
      },
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Cette association n’existe plus.'
    )
    expect(
      screen.getByText(
        'Cette association n’existe plus. Choisissez-en une autre.'
      )
    ).toBeInTheDocument()
  })

  it('1f : erreur inattendue, avec « Réessayer »', () => {
    renderForm({
      initialOrganizationId: ORG_ID,
      state: {
        success: false,
        error: 'failed',
        message:
          'L’import s’est arrêté. Les lignes déjà traitées sont enregistrées ; relancer le même fichier termine le travail sans rien doubler.',
      },
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'L’import s’est arrêté.'
    )
    expect(screen.getByRole('button', {name: 'Réessayer'})).toBeInTheDocument()
  })

  it('« Annuler » renvoie à la fiche de l’association choisie', () => {
    renderForm({initialOrganizationId: ORG_ID})

    expect(screen.getByRole('link', {name: 'Annuler'})).toHaveAttribute(
      'href',
      `/admin/organizations/${ORG_ID}/edit`
    )
  })
})
