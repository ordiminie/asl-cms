import {describe, expect, it} from 'vitest'

import {render, screen} from '@/__tests__/customRender'

import {SearchPreview} from './search-preview'

describe('SearchPreview — apercu « Dans Google » (s11)', () => {
  it('montre l adresse, le titre et la description', () => {
    render(
      <SearchPreview
        host="lesamisdeletang.fr"
        path={['qualite-de-l-eau']}
        title="Qualité de l’eau"
        description="Résultats des analyses du réseau."
      />
    )

    expect(screen.getByText('Dans Google')).toBeInTheDocument()
    expect(
      screen.getByText('lesamisdeletang.fr › qualite-de-l-eau')
    ).toBeInTheDocument()
    expect(screen.getByText('Qualité de l’eau')).toBeInTheDocument()
    expect(
      screen.getByText('Résultats des analyses du réseau.')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Google peut raccourcir ces textes ou en choisir d’autres.'
      )
    ).toBeInTheDocument()
  })

  it('sans description : dit que Google choisira un extrait', () => {
    render(
      <SearchPreview
        host="lesamisdeletang.fr"
        path={['actualites', 'fete']}
        title="Fête"
      />
    )

    expect(
      screen.getByText('lesamisdeletang.fr › actualites › fete')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Extrait choisi par Google dans la page.')
    ).toBeInTheDocument()
  })
})
