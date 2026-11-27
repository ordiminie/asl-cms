import {describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent} from '@/__tests__/customRender'

import {AnnualImportForm} from './annual-import-form'

const csv = () =>
  new File(['a;b\n1;2\n'], 'clients-pennylane-2026.csv', {type: 'text/csv'})

const renderForm = (
  props: Partial<React.ComponentProps<typeof AnnualImportForm>> = {}
) => {
  const formAction = vi.fn()
  const view = render(
    <AnnualImportForm formAction={formAction} pending={false} {...props} />
  )
  return {formAction, ...view}
}

const submitButton = () =>
  screen.getByRole('button', {name: 'Mettre à jour les fiches'})

const fileInput = () => screen.getByLabelText('Fichier clients de Pennylane')

describe('AnnualImportForm — écran 1 (s56)', () => {
  it('1a : sans fichier, le bouton est désactivé et le dit ; aucune carte Association', () => {
    renderForm()

    expect(submitButton()).toBeDisabled()
    expect(
      screen.getByText('Choisissez un fichier pour continuer.')
    ).toBeInTheDocument()
    expect(screen.queryByText(/Association/)).toBeNull()
    expect(screen.getByRole('link', {name: 'Annuler'})).toHaveAttribute(
      'href',
      '/bureau/proprietaires'
    )
  })

  it('1b : fichier déposé, envoie le fichier seul — jamais une association', async () => {
    const {formAction} = renderForm()

    await userEvent.upload(fileInput(), csv())
    expect(screen.getByText('clients-pennylane-2026.csv')).toBeInTheDocument()
    await userEvent.click(submitButton())

    const [formData] = formAction.mock.calls[0] as [FormData]
    expect((formData.get('file') as File).name).toBe(
      'clients-pennylane-2026.csv'
    )
    expect(formData.get('organizationId')).toBeNull()
  })

  it('1c : pendant la mise à jour, le formulaire est figé et la barre nomme le fichier', async () => {
    const {formAction, rerender} = renderForm()
    await userEvent.upload(fileInput(), csv())

    rerender(<AnnualImportForm formAction={formAction} pending />)

    expect(
      screen.getByRole('button', {name: 'Mise à jour en cours…'})
    ).toBeDisabled()
    expect(
      screen.getByRole('progressbar', {
        name: 'Mise à jour depuis clients-pennylane-2026.csv en cours…',
      })
    ).toBeInTheDocument()
  })

  it('1d : fichier illisible, l’alerte nomme la cause et dit que rien n’a changé', () => {
    renderForm({
      state: {
        success: false,
        error: 'file_unreadable',
        title: 'Le fichier n’a pas pu être lu.',
        message: 'Aucune fiche n’a été modifiée.',
        detail: 'Il manque la colonne « Identifiant Client ».',
      },
    })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Le fichier n’a pas pu être lu.')
    expect(alert).toHaveTextContent('Aucune fiche n’a été modifiée.')
    expect(alert).toHaveTextContent('« Identifiant Client »')
  })

  it('1e : arrêt en cours, « Réessayer » relance le même fichier', async () => {
    const {formAction} = renderForm({
      state: {
        success: false,
        error: 'failed',
        title: 'La mise à jour s’est arrêtée.',
        message: 'Les fiches déjà traitées sont à jour.',
      },
    })
    await userEvent.upload(fileInput(), csv())

    await userEvent.click(screen.getByRole('button', {name: 'Réessayer'}))

    expect(formAction).toHaveBeenCalledTimes(1)
  })

  it('typographie sur l’échelle du design system (revue M2)', async () => {
    const {formAction, rerender} = renderForm()
    expect(belowMetaFloor(document.body)).toEqual([])
    expect(document.querySelectorAll('.font-serif')).toHaveLength(0)

    await userEvent.upload(fileInput(), csv())
    rerender(<AnnualImportForm formAction={formAction} pending />)
    expect(belowMetaFloor(document.body)).toEqual([])
  })
})

/** Les tailles explicites sous le plancher `meta` (15 px). */
const belowMetaFloor = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('[class*="text-["]'))
    .flatMap((element) => Array.from(element.classList))
    .filter((name) => {
      const size = /^text-\[(\d+)px\]$/.exec(name)
      return size !== null && Number(size[1]) < 15
    })
