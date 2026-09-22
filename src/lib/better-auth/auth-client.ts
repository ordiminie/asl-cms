import {apiKeyClient} from '@better-auth/api-key/client'
import {stripeClient} from '@better-auth/stripe/client'
import {
  adminClient,
  magicLinkClient,
  organizationClient,
  twoFactorClient,
} from 'better-auth/client/plugins'
import {createAuthClient} from 'better-auth/react'

import {env} from '@/env'
import {
  organizationAccessControl,
  organizationRoles,
} from '@/lib/better-auth/organization-roles'

export const AuthClientAppConfig = {
  requireEmailVerification:
    env.NEXT_PUBLIC_BETTER_AUTH_REQUIRE_EMAIL_VERIFICATION,
  skipVerificationOnEnable:
    env.NEXT_PUBLIC_BETTER_AUTH_2FA_SKIP_VERIFICATION_ON_ENABLE,
  enable2FA: env.NEXT_PUBLIC_BETTER_AUTH_2FA_ENABLE,
  enableTokenManagement: env.NEXT_PUBLIC_BETTER_AUTH_TOKEN_MANAGEMENT,
  changePassword: env.NEXT_PUBLIC_BETTER_AUTH_CHANGE_PASSWORD,
  changeEmail: env.NEXT_PUBLIC_BETTER_AUTH_CHANGE_EMAIL,
} as const

/**
 * Sans `baseURL`, Better Auth prend l'origine de la page : le client parle au
 * domaine de l'association consultee, qui porte le cookie de session
 * (ADR 022).
 */
export const authClient = createAuthClient({
  plugins: [
    adminClient(),
    organizationClient({
      ac: organizationAccessControl,
      roles: organizationRoles,
    }),
    magicLinkClient(),
    twoFactorClient(),
    apiKeyClient(),
    stripeClient({
      subscription: true, //if you want to enable subscription management
    }),
  ],
})
