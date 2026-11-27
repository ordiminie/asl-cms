import {z} from 'zod'

import {classifyLinkAddress} from '@/lib/helper/link-address'
import {
  MENU_LINK_ADDRESS_MAX_LENGTH,
  MENU_LINK_LABEL_MAX_LENGTH,
} from '@/services/types/domain/site-navigation-types'

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

/**
 * Entree libre (s50, ADR 078) : la meme liste blanche que le formulaire et le
 * rendu, ici sans traduction — le service revalide de son cote, quel que soit
 * l'appelant. Libelle et adresse sont rendus apres `trim()`.
 */
const menuLinkFieldsSchema = z.object({
  organizationId: siteNavigationOrganizationIdSchema,
  label: z.string().trim().min(1).max(MENU_LINK_LABEL_MAX_LENGTH),
  address: z
    .string()
    .trim()
    .max(MENU_LINK_ADDRESS_MAX_LENGTH)
    .refine((address) => classifyLinkAddress(address).ok),
})

export const addMenuLinkServiceSchema = menuLinkFieldsSchema

export const updateMenuLinkServiceSchema = menuLinkFieldsSchema.extend({
  menuItemId: menuItemIdSchema,
})
