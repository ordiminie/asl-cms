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
 * le fournissent — celui du domaine appele. Aucun appel a `logger` ici :
 * Winston horodate, ce qui est interdit en scope cache.
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
