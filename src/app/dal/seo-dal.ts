import 'server-only'

import {cache} from 'react'

import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {associationOriginOf} from '@/lib/better-auth/association-origin'
import {AssociationSeoContext} from '@/lib/seo/resolve-metadata'
import {getIdentityVersionFromKey} from '@/services/types/domain/association-identity-types'
import {
  getAccentHue,
  getAssociationDescription,
  getGoogleVerificationCode,
} from '@/services/types/domain/association-settings-types'

/** Ce que les metadonnees publiques savent de l'association (s11). */
export type AssociationSeoDTO = AssociationSeoContext & {
  /** Code de la Search Console ; absent, aucune balise n'est emise. */
  googleVerification: string | undefined
}

/**
 * L'association du domaine appele, telle que la lisent `generateMetadata`,
 * le sitemap et `robots.txt` : son nom, ses reglages de referencement, sa
 * teinte, la version de son logo et son origine absolue. Rien sur un domaine
 * qui ne sert aucune association.
 *
 * Par requete seulement (`cache()` de React) : le tenant et les reglages sont
 * deja caches en amont, par association.
 */
export const getCurrentAssociationSeoDal = cache(
  async (): Promise<AssociationSeoDTO | undefined> => {
    const tenant = await getCurrentTenantDal()
    if (!tenant) return undefined

    const origin = associationOriginOf(tenant.domain)
    if (!origin) return undefined

    const settings = await getAssociationSettingsDal(tenant.id)

    return {
      name: tenant.name,
      description: getAssociationDescription(settings) ?? null,
      googleVerification: getGoogleVerificationCode(settings),
      logoVersion: getIdentityVersionFromKey(tenant.logoKey),
      hue: getAccentHue(settings),
      origin,
    }
  }
)
