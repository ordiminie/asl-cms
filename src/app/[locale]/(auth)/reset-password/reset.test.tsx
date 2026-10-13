import {describe, expect, it, vi} from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({push: vi.fn(), replace: vi.fn()}),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/better-auth/auth-client', () => ({
  authClient: {requestPasswordReset: vi.fn(), resetPassword: vi.fn()},
}))

import {render, screen} from '@/__tests__/customRender'

import ResetPasswordPage from './reset'

describe('ResetPasswordPage — pages légales retirées (s45, décision F)', () => {
  it('ne lie ni conditions ni confidentialité', () => {
    render(<ResetPasswordPage />)

    expect(document.querySelector('a[href="/terms"]')).toBeNull()
    expect(document.querySelector('a[href="/privacy"]')).toBeNull()
    expect(screen.queryByText(/vous acceptez/)).toBeNull()
  })
})
