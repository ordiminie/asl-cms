import 'server-only'

import {cacheLife, cacheTag} from 'next/cache'
import {headers} from 'next/headers'
import {notFound} from 'next/navigation'
import {cache} from 'react'

import {withTenant} from '@/db/tenant-scope'
import {isModuleEnabled, normalizeTenantHost} from '@/lib/helper/tenant-helper'
import {getOrganizationByDomainService} from '@/services/facades/organization-service-facade'
import {OrganizationModule} from '@/services/types/domain/organization-types'

/**
 * Le tenant tel que la presentation le voit. Volontairement etroit : ni
 * `metadata`, ni `limitOverrides`, ni horodatages — ce DTO traverse le cache,
 * dont les cles et les valeurs sont stockees en clair.
 */
export type TenantDTO = {
  id: string
  name: string
  slug: string
  domain: string
  enabledModules: OrganizationModule[]
  /** Cle de stockage du logo (ADR 015), `null` sans logo. */
  logoKey: string | null
  /** Cle de stockage du favicon (ADR 015), `null` sans favicon. */
  faviconKey: string | null
}

/** Le tag d'invalidation. Le provisioning appelle `updateTag(TENANT_CACHE_TAG)`. */
export const TENANT_CACHE_TAG = 'tenant'

/**
 * Resolution du tenant par le domaine (ADR 003).
 *
 * Le domaine est un **argument**, pas une lecture d'en-tete : `headers()` est
 * interdit dans un scope `'use cache'`, et c'est cette separation qui rend la
 * fonction cachable. Aucun appel a `logger` ici non plus — Winston horodate
 * via `new Date()`, interdit en scope cache (la neutralisation de
 * `src/lib/logger.ts` ne couvre que le build, pas le runtime).
 */
export const getTenantByDomainDal = cache(
  async (domain: string): Promise<TenantDTO | undefined> => {
    'use cache'
    cacheLife('hours')
    cacheTag(TENANT_CACHE_TAG)

    const organization = await getOrganizationByDomainService(domain)
    if (!organization?.domain) {
      return undefined
    }

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      domain: organization.domain,
      enabledModules: organization.enabledModules,
      logoKey: organization.identityLogoKey ?? null,
      faviconKey: organization.identityFaviconKey ?? null,
    }
  }
)

/**
 * Le tenant servi par le domaine de la requete courante, ou rien.
 *
 * `x-forwarded-host` avant `host` : derriere le reverse proxy du VPS, c'est le
 * premier qui porte le domaine demande par le visiteur.
 */
export const getCurrentTenantDal = cache(
  async (): Promise<TenantDTO | undefined> => {
    const headersList = await headers()
    const domain = normalizeTenantHost(
      headersList.get('x-forwarded-host') ?? headersList.get('host')
    )

    if (!domain) {
      return undefined
    }

    return getTenantByDomainDal(domain)
  }
)

/**
 * Le tenant servi par le domaine courant, ou la page introuvable.
 *
 * « Introuvable » et non « 404 » : sous Cache Components, un `notFound()`
 * declenche en cours de rendu part apres le debut d'un 200 (ADR 013). Ce que
 * la garantie couvre est le contenu : aucun tenant n'est servi.
 */
export const requireCurrentTenantDal = async (): Promise<TenantDTO> => {
  const tenant = await getCurrentTenantDal()
  if (!tenant) {
    notFound()
  }

  return tenant
}

/**
 * Point d'entree unique du scope de tenant pour un chemin serveur : resout le
 * tenant du domaine appele et execute `callback` dedans (ADR 002 + ADR 003).
 *
 * Sur un domaine qui ne sert aucune association, **aucun scope n'est ouvert**
 * et le callback s'execute quand meme : les tables couvertes par une policy ne
 * rendent alors rien et refusent toute ecriture. C'est la garantie du projet —
 * « un oubli de scope ne fuite pas : il ne retourne rien » — plutot qu'une
 * exception, qui casserait les chemins legitimement hors tenant.
 */
export const withCurrentTenant = async <T>(
  callback: () => Promise<T>
): Promise<T> => {
  const tenant = await getCurrentTenantDal()
  if (!tenant) {
    return callback()
  }

  return withTenant(tenant.id, callback)
}

/**
 * Le helper unique de controle d'activation d'un module (ADR 010), a appeler
 * en tete de toute route et de toute Server Action rattachee a un module.
 *
 * Module inactif **ou cle inconnue** : la page est introuvable. Une cle
 * inconnue est traitee comme inactive, ce qui rend le controle vrai pour un
 * module fictif comme pour un module reel desactive.
 */
export const requireEnabledModuleDal = async (
  moduleKey: string
): Promise<TenantDTO> => {
  const tenant = await requireCurrentTenantDal()

  if (!isModuleEnabled(tenant.enabledModules, moduleKey)) {
    notFound()
  }

  return tenant
}
