import {describe, expect, it} from 'vitest'

import {render, screen} from '@/__tests__/customRender'

import {InvalidMagicLink} from './invalid-magic-link'

describe('InvalidMagicLink — écran C', () => {
  it('rassure, explique, et propose un nouveau lien', () => {
    render(<InvalidMagicLink />)

    expect(
      screen.getByRole('heading', {level: 1, name: 'Ce lien ne fonctionne plus'})
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Vous n'avez rien fait de mal/).closest('p')
    ).toHaveTextContent(
      "Vous n'avez rien fait de mal : il suffit d'en demander un nouveau."
    )
    expect(
      screen.getByText(
        "Un lien de connexion ne sert qu'une fois et reste valable 20 minutes. C'est ce qui protège votre espace, même si quelqu'un d'autre ouvre votre boîte mail."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Recevoir un nouveau lien'})
    ).toHaveAttribute('href', '/login')
    expect(
      screen.getByText("Besoin d'aide ? Appelez le bureau de votre association.")
    ).toBeInTheDocument()
  })

  it('n’affiche aucun code d’erreur', () => {
    render(<InvalidMagicLink />)

    expect(document.body.textContent).not.toMatch(/INVALID_TOKEN|error/i)
  })
})
