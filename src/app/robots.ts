import {MetadataRoute} from 'next'

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {routing} from '@/i18n/routing'
import {associationOriginOf} from '@/lib/better-auth/association-origin'
import {
  AUTHENTICATED_SEGMENTS,
  SIGN_IN_SEGMENTS,
} from '@/lib/routing/authenticated-segments'

const API_PREFIX = '/api/'

/**
 * Routes publiques de l'API, plus precises que `/api/` et donc prioritaires
 * pour les robots (revue s11, M1) : image de partage et favicon
 * (`/api/identity/`), fichiers de contenu (`/api/files/`, et le chemin
 * historique des pages). Sans elles, une carte de partage s'affiche sans
 * image et Google n'affiche pas le favicon.
 */
const PUBLIC_API_PREFIXES: readonly string[] = [
  '/api/identity/',
  '/api/files/',
  '/api/pages/files/',
]

/**
 * Chaque segment, sans prefixe et sous chaque locale : le proxy enleve la
 * locale avant de verifier la session, `/fr/bureau` est donc le meme
 * back-office que `/bureau` (revue s11, M2).
 */
const withLocalePrefixes = (segments: readonly string[]) =>
  segments.flatMap((segment) => [
    segment,
    ...routing.locales.map((locale) => `/${locale}${segment}`),
  ])

/**
 * `robots.txt` du domaine appele (s11, criteres 3 et 5).
 *
 * Le site public s'indexe ; chaque segment authentifie du proxy est interdit,
 * par la **meme liste** que le proxy, ainsi que les ecrans de connexion et
 * l'API privee. Seconde protection : les layouts authentifies portent
 * `noindex`. Le sitemap est annonce sur le domaine de l'association ; un
 * domaine qui n'en sert aucune interdit tout et n'annonce rien.
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
      allow: ['/', ...PUBLIC_API_PREFIXES],
      disallow: [
        ...withLocalePrefixes([...AUTHENTICATED_SEGMENTS, ...SIGN_IN_SEGMENTS]),
        API_PREFIX,
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
  }
}
