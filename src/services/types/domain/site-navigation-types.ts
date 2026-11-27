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

/** Une entree de page telle que l'ecran de gestion la voit (s04b). */
export type MenuPageItemDTO = {
  kind: 'page'
  id: string
  pageId: string
  rank: number
  visible: boolean
  pageTitle: string
  pageSlug: string
  pageStatus: PageStatus
}

/**
 * Une entree libre telle que l'ecran de gestion la voit (s50, ADR 078).
 * `target` est calcule par la liste blanche : `refused` ne peut venir que d'une
 * ecriture hors application, et l'entree est alors omise du site public.
 */
export type MenuLinkItemDTO = {
  kind: 'link'
  id: string
  rank: number
  visible: boolean
  label: string
  address: string
  target: 'internal' | 'external' | 'refused'
}

/** Une entree du menu telle que l'ecran de gestion la voit : page ou adresse. */
export type MenuItemDTO = MenuPageItemDTO | MenuLinkItemDTO

/**
 * Une entree du menu telle que le visiteur la voit : un libelle, une adresse
 * deja calculee par le service. `internal` reste sur le site, `external` mene a
 * un autre site en `https://`.
 */
export type PublicMenuEntryDTO = {
  kind: 'internal' | 'external'
  id: string
  title: string
  href: string
}

/**
 * Plafond du libelle d'une entree libre, mesure apres `trim()` : une `nav`
 * d'ordinateur sans retour a la ligne ne loge pas davantage.
 */
export const MENU_LINK_LABEL_MAX_LENGTH = 40

/** Longueur d'URL que tous les navigateurs suivent. */
export const MENU_LINK_ADDRESS_MAX_LENGTH = 2048

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
  | {status: 'added'; item: MenuPageItemDTO}
  | {status: 'rejected'; error: typeof MENU_ITEM_ALREADY_IN_MENU}
