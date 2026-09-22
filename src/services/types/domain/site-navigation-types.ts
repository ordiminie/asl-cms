import {PageStatus} from './page-types'

/**
 * Types de domaine de la navigation du site public (s04b, ADR 021). La
 * presentation ne connait que ceux-ci, jamais les modeles Drizzle.
 */

/**
 * Cle du pied de page dans `organization_setting`. **Hors du registre typé**
 * `ASSOCIATION_SETTINGS_REGISTRY` (ADR 021) : un contenu en texte riche n'est
 * pas un parametre de configuration scalaire, et `resolveSettings` n'itere que
 * ses propres cles — cette ligne lui reste donc invisible.
 */
export const SITE_FOOTER_SETTING_KEY = 'site.footer_content'

/** Une entree du menu telle que l'ecran de gestion la voit. */
export type MenuItemDTO = {
  id: string
  pageId: string
  rank: number
  visible: boolean
  pageTitle: string
  pageSlug: string
  pageStatus: PageStatus
}

/** Une entree du menu telle que le visiteur la voit : un libelle, une adresse. */
export type PublicMenuEntryDTO = {
  id: string
  title: string
  slug: string
}

/**
 * Menu et pied de page sont toujours lus ensemble par le layout public : un
 * seul type, une seule lecture, un seul tag de cache (ADR 021).
 */
export type SiteNavigationDTO = {
  menu: PublicMenuEntryDTO[]
  footerContent: string
}

/**
 * Une page deja presente dans le menu est refusee : la contrainte unique
 * `(organization_id, page_id)` tranche en base, le service la devance et rend
 * un refus lisible plutot qu'une exception brute de Postgres.
 */
export const MENU_ITEM_ALREADY_IN_MENU = 'already_in_menu' as const

export type MenuItemMutationResult =
  | {status: 'added'; item: MenuItemDTO}
  | {status: 'rejected'; error: typeof MENU_ITEM_ALREADY_IN_MENU}
