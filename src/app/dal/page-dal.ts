import 'server-only'

import {cacheLife, cacheTag} from 'next/cache'
import {cache} from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  canManagePagesService,
  getPageBySlugService,
  getPageForBureauService,
  getPagesForBureauService,
} from '@/services/facades/page-service-facade'
import {PageDTO, PageWithBlocksDTO} from '@/services/types/domain/page-types'

/**
 * Tag d'invalidation d'une page publique. Porte l'identifiant de
 * l'association et le slug : les tags sont stockes en clair, aucune donnee
 * personnelle dedans. Les Server Actions du bureau appellent
 * `updateTag(pageTag(...))` **apres** le succes de l'ecriture — et sur les
 * deux slugs quand le slug change.
 */
export const pageTag = (organizationId: string, slug: string): string =>
  `page:${organizationId}:${slug}`

/**
 * Lecture cachee d'une page par son slug. Fonction **interne** : elle prend
 * l'identifiant de l'association en argument, et seuls les appelants ci-dessous
 * le fournissent — celui du domaine appele.
 *
 * ⚠️ Ce scope `'use cache'` n'est pas exempt de journalisation, contrairement a
 * ce qu'affirmait la premiere version de ce commentaire : la facade
 * `getPageBySlugService` passe par l'intercepteur de journalisation, qui appelle
 * `logger.info` / `logger.debug` — donc `new Date()` de Winston — a l'interieur
 * du scope. Ce qui rend la chose tenable est la neutralisation du logger pendant
 * le build (`src/lib/logger.ts`, `NEXT_PHASE=phase-production-build`), pas une
 * absence d'appel. C'est un compromis **herite**, partage avec
 * `association-settings-dal.ts` dont ce fichier reprend le gabarit : ni s04 ni
 * ce commentaire ne l'introduisent, et le resoudre demanderait de revoir le
 * patron facade/intercepteur pour tous les DAL caches — sa propre decision.
 *
 * Ce qui reste vrai et doit le rester : aucun appel direct a `logger` ecrit
 * ici, et aucune autre lecture d'horloge ou de requete (`headers()`,
 * `cookies()`, `Math.random()`) dans ce scope.
 */
const readPageBySlugCached = cache(
  async (
    organizationId: string,
    slug: string
  ): Promise<PageWithBlocksDTO | undefined> => {
    'use cache'
    cacheLife('hours')
    cacheTag(pageTag(organizationId, slug))

    return getPageBySlugService(organizationId, slug)
  }
)

/**
 * La page servie au visiteur : publiee, ou rien. Un brouillon et une page
 * depubliee n'existent pas pour le site public (criteres 2 et 3).
 */
export const getPublicPageBySlugDal = async (
  organizationId: string,
  slug: string
): Promise<PageWithBlocksDTO | undefined> => {
  const page = await readPageBySlugCached(organizationId, slug)
  return page?.status === 'published' ? page : undefined
}

/**
 * La meme page pour l'apercu du bureau, **sans cache** : un brouillon change a
 * chaque enregistrement, et l'apercu doit montrer le dernier etat.
 */
export const getPageBySlugForPreviewDal = cache(
  async (
    organizationId: string,
    slug: string
  ): Promise<PageWithBlocksDTO | undefined> =>
    getPageBySlugService(organizationId, slug)
)

/**
 * Liste de gestion du bureau. Non cachee : c'est un ecran d'administration,
 * qui doit refleter la derniere modification sans attendre une invalidation.
 */
export const getPagesForBureauDal = cache(
  async (organizationId: string): Promise<PageDTO[]> =>
    getPagesForBureauService(organizationId)
)

/**
 * Une page du bureau, blocs compris, pour l'editeur. Non cachee : un brouillon
 * change a chaque enregistrement.
 */
export const getPageForBureauDal = cache(
  async (
    organizationId: string,
    pageId: string
  ): Promise<PageWithBlocksDTO | undefined> =>
    getPageForBureauService(organizationId, pageId).catch(() => undefined)
)

/**
 * L'utilisateur connecte peut-il gerer les pages de l'association du domaine
 * appele ? Donnee par utilisateur : jamais cachee au-dela de la requete.
 */
export const canManageCurrentPagesDal = cache(async (): Promise<boolean> => {
  const tenant = await requireCurrentTenantDal()
  return canManagePagesService(tenant.id)
})
