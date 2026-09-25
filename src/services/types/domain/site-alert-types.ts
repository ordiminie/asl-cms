/**
 * Types de domaine du bandeau d'alerte (s07). La presentation ne connait que
 * ceux-ci, jamais les modeles Drizzle.
 *
 * Le bandeau vit dans deux lignes de `organization_setting`, **hors du registre
 * typé** `ASSOCIATION_SETTINGS_REGISTRY`, sur le precedent du pied de page
 * (ADR 021) : ni l'ecran Reglages ni son enregistrement ne les voient.
 *
 * ⚠️ **Export (s38)** : ces deux cles font partie des contenus publies de
 * l'association. L'export doit les enumerer — `site.alert_message` (texte brut)
 * et `site.alert_active` (`'true'` / `'false'`).
 */

/** Le texte du bandeau, ecrit tel quel. Jamais supprime a la desactivation. */
export const SITE_ALERT_MESSAGE_SETTING_KEY = 'site.alert_message'

/** L'etat d'affichage du bandeau : `'true'` ou `'false'`. */
export const SITE_ALERT_ACTIVE_SETTING_KEY = 'site.alert_active'

/** Plafond du message, en caracteres (design system §2.3). */
export const SITE_ALERT_MAX_LENGTH = 280

/** Motifs de refus du message, traduits par la presentation. */
export const SITE_ALERT_MESSAGE_REQUIRED = 'site-alert.message-required'
export const SITE_ALERT_MESSAGE_TOO_LONG = 'site-alert.message-too-long'

/** Le bandeau tel que l'ecran du bureau l'edite : message conserve, etat. */
export type SiteAlertDTO = {
  message: string
  active: boolean
}

/** Le bandeau tel que le visiteur le voit : seulement quand il est affiche. */
export type PublicSiteAlertDTO = {
  message: string
}
