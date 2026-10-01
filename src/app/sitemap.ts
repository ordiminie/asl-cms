import {MetadataRoute} from 'next'

import {getPublishedSitemapEntriesDal} from '@/app/dal/sitemap-dal'
import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {associationOriginOf} from '@/lib/better-auth/association-origin'

/**
 * Pages a adresse fixe du site public d'une association. Aucune n'est
 * rattachee a un module activable (ADR 010) : elles sont servies a toutes.
 */
const FIXED_PUBLIC_PATHS = [
  '/actualites',
  '/analyses-eau',
  '/le-bureau',
  '/contact',
  '/signaler',
] as const

/**
 * Sitemap de l'association du domaine appele (s11, criteres 1 et 5).
 *
 * Lire le domaine rend ce gestionnaire dynamique : chaque association sert
 * le sien, et une page publiee y entre a la requete suivante (decision C).
 * Une seule adresse par page, **sans prefixe de locale** et sans alternative
 * de langue (decision B, contournement de l'ADR 008 jusqu'a s43). Ni le blog
 * herite ni les pages du produit : ce n'est pas le site de l'association.
 * Un domaine qui ne sert aucune association rend un sitemap vide.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tenant = await getCurrentTenantDal()
  const origin = associationOriginOf(tenant?.domain)
  if (!tenant || !origin) return []

  const {pages, news} = await getPublishedSitemapEntriesDal(tenant.id)

  return [
    {url: `${origin}/`},
    ...FIXED_PUBLIC_PATHS.map((path) => ({url: `${origin}${path}`})),
    ...pages.map((page) => ({
      url: `${origin}/${page.slug}`,
      lastModified: page.updatedAt,
    })),
    ...news.map((item) => ({
      url: `${origin}/actualites/${item.slug}`,
      lastModified: item.publishedOn,
    })),
  ]
}
