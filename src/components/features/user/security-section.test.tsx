import {describe, expect, it, vi} from 'vitest'

import {render, screen} from '@/__tests__/customRender'

vi.mock('@/lib/better-auth/auth-client', () => ({
  AuthClientAppConfig: {
    changeEmail: true,
    changePassword: true,
    enable2FA: true,
    enableTokenManagement: true,
  },
}))
vi.mock('@/lib/helper/auth-helper', () => ({
  shouldShowChangeEmail: () => true,
  shouldShowChangePassword: () => true,
  shouldShow2FA: () => true,
}))
vi.mock('./change-email-form', () => ({
  ChangeEmailForm: () => <div data-testid="change-email" />,
}))
vi.mock('./change-password-form', () => ({
  ChangePasswordForm: () => <div data-testid="change-password" />,
}))
vi.mock('./two-factor-form', () => ({
  TwoFactorForm: () => <div data-testid="two-factor" />,
}))
vi.mock('./list-tokens-section', () => ({
  ListTokensSection: () => <div data-testid="tokens" />,
}))

import {UserSecurityFactorSection} from './security-section'

const user = {
  id: '3f5a0a5e-0000-4000-8000-000000000001',
  name: 'Membre Test',
  email: 'membre@example.com',
  role: 'user',
  visibility: 'private',
} as Parameters<typeof UserSecurityFactorSection>[0]['user']

describe('/account — cartes de sécurité (s46, design écran 2)', () => {
  it('espace les cartes de 24 px sur mobile et de 32 px sur grand écran', () => {
    render(<UserSecurityFactorSection user={user} />)

    const stack = screen.getByTestId('change-email').closest('.space-y-6')
    expect(stack).not.toBeNull()
    expect(stack).toHaveClass('space-y-6', 'lg:space-y-8')
  })
})
