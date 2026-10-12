import {PageStatus} from './page-types'

/**
 * Types de domaine de la page d'accueil (s44, ADR 032). La presentation ne
 * connait que ceux-ci, jamais les modeles Drizzle.
 *
 * Le choix vit dans une ligne de `organization_setting`, **hors du registre
 * typé** `ASSOCIATION_SETTINGS_REGISTRY`, sur le precedent du pied de page
 * (ADR 021). Pas de ligne = accueil automatique ; une reference pendante se
 * lit comme « pas de page ».
 */
export const HOME_PAGE_SETTING_KEY = 'site.home_page_id'

/**
 * Nombre d'actualites de l'accueil minimal : constante d'affichage (ADR 023
 * §4), pas un parametre d'association.
 */
export const HOME_NEWS_COUNT = 3

/** Le choix tel que l'ecran du bureau l'affiche, statut de la page compris. */
export type HomePageForBureauDTO = {
  page: {id: string; title: string; status: PageStatus} | null
}

export type HomePageSaveResult = {status: 'saved'} | {status: 'not_published'}
