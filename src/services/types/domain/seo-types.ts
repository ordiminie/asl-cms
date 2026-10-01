/**
 * Referencement des pages publiques (s11). Module isomorphe, sans dependance :
 * il sert au service, aux editeurs et au registre des parametres.
 *
 * Les plafonds sont les valeurs d'usage des moteurs de recherche (decision J
 * du plan) : des constantes de domaine, pas des parametres d'association.
 */
export const SEO_TITLE_MAX = 60
export const SEO_DESCRIPTION_MAX = 160

/** Dimensions de l'image de partage : celles de la carte de partage (1,91:1). */
export const SHARE_IMAGE_WIDTH = 1200
export const SHARE_IMAGE_HEIGHT = 630

/**
 * Ce que le sitemap d'une association liste de son contenu (s11) : pages et
 * actualites **publiees**, avec leur date.
 */
export type SitemapEntriesDTO = {
  pages: {slug: string; updatedAt: Date}[]
  /** Date ISO `YYYY-MM-DD` de publication. */
  news: {slug: string; publishedOn: string}[]
}
