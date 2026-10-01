import {MetadataRoute} from 'next'

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {associationOriginOf} from '@/lib/better-auth/association-origin'
import {
  AUTHENTICATED_SEGMENTS,
  SIGN_IN_SEGMENTS,
} from '@/lib/routing/authenticated-segments'

const API_PREFIX = '/api/'

/**
 * `robots.txt` du domaine appele (s11, criteres 3 et 5).
 *
 * Le site public s'indexe ; chaque segment authentifie du proxy est interdit,
 * par la **meme liste** que le proxy, ainsi que les ecrans de connexion et
 * l'API. Seconde protection : les layouts authentifies portent `noindex`. Le
 * sitemap est annonce sur le domaine de l'association ; un domaine qui n'en
 * sert aucune interdit tout et n'annonce rien.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const tenant = await getCurrentTenantDal()
  const origin = associationOriginOf(tenant?.domain)

  if (!tenant || !origin) {
    return {rules: {userAgent: '*', disallow: '/'}}
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [...AUTHENTICATED_SEGMENTS, ...SIGN_IN_SEGMENTS, API_PREFIX],
    },
    sitemap: `${origin}/sitemap.xml`,
  }
}
