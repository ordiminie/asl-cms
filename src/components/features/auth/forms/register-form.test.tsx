import {describe, expect, it, vi} from 'vitest'

vi.mock('@/app/[locale]/(auth)/action', () => ({
  registerCredentialAction: vi.fn(),
  registerProviderAction: vi.fn(),
}))

import {render, screen} from '@/__tests__/customRender'

import {RegisterForm} from './register-form'

describe('RegisterForm — pages légales retirées (s45, décision F)', () => {
  it('ne lie ni conditions ni confidentialité', () => {
    render(<RegisterForm />)

    expect(document.querySelector('a[href="/terms"]')).toBeNull()
    expect(document.querySelector('a[href="/privacy"]')).toBeNull()
    expect(screen.queryByText(/vous acceptez/)).toBeNull()
  })
})
