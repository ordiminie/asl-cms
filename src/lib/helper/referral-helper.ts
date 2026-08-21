/**
 * Constantes et normalisation du ref d'affiliation.
 *
 * Ce fichier est volontairement sans aucun import : il est lu par le proxy, qui
 * tourne sur le runtime edge et ne peut pas charger Drizzle ni Node.
 */

export const REFERRAL_QUERY_PARAM = 'ref'

/**
 * Le cookie n'est pas signé, et c'est délibéré : sa valeur est un code public,
 * visible dans l'URL partagée par l'affilié. Le forger revient à cliquer le
 * lien — il n'y a aucun privilège à gagner. Le code est en revanche revalidé
 * par le motif ci-dessous avant toute lecture en base.
 */
export const REFERRAL_COOKIE_NAME = 'ref'

/** 60 jours, la fenêtre d'attribution du programme. */
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 60

export const REFERRAL_CODE_MAX_LENGTH = 32

export const REFERRAL_CODE_PATTERN = /^[a-z0-9-]+$/

export const normalizeReferralCode = (value: string): string =>
  value.trim().toLowerCase()

export const isValidReferralCode = (value: string | undefined): boolean => {
  if (!value) return false
  const normalized = normalizeReferralCode(value)
  return (
    normalized.length >= 3 &&
    normalized.length <= REFERRAL_CODE_MAX_LENGTH &&
    REFERRAL_CODE_PATTERN.test(normalized)
  )
}
