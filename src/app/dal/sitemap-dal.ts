import 'server-only'

import {cache} from 'react'

import {getPublishedSitemapEntriesService} from '@/services/facades/sitemap-service-facade'
import {SitemapEntriesDTO} from '@/services/types/domain/seo-types'

/**
 * Le contenu publie d'une association pour son sitemap (s11).
 *
 * **Sans `'use cache'`, et c'est delibere** (decision C du plan) : un sitemap
 * est demande quelques fois par jour par les moteurs ; le cacher ne
 * rapporterait rien et couterait une invalidation de plus a chaque
 * publication. Lue a la requete, une page publiee y entre aussitot.
 */
export const getPublishedSitemapEntriesDal = cache(
  async (organizationId: string): Promise<SitemapEntriesDTO> =>
    getPublishedSitemapEntriesService(organizationId)
)
