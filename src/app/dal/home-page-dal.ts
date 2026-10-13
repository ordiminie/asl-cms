import 'server-only'

import {cacheLife, cacheTag} from 'next/cache'
import {cache} from 'react'

import {pageTag} from '@/app/dal/page-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  canManageHomePageService,
  getHomePageForBureauService,
  getPublicHomePageService,
} from '@/services/facades/home-page-service-facade'
import {HomePageForBureauDTO} from '@/services/types/domain/home-page-types'
import {PageWithBlocksDTO} from '@/services/types/domain/page-types'

/**
 * Tag d'invalidation du **choix** de la page d'accueil d'une association
 * (s44, ADR 032). Les tags sont stockes en clair : rien d'autre que
 * l'identifiant de l'association. L'action du bureau appelle
 * `updateTag(homePageTag(...))` **apres** le succes de l'ecriture.
 */
export const homePageTag = (organizationId: string): string =>
  `home-page:${organizationId}`

/**
 * Lecture cachee de la page designee, **quel que soit son statut**. Fonction
 * **interne** : elle prend l'identifiant de l'association en argument, et
 * seuls les appelants ci-dessous le fournissent.
 *
 * Deux tags : celui du choix, et — une fois la page connue — celui de la page
 * (`pageTag`), que les actions de pages invalident deja a la creation, la
 * modification, la publication et la depublication. Taguer la page meme en
 * brouillon est ce qui fait reapparaitre l'accueil a sa republication.
 *
 * Aucun appel direct a `logger`, aucune horloge, aucune lecture de requete
 * dans ce scope. Le compromis herite sur l'intercepteur de journalisation des
 * facades est celui decrit dans `page-dal.ts`.
 */
const readPublicHomePageCached = cache(
  async (organizationId: string): Promise<PageWithBlocksDTO | undefined> => {
    'use cache'
    cacheLife('hours')
    cacheTag(homePageTag(organizationId))

    const page = await getPublicHomePageService(organizationId)
    if (page) {
      cacheTag(pageTag(organizationId, page.slug))
    }
    return page
  }
)

/**
 * La page d'accueil servie au visiteur : publiee, ou rien — l'accueil minimal
 * prend alors le relais. Le filtre est hors du scope cache, comme
 * `getPublicPageBySlugDal`.
 */
export const getPublicHomePageDal = async (
  organizationId: string
): Promise<PageWithBlocksDTO | undefined> => {
  const page = await readPublicHomePageCached(organizationId)
  return page?.status === 'published' ? page : undefined
}

/** La page d'accueil de l'association du domaine appele. */
export const getCurrentPublicHomePageDal = cache(
  async (): Promise<PageWithBlocksDTO | undefined> => {
    const tenant = await requireCurrentTenantDal()
    return getPublicHomePageDal(tenant.id)
  }
)

/**
 * Le choix tel que l'ecran du bureau l'affiche. Non cachee : c'est un ecran
 * d'administration, qui doit refleter le dernier enregistrement.
 */
export const getHomePageForBureauDal = cache(
  async (organizationId: string): Promise<HomePageForBureauDTO> =>
    getHomePageForBureauService(organizationId)
)

/**
 * L'utilisateur connecte peut-il choisir la page d'accueil de l'association
 * du domaine appele ? Donnee par utilisateur : jamais cachee au-dela de la
 * requete.
 */
export const canManageCurrentHomePageDal = cache(async (): Promise<boolean> => {
  const tenant = await requireCurrentTenantDal()
  return canManageHomePageService(tenant.id)
})
