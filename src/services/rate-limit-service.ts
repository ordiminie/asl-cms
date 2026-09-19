import 'server-only'

import {createHmac} from 'node:crypto'

import {
  incrementRateLimitCounterDao,
  purgeRateLimitCountersDao,
} from '@/db/repositories/rate-limit-repository'
import {withTenant} from '@/db/tenant-scope'
import {env} from '@/env'

import {getAssociationSettingsService} from './association-settings-service'
import {ValidationParsedZodError} from './errors/validation-error'
import {getMagicLinkDailyRequestLimit} from './types/domain/association-settings-types'
import {magicLinkRequestQuotaServiceSchema} from './validation/rate-limit-validation'

/** Usage compte : separe les empreintes des futurs usages de la table. */
const MAGIC_LINK_ADDRESS_PURPOSE = 'magic_link.address'

/** Le jour du compteur est celui des associations servies (France). */
const COUNTER_TIME_ZONE = 'Europe/Paris'

export type MagicLinkRequestQuota = {
  organizationId: string
  email: string
}

/**
 * Empreinte d'une adresse : HMAC-SHA256 par le secret du serveur, lie a
 * l'association et a l'usage. L'adresse n'est jamais stockee en clair, et deux
 * associations ne peuvent pas rapprocher leurs empreintes.
 */
const fingerprintOf = (organizationId: string, value: string) =>
  createHmac('sha256', env.BETTER_AUTH_SECRET)
    .update(`${organizationId}\n${MAGIC_LINK_ADDRESS_PURPOSE}\n${value}`)
    .digest('hex')

/** Le jour calendaire a Paris, `YYYY-MM-DD`. */
const counterDayOf = (instant: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: COUNTER_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)

/**
 * Consomme une demande de lien de connexion (s03) : au plus N demandes par
 * adresse et par jour (Europe/Paris), N reglable par le bureau
 * (`getMagicLinkDailyRequestLimit`, ADR 010, 3 par defaut). Chaque demande est
 * comptee par un incrément atomique, adresse connue ou non ; au-dela du seuil :
 * `allowed: false`. Les compteurs des jours passes sont purges a chaque
 * demande : le changement de jour remet a zero sans tache planifiee.
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
  const {organizationId, email} = parsed.data

  const limit = getMagicLinkDailyRequestLimit(
    await getAssociationSettingsService(organizationId)
  )
  const day = counterDayOf(new Date())

  return withTenant(organizationId, async () => {
    await purgeRateLimitCountersDao(organizationId, day)
    const count = await incrementRateLimitCounterDao({
      organizationId,
      fingerprint: fingerprintOf(organizationId, email),
      day,
    })
    return {allowed: count <= limit}
  })
}
