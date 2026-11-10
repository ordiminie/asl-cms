import {describe, expect, it} from 'vitest'

import {render, screen, within} from '@/__tests__/customRender'

import {
  CampaignList,
  CampaignListError,
  CampaignListSkeleton,
} from './campaign-list'
import {campaignListOf, campaignOf} from './campaign-test-data'

const tableRows = () =>
  within(screen.getByRole('table')).getAllByRole('row').slice(1)

describe('CampaignList — écran 1 du design s25', () => {
  it('a · rempli : titre, une action « Écrire une campagne », lignes de l’archive', () => {
    render(
      <CampaignList
        list={campaignListOf([
          campaignOf('a', {
            subject: 'Convocation à l’assemblée générale',
            templateId: 'general_assembly',
          }),
          campaignOf('b'),
        ])}
      />
    )

    expect(
      screen.getByRole('heading', {level: 1, name: 'Campagnes'})
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Écrire une campagne'})
    ).toHaveAttribute('href', '/bureau/campagnes/nouvelle')
    const [first] = tableRows()
    const cells = within(first)
      .getAllByRole('cell')
      .map((cell) => cell.textContent)
    expect(cells.slice(0, 5)).toEqual([
      'Convocation à l’assemblée générale',
      '12/11/2026 à 14:32',
      'Marie Delorme',
      'Convocation à l’AG',
      '296',
    ])
    expect(
      within(first).getByRole('link', {name: 'Consulter'})
    ).toHaveAttribute('href', '/bureau/campagnes/a')
  })

  it('l’objet est montré sans le préfixe de l’association', () => {
    render(<CampaignList list={campaignListOf([campaignOf('a')])} />)

    expect(screen.queryByText(/ — Objet a/)).toBeNull()
  })

  it('rend aussi des cartes empilées pour le mobile', () => {
    render(<CampaignList list={campaignListOf([campaignOf('a')])} />)

    expect(screen.getAllByTestId('campaign-card')).toHaveLength(1)
  })

  it('pagine : précédent désactivé en page 1, suivant vers la page 2', () => {
    render(
      <CampaignList
        list={campaignListOf([campaignOf('a')], {total: 30, totalPages: 2})}
      />
    )

    expect(screen.getByRole('button', {name: 'Précédent'})).toBeDisabled()
    expect(screen.getByRole('link', {name: 'Suivant'})).toHaveAttribute(
      'href',
      '/bureau/campagnes?page=2'
    )
    expect(screen.getByText('Page 1 sur 2')).toBeInTheDocument()
  })

  it('b · vide : l’action du haut disparaît, une seule action « Écrire la première campagne »', () => {
    render(<CampaignList list={campaignListOf([])} />)

    expect(
      screen.getByText('Aucune campagne envoyée pour l’instant.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', {name: 'Écrire une campagne'})).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(
      screen.getByRole('link', {name: 'Écrire la première campagne'})
    ).toHaveAttribute('href', '/bureau/campagnes/nouvelle')
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('c · chargement : skeleton, en-tête du tableau en place', () => {
    const {container} = render(<CampaignListSkeleton />)

    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
    expect(
      screen.getByRole('columnheader', {name: 'Objet'})
    ).toBeInTheDocument()
  })

  it('d · erreur : alerte qui rassure, sans table', () => {
    render(<CampaignListError />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La liste des campagnes n’a pas pu être chargée.'
    )
    expect(screen.queryByRole('table')).toBeNull()
  })
})
