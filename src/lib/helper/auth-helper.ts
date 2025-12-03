import {AuthMethod, env} from '@/env'

export function isAuthMethodEnabled(method: AuthMethod): boolean {
  return env.NEXT_PUBLIC_AUTH_METHODS.includes(method)
}

export function shouldShowChangeEmail(): boolean {
  return isAuthMethodEnabled('credential') || isAuthMethodEnabled('magiclink')
}

export function shouldShowChangePassword(): boolean {
  return isAuthMethodEnabled('credential')
}

export function shouldShow2FA(): boolean {
  return isAuthMethodEnabled('credential') || isAuthMethodEnabled('magiclink')
}
