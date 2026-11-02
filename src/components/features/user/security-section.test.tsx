import {afterEach, describe, expect, it, vi} from 'vitest'

import {render, screen} from '@/__tests__/customRender'

const config = vi.hoisted(() => ({
  changeEmail: true,
  changePassword: true,
  enable2FA: true,
  enableTokenManagement: true,
}))

vi.mock('@/lib/better-auth/auth-client', () => ({
  AuthClientAppConfig: config,
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

vi.mock('@/lib/helper/page-navigation.client', () => ({
  reloadPageAt: vi.fn(),
}))

import {userEvent} from '@/__tests__/customRender'
import {reloadPageAt} from '@/lib/helper/page-navigation.client'

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

describe('/account — changement d’adresse fermé (s12d)', () => {
  afterEach(() => {
    config.changeEmail = true
  })

  it('ne montre pas la carte « Adresse email » quand le drapeau est faux', () => {
    config.changeEmail = false

    render(<UserSecurityFactorSection user={user} />)

    expect(screen.queryByTestId('change-email')).toBeNull()
    expect(screen.getByTestId('change-password')).toBeInTheDocument()
  })
})

/** s48, écran 5 : pendant une session à la place d'un compte. */
describe('/account — sections sensibles verrouillées pendant l’imitation (s48)', () => {
  const stopAction = vi.fn()
  const LOCKED =
    'Indisponible pendant que vous agissez à la place de Claire Montel. Revenez à votre compte pour y accéder.'

  const renderLocked = () =>
    render(
      <UserSecurityFactorSection
        user={user}
        impersonation={{subjectName: 'Claire Montel', stopAction}}
      />
    )

  it('remplace mot de passe, adresse et double vérification par la note', () => {
    renderLocked()

    expect(screen.queryByTestId('change-email')).toBeNull()
    expect(screen.queryByTestId('change-password')).toBeNull()
    expect(screen.queryByTestId('two-factor')).toBeNull()
    expect(screen.getAllByText(LOCKED)).toHaveLength(3)
    expect(
      screen.getAllByRole('button', {name: 'Revenir à mon compte'})
    ).toHaveLength(3)
  })

  it('« Revenir à mon compte » rend la session d’origine et recharge la page', async () => {
    stopAction.mockResolvedValue({
      success: true,
      url: '/admin/organizations/x/edit?retour=1',
    })
    renderLocked()

    await userEvent.click(
      screen.getAllByRole('button', {name: 'Revenir à mon compte'})[0]
    )

    expect(stopAction).toHaveBeenCalledTimes(1)
    expect(reloadPageAt).toHaveBeenCalledWith(
      '/admin/organizations/x/edit?retour=1'
    )
  })

  it('hors imitation : les formulaires, sans note', () => {
    render(<UserSecurityFactorSection user={user} />)

    expect(screen.getByTestId('change-password')).toBeInTheDocument()
    expect(screen.queryByText(LOCKED)).toBeNull()
  })
})
