import 'server-only'

import {cookies} from 'next/headers'

import {
  isValidReferralCode,
  normalizeReferralCode,
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
 * Supprime le cookie une fois l'attribution figée en base.
 * Le cookie n'est qu'un transport : passé l'inscription, il n'a plus d'utilité
 * et le garder ne ferait qu'élargir la surface exposée.
 */
export const clearReferralCookie = async (): Promise<void> => {
  try {
    const store = await cookies()
    store.delete(REFERRAL_COOKIE_NAME)
  } catch {
    // Contexte sans cookie mutable (webhook, tâche de fond) : rien à faire.
  }
}
