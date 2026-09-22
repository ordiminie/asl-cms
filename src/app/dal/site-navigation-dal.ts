import 'server-only'

import {cacheLife, cacheTag} from 'next/cache'
import {cache} from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  canManageSiteNavigationService,
  getMenuItemsForBureauService,
  getPublicSiteNavigationService,
  getSiteFooterService,
} from '@/services/facades/site-navigation-service-facade'
import {
  MenuItemDTO,
  SiteNavigationDTO,
} from '@/services/types/domain/site-navigation-types'

/**
 * Tag d'invalidation de la navigation d'une association. **Un seul tag pour le
 * menu et le pied de page** (ADR 021) : le layout public les lit toujours
 * ensemble, donc il les invalide ensemble.
 *
 * Il porte l'identifiant de l'association seul : les tags sont stockes en
 * clair, aucune donnee personnelle dedans.
 *
 * ⚠️ Ce tag est aussi invalide par le code de s04
 * (`bureau/pages/[id]/actions.ts`) : publier ou depublier une page change le
 * menu qui la reference (critere 5). L'oubli ne se voit pas en developpement,
 * ou le cache est froid.
 */
export const siteNavigationTag = (organizationId: string): string =>
  `site-navigation:${organizationId}`

/**
 * Lecture cachee de la navigation publique. Fonction **interne** : elle prend
 * l'identifiant de l'association en argument, et seuls les appelants ci-dessous
 * le fournissent — celui du domaine appele.
 *
 * Aucun appel direct a `logger` ici, aucune lecture d'horloge ni de requete
 * (`headers()`, `cookies()`, `Math.random()`) : interdits en scope cache.
 */
const readPublicSiteNavigationCached = cache(
  async (organizationId: string): Promise<SiteNavigationDTO> => {
    'use cache'
    cacheLife('hours')
    cacheTag(siteNavigationTag(organizationId))

    return getPublicSiteNavigationService(organizationId)
  }
)

/**
 * Le menu et le pied de page servis au visiteur : entrees laissees visibles par
 * le bureau **et** dont la page est publiee, dans leur ordre.
 */
export const getPublicSiteNavigationDal = async (
  organizationId: string
): Promise<SiteNavigationDTO> => readPublicSiteNavigationCached(organizationId)

/** La navigation de l'association du domaine appele, pour le layout public. */
export const getCurrentPublicSiteNavigationDal = cache(
  async (): Promise<SiteNavigationDTO> => {
    const tenant = await requireCurrentTenantDal()
    return getPublicSiteNavigationDal(tenant.id)
  }
)

export type BureauSiteNavigation = {
  menu: MenuItemDTO[]
  footerContent: string
}

/**
 * La navigation telle que l'ecran de gestion l'affiche : **toutes** les
 * entrees, statuts compris. Non cachee — c'est un ecran d'administration, qui
 * doit refleter la derniere modification sans attendre une invalidation.
 */
export const getSiteNavigationForBureauDal = cache(
  async (organizationId: string): Promise<BureauSiteNavigation> => {
    const [menu, footerContent] = await Promise.all([
      getMenuItemsForBureauService(organizationId),
      getSiteFooterService(organizationId),
    ])
    return {menu, footerContent}
  }
)

/**
 * L'utilisateur connecte peut-il gerer la navigation de l'association du
 * domaine appele ? Donnee par utilisateur : jamais cachee au-dela de la
 * requete.
 */
export const canManageCurrentSiteNavigationDal = cache(
  async (): Promise<boolean> => {
    const tenant = await requireCurrentTenantDal()
    return canManageSiteNavigationService(tenant.id)
  }
)
