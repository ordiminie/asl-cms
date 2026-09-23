import {z} from 'zod'

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

export const updatePageServiceSchema = createPageServiceSchema.extend({
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
