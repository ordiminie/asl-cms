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
