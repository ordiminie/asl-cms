import {z} from 'zod'

/**
 * Validation de la page d'accueil (s44, ADR 032), hors du registre typé des
 * parametres. `pageId` nul = retour a l'accueil automatique.
 */
export const homePageOrganizationIdSchema = z.string().uuid()

export const homePagePageIdSchema = z.string().uuid()

export const setHomePageServiceSchema = z.object({
  organizationId: homePageOrganizationIdSchema,
  pageId: homePagePageIdSchema.nullable(),
})
