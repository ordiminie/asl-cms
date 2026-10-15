import {describe, expect, it, vi} from 'vitest'

const navigation = vi.hoisted(() => ({push: vi.fn()}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({push: navigation.push, replace: vi.fn()}),
}))
vi.mock('@/lib/better-auth/auth-client', () => ({
  authClient: {twoFactor: {verifyTotp: vi.fn()}},
}))

import {render, screen, userEvent, waitFor} from '@/__tests__/customRender'
import {authClient} from '@/lib/better-auth/auth-client'

import TotpVerificationPage from './totp'

describe('TotpVerificationPage — pages légales retirées (s45, décision F)', () => {
  it('ne lie ni conditions ni confidentialité', () => {
    render(<TotpVerificationPage />)

    expect(document.querySelector('a[href="/terms"]')).toBeNull()
    expect(document.querySelector('a[href="/privacy"]')).toBeNull()
    expect(screen.queryByText(/vous acceptez/)).toBeNull()
  })
})

describe('TotpVerificationPage — destination (s46b, décision F)', () => {
  it('mène à la route de passage après un code valide', async () => {
    vi.mocked(authClient.twoFactor.verifyTotp).mockResolvedValue({
      data: {},
      error: null,
    } as never)
    render(<TotpVerificationPage />)

    await userEvent.type(screen.getByRole('textbox'), '123456')
    await userEvent.click(screen.getByRole('button'))

    await waitFor(
      () => expect(navigation.push).toHaveBeenCalledWith('/login/destination'),
      {timeout: 4000}
    )
  })
})
