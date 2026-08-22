import 'server-only'

import {cookies} from 'next/headers'

import {
  isValidReferralCode,
  normalizeReferralCode,
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
  REFERRAL_COOKIE_NAME,
} from './referral-helper'

/**
 * Lit le ref déposé par le proxy.
 *
 * Toute erreur est avalée volontairement : cette lecture intervient pendant une
 * inscription, et une attribution manquée est un incident commercial mineur là
 * où une inscription cassée est un incident majeur.
 */
export const readReferralCodeFromCookies = async (): Promise<
  string | undefined
> => {
  try {
    const store = await cookies()
    const value = store.get(REFERRAL_COOKIE_NAME)?.value
    if (!value || !isValidReferralCode(value)) return undefined
    return normalizeReferralCode(value)
  } catch {
    return undefined
  }
}

/**
 * Mémorise le code saisi manuellement à l'inscription.
 *
 * Écrire un cookie plutôt que de propager le code jusqu'au hook Better Auth
 * garde un seul chemin d'attribution : le hook lit toujours au même endroit,
 * qu'il s'agisse d'un clic sur un lien ou d'une saisie au formulaire. Dans une
 * Server Action, `cookies()` reflète l'écriture immédiatement.
 *
 * Ce chemin est le seul disponible en mode `code-only`, où aucun traceur n'est
 * posé à la visite.
 */
export const rememberReferralCodeFromSignUp = async (
  code: string | undefined
): Promise<void> => {
  if (!code || !isValidReferralCode(code)) return

  try {
    const store = await cookies()
    store.set(REFERRAL_COOKIE_NAME, normalizeReferralCode(code), {
      path: '/',
      maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
      httpOnly: true,
      sameSite: 'lax',
    })
  } catch {
    // Contexte sans cookie mutable : l'attribution se fera sans ce repli.
  }
}
