import {z} from 'zod'

import {pageSlugSchema} from './page-validation'

/**
 * Validation des actualites (s05, ADR 023). Un brouillon s'enregistre
 * incomplet : le titre et le texte alternatif ne sont exiges qu'a la
 * publication, par `validateNewsForPublication`.
 */

export const newsOrganizationIdSchema = z.string().uuid()
export const newsIdSchema = z.string().uuid()

export const NEWS_TITLE_MAX_LENGTH = 160
export const NEWS_CONTENT_MAX_LENGTH = 20_000
export const NEWS_IMAGE_ALT_MAX_LENGTH = 300

export const newsTitleSchema = z.string().trim().max(NEWS_TITLE_MAX_LENGTH)

/**
 * Date ISO `YYYY-MM-DD`, et une date qui existe : `2026-02-30` est refusee.
 * La verification se fait en UTC, sans lire l'horloge.
 */
export const newsDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    )
  })

export const newsContentSchema = z.string().max(NEWS_CONTENT_MAX_LENGTH)
export const newsImageAltSchema = z
  .string()
  .trim()
  .max(NEWS_IMAGE_ALT_MAX_LENGTH)

export const newsPageNumberSchema = z.number().int().min(1)

export const createNewsDraftServiceSchema = z.object({
  organizationId: newsOrganizationIdSchema,
  publishedOn: newsDateSchema,
})

export const updateNewsServiceSchema = z.object({
  organizationId: newsOrganizationIdSchema,
  newsId: newsIdSchema,
  title: newsTitleSchema,
  publishedOn: newsDateSchema,
  content: newsContentSchema,
  imageAlt: newsImageAltSchema,
  removeImage: z.boolean().default(false),
})

export const newsStatusChangeServiceSchema = z.object({
  organizationId: newsOrganizationIdSchema,
  newsId: newsIdSchema,
})

export const newsListServiceSchema = z.object({
  organizationId: newsOrganizationIdSchema,
  page: newsPageNumberSchema,
})

export const readNewsBySlugServiceSchema = z.object({
  organizationId: newsOrganizationIdSchema,
  slug: pageSlugSchema,
})

export const uploadNewsImageServiceSchema = z.object({
  organizationId: newsOrganizationIdSchema,
  newsId: newsIdSchema,
})
