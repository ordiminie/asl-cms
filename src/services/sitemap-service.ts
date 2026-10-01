import 'server-only'

import {getPublishedNewsForSitemapDao} from '@/db/repositories/news-repository'
import {getPublishedPagesForSitemapDao} from '@/db/repositories/page-repository'
import {withTenant} from '@/db/tenant-scope'

import {ValidationParsedZodError} from './errors/validation-error'
import {SitemapEntriesDTO} from './types/domain/seo-types'
import {sitemapOrganizationIdSchema} from './validation/sitemap-validation'

/**
 * Le contenu publie d'une association, pour son sitemap (s11).
 *
 * **Sans controle d'autorisation, et c'est delibere** : ce qui est publie
 * s'adresse aux visiteurs et aux moteurs. Aucune fonction du bureau n'est
 * reemployee (elles sont gardees par `PAGE_MANAGE`). Les deux lectures se
 * font sous le scope de l'association : un oubli rendrait un sitemap vide,
 * sans erreur.
 */
export const getPublishedSitemapEntriesService = async (
  organizationId: string
): Promise<SitemapEntriesDTO> => {
  const parsed = sitemapOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const [pages, news] = await withTenant(parsed.data, () =>
    Promise.all([
      getPublishedPagesForSitemapDao(parsed.data),
      getPublishedNewsForSitemapDao(parsed.data),
    ])
  )

  return {pages, news}
}
