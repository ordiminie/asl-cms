import 'server-only'

import {createHmac} from 'node:crypto'

import {
  addRateLimitEventsDao,
  countRateLimitEventsDao,
  purgeRateLimitEventsDao,
} from '@/db/repositories/rate-limit-repository'
import {withTenant} from '@/db/tenant-scope'
import {env} from '@/env'

import {getAssociationSettingsService} from './association-settings-service'
import {ValidationParsedZodError} from './errors/validation-error'
import {getMagicLinkRequestLimits} from './types/domain/association-settings-types'
import {magicLinkRequestQuotaServiceSchema} from './validation/rate-limit-validation'

export const MAGIC_LINK_ADDRESS_BUCKET = 'magic_link.address'
export const MAGIC_LINK_NETWORK_BUCKET = 'magic_link.network'

/** Les seuils du bureau sont des nombres de demandes **par heure** glissante. */
const QUOTA_WINDOW_MS = 60 * 60 * 1000
/** Retention des empreintes (PRD : purge sous 24 h). */
const RETENTION_MS = 24 * 60 * 60 * 1000

export type MagicLinkRequestQuota = {
  organizationId: string
  email: string
  /** IP de la requete ; absente, seul le seuil par adresse s'applique. */
  ip?: string
}

type QuotaBucket = {bucket: string; fingerprint: string; limit: number}

/**
 * Empreinte d'une valeur : HMAC-SHA256 par le secret du serveur, lie a
 * l'association et au seau. Ni l'adresse ni l'IP ne sont stockees en clair, et
 * deux associations ne peuvent pas rapprocher leurs empreintes.
 */
const fingerprintOf = (organizationId: string, bucket: string, value: string) =>
  createHmac('sha256', env.BETTER_AUTH_SECRET)
    .update(`${organizationId}\n${bucket}\n${value}`)
    .digest('hex')

/**
 * Consomme une demande de lien de connexion (s03), par adresse **et** par
 * acces internet, aux seuils horaires reglables par le bureau
 * (`getMagicLinkRequestLimits`, ADR 010). Au-dela d'un seuil : `allowed:
 * false`, et la demande n'est pas comptee.
 *
 * **Sans controle d'autorisation, et c'est delibere** : la demande de lien est
 * faite par un visiteur anonyme. Appelee seulement par l'integration Better
 * Auth, cote serveur.
 */
export const consumeMagicLinkRequestQuotaService = async (
  quota: MagicLinkRequestQuota
): Promise<{allowed: boolean}> => {
  const parsed = magicLinkRequestQuotaServiceSchema.safeParse(quota)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }
  const {organizationId, email, ip} = parsed.data

  const limits = getMagicLinkRequestLimits(
    await getAssociationSettingsService(organizationId)
  )
  const buckets: QuotaBucket[] = [
    {
      bucket: MAGIC_LINK_ADDRESS_BUCKET,
      fingerprint: fingerprintOf(
        organizationId,
        MAGIC_LINK_ADDRESS_BUCKET,
        email
      ),
      limit: limits.perAddress,
    },
    ...(ip
      ? [
          {
            bucket: MAGIC_LINK_NETWORK_BUCKET,
            fingerprint: fingerprintOf(
              organizationId,
              MAGIC_LINK_NETWORK_BUCKET,
              ip
            ),
            limit: limits.perNetwork,
          },
        ]
      : []),
  ]

  const now = Date.now()
  return withTenant(organizationId, async () => {
    await purgeRateLimitEventsDao(organizationId, new Date(now - RETENTION_MS))

    const since = new Date(now - QUOTA_WINDOW_MS)
    for (const {bucket, fingerprint, limit} of buckets) {
      const used = await countRateLimitEventsDao({
        organizationId,
        bucket,
        fingerprint,
        since,
      })
      if (used >= limit) return {allowed: false}
    }

    await addRateLimitEventsDao(
      buckets.map(({bucket, fingerprint}) => ({
        organizationId,
        bucket,
        fingerprint,
      }))
    )
    return {allowed: true}
  })
}
