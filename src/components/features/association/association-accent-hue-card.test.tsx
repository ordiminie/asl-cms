import {describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import type {AssociationAccentHueFormState} from '@/app/[locale]/(bureau)/bureau/identite/actions'
import {AccentHue} from '@/services/types/domain/association-settings-types'

import {
  AssociationAccentHueCard,
  AssociationAccentHueSaveAction,
} from './association-accent-hue-card'

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const savedTile: AssociationAccentHueSaveAction = vi.fn(
  async (): Promise<AssociationAccentHueFormState> => ({
    success: true,
    accentHue: 40,
    message:
      'Teinte Tuile enregistrée. Visible sur votre site et dans cet espace.',
  })
)

const hueCard = (
  saveAction: AssociationAccentHueSaveAction = savedTile,
  appliedHue: AccentHue = 195,
  hasChosenHue = false
) =>
  render(
    <AssociationAccentHueCard
      associationName="ASL Les Pins"
      appliedHue={appliedHue}
      hasChosenHue={hasChosenHue}
      saveAction={saveAction}
    />
  )

const preview = () => screen.getByTestId('accent-hue-preview')
const hueOf = (element: HTMLElement) =>
  element.style.getPropertyValue('--accent-hue')

describe('AssociationAccentHueCard — six teintes, jamais de selecteur libre', () => {
  it('propose exactement les six teintes validees, chacune nommee', () => {
    hueCard()

    const group = screen.getByRole('radiogroup', {name: 'Teinte'})
    expect(within(group).getAllByRole('radio')).toHaveLength(6)
    for (const name of ['Eau', 'Pins', 'Lac', 'Tuile', 'Bruyère', 'Genêt']) {
      expect(within(group).getByRole('radio', {name: new RegExp(name)}))
    }
    expect(document.querySelector('input[type="color"]')).toBeNull()
  })

  it('chaque pastille porte sa propre teinte', () => {
    hueCard()

    const swatches = screen.getAllByTestId('accent-hue-swatch')
    expect(swatches.map(hueOf)).toEqual([
      '195',
      '150',
      '255',
      '40',
      '300',
      '95',
    ])
    for (const swatch of swatches) {
      expect(swatch).toHaveClass('bg-accent-solid')
    }
  })

  it('« Eau » porte la mention « par défaut »', () => {
    hueCard()

    expect(
      screen.getByRole('radio', {name: /Eau/}).closest('label')
    ).toHaveTextContent('par défaut')
  })
})

describe('AssociationAccentHueCard — etats', () => {
  it('vide : Eau selectionnee, et la ligne d etat le dit', () => {
    hueCard()

    expect(screen.getByRole('radio', {name: /Eau/})).toBeChecked()
    expect(
      screen.getByText(
        "Aucune teinte choisie pour l'instant : la teinte Eau, par défaut, est appliquée."
      )
    ).toHaveAttribute('aria-live', 'polite')
    expect(hueOf(preview())).toBe('195')
  })

  it('selection non enregistree : l apercu suit, la ligne d etat le dit', async () => {
    hueCard()

    await userEvent.click(screen.getByRole('radio', {name: /Tuile/}))

    expect(
      screen.getByText('Teinte Tuile sélectionnée, pas encore enregistrée.')
    ).toBeInTheDocument()
    expect(hueOf(preview())).toBe('40')
    expect(savedTile).not.toHaveBeenCalled()
  })

  it('l apercu montre le monogramme de l association', () => {
    hueCard()

    expect(within(preview()).getByText('ASL Les Pins')).toBeInTheDocument()
  })

  it('succes : alerte neutre, la teinte enregistree devient la teinte appliquee', async () => {
    const saveAction = vi.fn(savedTile)
    hueCard(saveAction)

    await userEvent.click(screen.getByRole('radio', {name: /Tuile/}))
    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer la teinte'})
    )

    expect(
      await screen.findByText(
        'Teinte Tuile enregistrée. Visible sur votre site et dans cet espace.'
      )
    ).toBeInTheDocument()
    expect(saveAction.mock.calls[0][1].get('accentHue')).toBe('40')
    expect(screen.getByText('Teinte Tuile appliquée.')).toBeInTheDocument()
  })

  it('erreur : alerte ancree, l ancienne teinte reste appliquee', async () => {
    const saveAction = vi.fn(
      async (): Promise<AssociationAccentHueFormState> => ({
        success: false,
        message: "La teinte n'a pas été enregistrée.",
      })
    )
    hueCard(saveAction)

    await userEvent.click(screen.getByRole('radio', {name: /Tuile/}))
    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer la teinte'})
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      "La teinte n'a pas été enregistrée. La teinte Eau reste appliquée. Réessayez dans un instant."
    )
    expect(
      within(alert).getByText('La teinte Eau reste appliquée.').tagName
    ).toBe('STRONG')
  })

  it('chargement : bouton desactive, libelle d attente', async () => {
    const saveAction = vi.fn(
      () => new Promise<AssociationAccentHueFormState>(() => {})
    )
    hueCard(saveAction)

    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer la teinte'})
    )

    expect(
      await screen.findByRole('button', {name: 'Enregistrement…'})
    ).toBeDisabled()
  })

  it('une teinte deja choisie est selectionnee et dite appliquee', () => {
    hueCard(savedTile, 300, true)

    expect(screen.getByRole('radio', {name: /Bruyère/})).toBeChecked()
    expect(screen.getByText('Teinte Bruyère appliquée.')).toBeInTheDocument()
  })
})
