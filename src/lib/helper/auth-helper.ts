import {AuthMethod, env} from '@/env'

export function isAuthMethodEnabled(method: AuthMethod): boolean {
  return env.NEXT_PUBLIC_AUTH_METHODS.includes(method)
}

type BanTranslations = {
  base: string
  reason: (params: {reason: string}) => string
  expires: (params: {date: string; time: string}) => string
  permanent: string
}

const defaultBanTranslations: BanTranslations = {
  base: 'Votre compte a été suspendu.',
  reason: ({reason}) => `Raison: ${reason}.`,
  expires: ({date, time}) => `Suspension jusqu'au ${date} à ${time}.`,
  permanent: 'Cette suspension est permanente.',
}

export function buildBannedMessage(
  user: {
    banReason?: string | null
    banExpires?: Date | string | null
  },
  translations?: BanTranslations
): string {
  const t = translations || defaultBanTranslations

  let message = t.base

  if (user.banReason) {
    message += ` ${t.reason({reason: user.banReason})}`
  }

  if (user.banExpires) {
    const expiryDate = new Date(user.banExpires)
    const now = new Date()

    if (expiryDate > now) {
      message += ` ${t.expires({
        date: expiryDate.toLocaleDateString('fr-FR'),
        time: expiryDate.toLocaleTimeString('fr-FR'),
      })}`
    }
  } else {
    message += ` ${t.permanent}`
  }

  return message
}

export function isUserBanned(user: {
  banned?: boolean | null
  banExpires?: Date | string | null
}): boolean {
  if (!user.banned) return false

  if (user.banExpires) {
    const expiryDate = new Date(user.banExpires)
    return expiryDate > new Date()
  }

  return true
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
