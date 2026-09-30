/**
 * Types de domaine des categories administrables (s10, ADR 028). Ecrits
 * **sans importer le modele Drizzle** (`rule-architecture`).
 *
 * Le modele est **generique** : `domain` dit a quel usage une categorie
 * appartient. `'report'` (signalements) est la seule valeur aujourd'hui ; s23
 * et s35 ajouteront la leur ici, sans migration.
 */

export const CategoryDomainConst = {
  REPORT: 'report',
} as const

export const CATEGORY_DOMAINS = [CategoryDomainConst.REPORT] as const

export type CategoryDomain = (typeof CATEGORY_DOMAINS)[number]

/** Plafond par domaine et par association (critere 4). */
export const MAX_CATEGORIES_PER_DOMAIN = 10

/** Longueur maximale du nom d'une categorie (decision G, compteur du design). */
export const CATEGORY_NAME_MAX_LENGTH = 40

export type AssociationCategoryDTO = {
  id: string
  organizationId: string
  domain: CategoryDomain
  name: string
  /** Nul quand l'adresse est absente : jamais une chaine vide (critere 6). */
  routingEmail: string | null
  createdAt: Date
}

/** Une categorie active, telle que le formulaire public la propose. */
export type PublicCategoryDTO = {
  id: string
  name: string
}

/** Ce que le bureau saisit pour creer une categorie. */
export type CreateAssociationCategoryInput = {
  organizationId: string
  domain: CategoryDomain
  name: string
  routingEmail?: string
}

/** Ce que le bureau saisit pour modifier une categorie. */
export type UpdateAssociationCategoryInput = CreateAssociationCategoryInput & {
  categoryId: string
}

/** La categorie a supprimer. */
export type DeleteAssociationCategoryInput = {
  organizationId: string
  domain: CategoryDomain
  categoryId: string
}

/**
 * Une categorie vue par le bureau : combien d'objets de son usage la portent
 * (pour les signalements : combien seront conserves si elle est supprimee).
 */
export type ManagedCategoryDTO = AssociationCategoryDTO & {usageCount: number}

/** L'ecran des categories : les actives, et combien de places il reste. */
export type AssociationCategoryListDTO = {
  items: ManagedCategoryDTO[]
  max: number
}
