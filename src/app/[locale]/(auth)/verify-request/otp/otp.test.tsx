import {describe, expect, it, vi} from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({push: vi.fn(), replace: vi.fn()}),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/better-auth/auth-client', () => ({
  authClient: {twoFactor: {sendOtp: vi.fn(async () => ({error: null}))}},
}))
vi.mock('@/app/[locale]/(auth)/action', () => ({verifyOTPAction: vi.fn()}))

import {render, screen} from '@/__tests__/customRender'

import OtpVerificationPage from './otp'

describe('OtpVerificationPage — pages légales retirées (s45, décision F)', () => {
  it('ne lie ni conditions ni confidentialité', () => {
    render(<OtpVerificationPage />)

    expect(document.querySelector('a[href="/terms"]')).toBeNull()
    expect(document.querySelector('a[href="/privacy"]')).toBeNull()
    expect(screen.queryByText(/vous acceptez/)).toBeNull()
  })
})
