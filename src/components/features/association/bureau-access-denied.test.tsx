import {describe, expect, it} from 'vitest'

import {render, screen} from '@/__tests__/customRender'

import {BureauAccessDenied} from './bureau-access-denied'

describe('BureauAccessDenied — ecran B', () => {
  it('dit que la page est reservee au bureau, et propose de revenir a l accueil', () => {
    render(<BureauAccessDenied />)

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: "Cette page est réservée au bureau de l'association",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Si vous pensez devoir y accéder, adressez-vous à un membre du bureau.'
      )
    ).toBeInTheDocument()
    const back = screen.getByRole('link', {name: "Revenir à l'accueil"})
    expect(back).toHaveAttribute('href', '/')
    expect(back).not.toHaveClass('bg-primary')
  })

  it('n expose aucune rubrique d administration', () => {
    render(<BureauAccessDenied />)

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.queryByText('Identité')).not.toBeInTheDocument()
  })
})

describe('BureauAccessDenied — refus d’une page du back-office (s56, 1f)', () => {
  it('rend le texte et le lien de retour passés, sans quitter la barre latérale', () => {
    render(
      <BureauAccessDenied
        namespace="BureauMemberAnnualImport.denied"
        backHref="/bureau/proprietaires"
      />
    )

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Cette page ne vous est pas accessible',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'La mise à jour des coordonnées depuis le fichier de l’année est réservée à la présidence de l’association. Pour corriger une fiche, ouvrez-la depuis la liste des propriétaires.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Revenir aux propriétaires'})
    ).toHaveAttribute('href', '/bureau/proprietaires')
  })
})
