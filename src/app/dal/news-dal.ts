import 'server-only'

import {cacheLife, cacheTag} from 'next/cache'
import {cache} from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {NotFoundError} from '@/services/errors/not-found-error'
import {
  canManageNewsService,
  getNewsBySlugService,
  getNewsForBureauService,
  getNewsItemForBureauService,
  getPublishedNewsPageService,
} from '@/services/facades/news-service-facade'
import {contentFileUrl} from '@/services/types/domain/content-file-types'
import {NewsDTO, NewsListPageDTO} from '@/services/types/domain/news-types'

/**
 * Tag d'invalidation de la **liste** publique des actualites d'une
 * association. Les tags sont stockes en clair : rien d'autre que
 * l'identifiant de l'association.
 *
 * Les Server Actions du bureau appellent `updateTag(newsListTag(...))`
 * **apres** le succes de l'ecriture — toute modification deplace ou change une
 * ligne de la liste, y compris un changement de date.
 */
export const newsListTag = (organizationId: string): string =>
  `news:${organizationId}`

/** Tag d'invalidation d'une actualite, par son adresse stable. */
export const newsItemTag = (organizationId: string, slug: string): string =>
  `news:${organizationId}:${slug}`

/**
 * Lecture cachee d'une page de la liste publique. Fonction **interne** : elle
 * prend l'identifiant de l'association en argument, et seuls les appelants
 * ci-dessous le fournissent — celui du domaine appele.
 *
 * Aucun appel direct a `logger`, aucune horloge, aucune lecture de requete
 * dans ce scope. Le compromis herite sur l'intercepteur de journalisation des
 * facades est celui decrit dans `page-dal.ts`.
 */
const readPublishedNewsPageCached = cache(
  async (organizationId: string, page: number): Promise<NewsListPageDTO> => {
    'use cache'
    cacheLife('hours')
    cacheTag(newsListTag(organizationId))

    return getPublishedNewsPageService(organizationId, page)
  }
)

/** La liste servie au visiteur : les actualites publiees, page par page. */
export const getPublicNewsPageDal = async (
  organizationId: string,
  page: number
): Promise<NewsListPageDTO> => readPublishedNewsPageCached(organizationId, page)

const readNewsBySlugCached = cache(
  async (
    organizationId: string,
    slug: string
  ): Promise<NewsDTO | undefined> => {
    'use cache'
    cacheLife('hours')
    cacheTag(newsItemTag(organizationId, slug))

    return getNewsBySlugService(organizationId, slug)
  }
)

/**
 * L'actualite servie au visiteur : publiee, ou rien. Un brouillon et une
 * actualite depubliee n'existent pas pour le site public (critere 3).
 */
export const getPublicNewsBySlugDal = async (
  organizationId: string,
  slug: string
): Promise<NewsDTO | undefined> => {
  const item = await readNewsBySlugCached(organizationId, slug)
  return item?.status === 'published' ? item : undefined
}

/**
 * La meme actualite pour l'apercu du bureau, **sans cache** : un brouillon
 * change a chaque enregistrement, et l'apercu doit montrer le dernier etat.
 */
export const getNewsBySlugForPreviewDal = cache(
  async (organizationId: string, slug: string): Promise<NewsDTO | undefined> =>
    getNewsBySlugService(organizationId, slug)
)

/**
 * Liste de gestion du bureau. Non cachee : c'est un ecran d'administration,
 * qui doit refleter la derniere modification sans attendre une invalidation.
 */
export const getNewsForBureauDal = cache(
  async (organizationId: string, page: number): Promise<NewsListPageDTO> =>
    getNewsForBureauService(organizationId, page)
)

/**
 * Une actualite du bureau, pour l'editeur. Non cachee, meme raison.
 *
 * Seule l'absence devient `undefined`, que l'appelant traduit en 404 : une
 * panne de base ou un refus d'autorisation remonte, au lieu de s'afficher au
 * bureau en « Actualite introuvable ».
 */
export const getNewsItemForBureauDal = cache(
  async (
    organizationId: string,
    newsId: string
  ): Promise<NewsDTO | undefined> =>
    getNewsItemForBureauService(organizationId, newsId).catch(
      (error: unknown) => {
        if (error instanceof NotFoundError) return undefined
        throw error
      }
    )
)

/**
 * L'utilisateur connecte peut-il gerer les actualites de l'association du
 * domaine appele ? Donnee par utilisateur : jamais cachee au-dela de la
 * requete.
 */
export const canManageCurrentNewsDal = cache(async (): Promise<boolean> => {
  const tenant = await requireCurrentTenantDal()
  return canManageNewsService(tenant.id)
})

/** Adresse publique de l'image d'une actualite. */
export const newsImageUrl = (key: string): string => contentFileUrl(key)
