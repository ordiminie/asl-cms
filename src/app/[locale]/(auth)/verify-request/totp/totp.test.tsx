import {describe, expect, it, vi} from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({push: vi.fn(), replace: vi.fn()}),
}))
vi.mock('@/lib/better-auth/auth-client', () => ({
  authClient: {twoFactor: {verifyTotp: vi.fn()}},
}))

import {render, screen} from '@/__tests__/customRender'

import TotpVerificationPage from './totp'

describe('TotpVerificationPage — pages légales retirées (s45, décision F)', () => {
  it('ne lie ni conditions ni confidentialité', () => {
    render(<TotpVerificationPage />)

    expect(document.querySelector('a[href="/terms"]')).toBeNull()
    expect(document.querySelector('a[href="/privacy"]')).toBeNull()
    expect(screen.queryByText(/vous acceptez/)).toBeNull()
  })
})
