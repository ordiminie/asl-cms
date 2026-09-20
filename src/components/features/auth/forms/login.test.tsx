import {describe, expect, it, vi} from 'vitest'

import {render, screen} from '@/__tests__/customRender'

vi.mock('@/app/[locale]/(auth)/action', () => ({
  loginCredentialAction: vi.fn(),
}))

import {LoginForm} from './login'

describe('LoginForm — accès prestataire (mot de passe)', () => {
  it('présente le formulaire adresse + mot de passe', () => {
    render(<LoginForm />)

    expect(document.querySelector('input[name="email"]')).not.toBeNull()
    expect(document.querySelector('input[type="password"]')).not.toBeNull()
    expect(screen.getAllByRole('button', {name: /./})).toHaveLength(1)
  })

  it('ne propose ni inscription ni lien magique ni fournisseur', () => {
    render(<LoginForm />)

    expect(document.querySelector('a[href="/register"]')).toBeNull()
    expect(screen.queryByText(/lien magique/i)).toBeNull()
    expect(screen.queryByText(/Google|Apple|GitHub/)).toBeNull()
  })
})
