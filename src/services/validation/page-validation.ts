import {z} from 'zod'

import {SEO_DESCRIPTION_MAX, SEO_TITLE_MAX} from '../types/domain/seo-types'

/**
 * Validation des pages CMS (s04). Le slug est la seule contrainte de forme qui
 * compte cote public : minuscules, chiffres et tirets, sans tiret en bordure —
 * une adresse qu'on peut dicter au telephone.
 */

export const pageOrganizationIdSchema = z.string().uuid()
export const pageIdSchema = z.string().uuid()

export const pageSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Le slug ne contient que des minuscules, des chiffres et des tirets',
  })

export const pageTitleSchema = z.string().trim().min(1).max(160)

/**
 * Un bloc envoye par l'editeur. `id` est present pour un bloc deja enregistre,
 * absent pour un bloc qu'on vient d'inserer. `type` n'est utile que pour un
 * bloc de type inconnu, conserve tel quel ; pour les cinq types connus, il est
 * porte par `data` (union discriminee).
 */
export const pageBlockInputSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.string().optional(),
  data: z.unknown(),
})

export const createPageServiceSchema = z.object({
  organizationId: pageOrganizationIdSchema,
  title: pageTitleSchema,
  slug: pageSlugSchema,
  blocks: z.array(pageBlockInputSchema).default([]),
})

/** Texte facultatif : vide ou blanc, il est stocke absent (`null`). */
const optionalSeoText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .optional()

export const PAGE_SHARE_IMAGE_ALT_MAX_LENGTH = 300

/**
 * Champs de referencement d'une page (s11). Absents de la requete, ceux en
 * base ne sont pas touches ; envoyes vides, ils sont effaces.
 */
export const pageSeoInputSchema = z.object({
  seoTitle: optionalSeoText(SEO_TITLE_MAX),
  seoDescription: optionalSeoText(SEO_DESCRIPTION_MAX),
  /**
   * Cle de l'image telle que l'editeur la rend, ou `null` si elle a ete
   * retiree. Sa forme est verifiee contre la page dans le service.
   */
  shareImageKey: z.string().min(1).nullable().optional(),
  shareImageAlt: optionalSeoText(PAGE_SHARE_IMAGE_ALT_MAX_LENGTH),
})

export const updatePageServiceSchema = createPageServiceSchema
  .extend({pageId: pageIdSchema})
  .extend(pageSeoInputSchema.shape)

export const uploadPageShareImageServiceSchema = z.object({
  organizationId: pageOrganizationIdSchema,
  pageId: pageIdSchema,
})

export const pageStatusChangeServiceSchema = z.object({
  organizationId: pageOrganizationIdSchema,
  pageId: pageIdSchema,
})

export const readPageBySlugServiceSchema = z.object({
  organizationId: pageOrganizationIdSchema,
  slug: pageSlugSchema,
})

export const uploadPageBlockFileServiceSchema = z.object({
  organizationId: pageOrganizationIdSchema,
  pageId: pageIdSchema,
  blockId: z.string().uuid(),
  kind: z.enum(['image', 'document']),
})
