import 'server-only'

import {cacheLife, cacheTag} from 'next/cache'
import {cache} from 'react'

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {getAssociationSettingsService} from '@/services/facades/association-settings-service-facade'
import {ResolvedAssociationSettings} from '@/services/types/domain/association-settings-types'

/**
 * Tag d'invalidation des parametres d'une association. Porte l'identifiant
 * seul : les tags sont stockes en clair, jamais de donnee personnelle dedans.
 */
export const associationSettingsTag = (organizationId: string): string =>
  `association-settings:${organizationId}`

/**
 * Parametres d'une association, defauts du registre appliques (ADR 016).
 *
 * Lus sur chaque page (la teinte), donc caches ; l'identifiant est un
 * **argument** et le service ouvre lui-meme `withTenant(...)` : le scope de
 * l'appelant n'est pas une garantie dans un scope cache. Invalidation par
 * `updateTag(associationSettingsTag(id))` dans les actions du bureau. Aucun
 * appel a `logger` ici : Winston horodate, ce qui est interdit en scope cache.
 */
export const getAssociationSettingsDal = cache(
  async (organizationId: string): Promise<ResolvedAssociationSettings> => {
    'use cache'
    cacheLife('hours')
    cacheTag(associationSettingsTag(organizationId))

    return getAssociationSettingsService(organizationId)
  }
)

/** Parametres de l'association du domaine appele, ou rien sans association. */
export const getCurrentAssociationSettingsDal = cache(
  async (): Promise<ResolvedAssociationSettings | undefined> => {
    const tenant = await getCurrentTenantDal()
    if (!tenant) return undefined

    return getAssociationSettingsDal(tenant.id)
  }
)
