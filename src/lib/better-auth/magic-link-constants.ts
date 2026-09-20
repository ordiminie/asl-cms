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

/**
 * Limitation de debit HTTP de Better Auth sur les routes du lien magique,
 * passee a `magicLink({rateLimit})` : **30 ouvertures par minute et par IP**,
 * la ou le plugin en autorise 5 par defaut. La regle du plugin couvre a la
 * fois `/sign-in/magic-link` — deja ferme par `disabledPaths` — et
 * `/magic-link/verify`, la seule ouverte : en pratique, elle ne garde que
 * l'ouverture des liens.
 *
 * Pourquoi 30 et pas 5 : un jeton fait 32 caracteres alphanumeriques tires au
 * hasard (~190 bits), la force brute n'est pas la menace ; le compteur ne
 * protege que du martelement. Or il compte par **adresse IP** : les membres
 * d'un meme foyer, le bureau de l'association ou un acces partage sortent tous
 * par la meme, et 5 par minute les bloquerait mutuellement. 30 laisse passer
 * un afflux legitime — un envoi groupe ouvert en meme temps — et arrete
 * toujours un automate.
 *
 * Ce n'est pas un reglage d'association : c'est une garde d'infrastructure,
 * attachee a la mecanique HTTP de Better Auth et sans sens pour un bureau.
 * L'ADR 010 (« rien en dur ») vise les valeurs metier ; le seuil metier de la
 * story, lui, est bien un reglage (`login.link_requests_per_address_per_day`).
 */
export const MAGIC_LINK_VERIFY_RATE_LIMIT = {
  window: 60,
  max: 30,
} as const
