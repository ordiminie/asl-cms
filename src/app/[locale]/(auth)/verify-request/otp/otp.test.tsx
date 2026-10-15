import {describe, expect, it, vi} from 'vitest'

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  searchParams: new URLSearchParams(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({push: navigation.push, replace: vi.fn()}),
  useSearchParams: () => navigation.searchParams,
}))
vi.mock('@/lib/better-auth/auth-client', () => ({
  authClient: {twoFactor: {sendOtp: vi.fn(async () => ({error: null}))}},
}))
vi.mock('@/app/[locale]/(auth)/action', () => ({verifyOTPAction: vi.fn()}))

import {render, screen, waitFor} from '@/__tests__/customRender'
import {verifyOTPAction} from '@/app/[locale]/(auth)/action'

import OtpVerificationPage from './otp'

describe('OtpVerificationPage — pages légales retirées (s45, décision F)', () => {
  it('ne lie ni conditions ni confidentialité', () => {
    render(<OtpVerificationPage />)

    expect(document.querySelector('a[href="/terms"]')).toBeNull()
    expect(document.querySelector('a[href="/privacy"]')).toBeNull()
    expect(screen.queryByText(/vous acceptez/)).toBeNull()
  })
})

describe('OtpVerificationPage — destination (s46b, décision F)', () => {
  it('mène à la route de passage après un code valide', async () => {
    navigation.searchParams = new URLSearchParams({code: '123456'})
    vi.mocked(verifyOTPAction).mockResolvedValue({success: true})

    render(<OtpVerificationPage />)

    await waitFor(
      () => expect(navigation.push).toHaveBeenCalledWith('/login/destination'),
      {timeout: 4000}
    )
  })
})
