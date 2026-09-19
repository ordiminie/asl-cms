/**
 * Duree de validite d'un lien de connexion : 20 minutes (arbitrage du
 * 2026-09-19, s03). Passee explicitement a `magicLink({expiresIn})` — jamais
 * la valeur par defaut de Better Auth (300 s). Module sans dependance : les
 * ecrans et l'email en lisent la duree en minutes.
 */
export const MAGIC_LINK_EXPIRES_IN_SECONDS = 20 * 60

export const MAGIC_LINK_EXPIRES_IN_MINUTES = MAGIC_LINK_EXPIRES_IN_SECONDS / 60

/**
 * Duree minimale d'une demande de lien, adresse connue ou non (design system
 * §7 : meme temps de reponse). L'envoi reste attendu ; seul un envoi plus lent
 * que ce plancher distingue encore les deux cas (ecart accepte au plan).
 */
export const MAGIC_LINK_REQUEST_MIN_DURATION_MS = 1500

/** Delai avant de pouvoir redemander un lien depuis l'ecran d'attente. */
export const MAGIC_LINK_RESEND_DELAY_SECONDS = 60
