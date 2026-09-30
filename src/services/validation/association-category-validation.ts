import {z} from 'zod'

import {
  CATEGORY_DOMAINS,
  CATEGORY_NAME_MAX_LENGTH,
} from '../types/domain/association-category-types'

/**
 * Validation des categories administrables (s10, ADR 028).
 *
 * L'adresse de routage est facultative : `''` et les espaces sont une adresse
 * **absente**, ecrite `NULL` (critere 6, ADR 028 §4). Renseignee, elle doit
 * etre une adresse valide, et revient telle quelle.
 */

export const categoryOrganizationIdSchema = z.string().uuid()
export const categoryIdSchema = z.string().uuid()
export const categoryDomainSchema = z.enum(CATEGORY_DOMAINS)

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(CATEGORY_NAME_MAX_LENGTH)

export const categoryRoutingEmailSchema = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim()
    return trimmed ? trimmed : undefined
  })
  .pipe(z.string().email().optional())

export const listCategoriesServiceSchema = z.object({
  organizationId: categoryOrganizationIdSchema,
  domain: categoryDomainSchema,
})

export const createCategoryServiceSchema = z.object({
  organizationId: categoryOrganizationIdSchema,
  domain: categoryDomainSchema,
  name: categoryNameSchema,
  routingEmail: categoryRoutingEmailSchema,
})

export const updateCategoryServiceSchema = createCategoryServiceSchema.extend({
  categoryId: categoryIdSchema,
})

export const deleteCategoryServiceSchema = z.object({
  organizationId: categoryOrganizationIdSchema,
  domain: categoryDomainSchema,
  categoryId: categoryIdSchema,
})
