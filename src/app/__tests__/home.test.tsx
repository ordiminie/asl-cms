import {screen} from '@testing-library/react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import {render} from '@/__tests__/customRender'
import Home from '@/app/[locale]/page'

// Mock du composant ButtonConnexionDashboard pour les tests car c'est un RSC
vi.mock('@/components/features/auth/button-connexion-dashboard', () => ({
  default: () => <button>Connexion Dashboard Mock</button>,
}))
//pas de tests pour les RSC faire que des RCC
describe.skip("Page d'accueil", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it("affiche le texte d'introduction", async () => {
    render(<Home params={Promise.resolve({locale: 'fr'})} />)

    expect(
      screen.getByText(/La plateforme SaaS moderne pour booster votre business/)
    ).toBeInTheDocument()
    expect(screen.getByText(/By Mike Codeur/)).toBeInTheDocument()
  })

  it('affiche les liens de navigation du CTA', () => {
    render(<Home params={Promise.resolve({locale: 'fr'})} />)
    expect(screen.getByText(/Essayez gratuitement/)).toBeInTheDocument()
  })

  it('affiche les liens du footer', () => {
    render(<Home params={Promise.resolve({locale: 'fr'})} />)
    expect(screen.getByText(/Mentions légales/)).toBeInTheDocument()
    expect(screen.getByText(/Politique de confidentialité/)).toBeInTheDocument()
    expect(screen.getByText(/Recrutement/)).toBeInTheDocument()
  })

  it('affiche le bouton de connexion dashboard mocké', () => {
    render(<Home params={Promise.resolve({locale: 'fr'})} />)
    expect(screen.getByText(/Dashboard/)).toBeInTheDocument()
  })
})
