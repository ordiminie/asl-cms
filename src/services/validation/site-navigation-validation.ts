import {z} from 'zod'

/**
 * Validation de la navigation du site (s04b). Le pied de page porte sa propre
 * validation ici, **hors** du registre typé des parametres (ADR 021) : une
 * chaine libre, le vide autorise — vide signifiant « aucun pied de page
 * affiche », jamais une erreur.
 */

export const siteNavigationOrganizationIdSchema = z.string().uuid()
export const menuItemIdSchema = z.string().uuid()

export const addMenuItemServiceSchema = z.object({
  organizationId: siteNavigationOrganizationIdSchema,
  pageId: z.string().uuid(),
})

export const menuItemMutationServiceSchema = z.object({
  organizationId: siteNavigationOrganizationIdSchema,
  menuItemId: menuItemIdSchema,
})

export const reorderMenuItemsServiceSchema = z.object({
  organizationId: siteNavigationOrganizationIdSchema,
  orderedIds: z.array(menuItemIdSchema),
})

export const setMenuItemVisibilityServiceSchema =
  menuItemMutationServiceSchema.extend({
    visible: z.boolean(),
  })

/** 20 000 caracteres : un pied de page, pas une page de contenu. */
export const SITE_FOOTER_MAX_LENGTH = 20_000

export const saveSiteFooterServiceSchema = z.object({
  organizationId: siteNavigationOrganizationIdSchema,
  content: z.string().max(SITE_FOOTER_MAX_LENGTH),
})
