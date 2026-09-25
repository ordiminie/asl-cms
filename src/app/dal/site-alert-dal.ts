import 'server-only'

import {cacheLife, cacheTag} from 'next/cache'
import {cache} from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  canManageSiteAlertService,
  getPublicSiteAlertService,
  getSiteAlertService,
} from '@/services/facades/site-alert-service-facade'
import {
  PublicSiteAlertDTO,
  SiteAlertDTO,
} from '@/services/types/domain/site-alert-types'

/**
 * Tag d'invalidation du bandeau d'alerte d'une association. Porte
 * l'identifiant seul : les tags sont stockes en clair, aucune donnee
 * personnelle dedans.
 *
 * ⚠️ Invalide par `updateTag` dans les Server Actions de `/bureau/alerte`,
 * **apres** succes. L'oubli ne se voit pas en developpement, ou le cache est
 * froid : c'est l'e2e, sur le build de production, qui le prouve.
 */
export const siteAlertTag = (organizationId: string): string =>
  `site-alert:${organizationId}`

/**
 * Lecture cachee du bandeau public. Fonction **interne** : elle prend
 * l'identifiant de l'association en argument, fourni par le layout commun a
 * partir du domaine appele.
 *
 * Rien qui journalise, lise l'horloge ou la requete ici : interdit en scope
 * cache. Le service rend `null` quand le bandeau est masque — la valeur cachee
 * ne porte donc jamais un message retire.
 */
const readPublicSiteAlertCached = cache(
  async (organizationId: string): Promise<PublicSiteAlertDTO | null> => {
    'use cache'
    cacheLife('hours')
    cacheTag(siteAlertTag(organizationId))

    return getPublicSiteAlertService(organizationId)
  }
)

/** Le bandeau servi sur toutes les pages, ou `null` s'il n'est pas affiche. */
export const getPublicSiteAlertDal = async (
  organizationId: string
): Promise<PublicSiteAlertDTO | null> =>
  readPublicSiteAlertCached(organizationId)

/**
 * Le bandeau tel que l'ecran du bureau l'edite. Non cache — c'est un ecran
 * d'administration, qui doit refleter la derniere modification.
 */
export const getSiteAlertForBureauDal = cache(
  async (organizationId: string): Promise<SiteAlertDTO> =>
    getSiteAlertService(organizationId)
)

/**
 * L'utilisateur connecte peut-il gerer le bandeau de l'association du domaine
 * appele ? Donnee par utilisateur : jamais cachee au-dela de la requete.
 */
export const canManageCurrentSiteAlertDal = cache(
  async (): Promise<boolean> => {
    const tenant = await requireCurrentTenantDal()
    return canManageSiteAlertService(tenant.id)
  }
)
