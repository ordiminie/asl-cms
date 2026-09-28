import 'server-only'

import {createHmac} from 'node:crypto'

import {getAllOrganizationIdsDao} from '@/db/repositories/organization-repository'
import {
  incrementRateLimitCounterDao,
  purgeRateLimitCountersDao,
} from '@/db/repositories/rate-limit-repository'
import {withTenant} from '@/db/tenant-scope'
import {env} from '@/env'
import {logger} from '@/lib/logger'

import {getAssociationSettingsService} from './association-settings-service'
import {ValidationParsedZodError} from './errors/validation-error'
import {
  getContactMessagesPerHourLimit,
  getMagicLinkDailyRequestLimit,
} from './types/domain/association-settings-types'
import {
  contactMessageQuotaServiceSchema,
  magicLinkRequestQuotaServiceSchema,
} from './validation/rate-limit-validation'

/**
 * Usage compte : il entre dans l'empreinte, et separe les compteurs des usages
 * qui partagent la table. `magic_link.address` est la chaine de s03, reprise
 * au caractere pres : ses compteurs en cours restent valides.
 */
export const RateLimitPurposeConst = {
  MAGIC_LINK_ADDRESS: 'magic_link.address',
  CONTACT_IP: 'contact.ip',
} as const

export type RateLimitPurpose =
  (typeof RateLimitPurposeConst)[keyof typeof RateLimitPurposeConst]

/** Le jour du compteur est celui des associations servies (France). */
const COUNTER_TIME_ZONE = 'Europe/Paris'

const HOUR_MS = 60 * 60 * 1000

/** Age au-dela duquel une empreinte est purgee (s08b, critere 3). */
const FINGERPRINT_RETENTION_MS = 24 * HOUR_MS

export type MagicLinkRequestQuota = {
  organizationId: string
  email: string
}

export type ContactMessageQuota = {
  organizationId: string
  /** Adresse IP du visiteur ; absente si l'en-tete du proxy manque. */
  ip?: string
}

export type ContactMessageQuotaResult = {allowed: boolean; limit: number}

/**
 * Empreinte d'une valeur comptee : HMAC-SHA256 par le secret du serveur, lie a
 * l'association et a l'usage. La valeur n'est jamais stockee en clair, deux
 * associations ne peuvent pas rapprocher leurs empreintes, et un hash nu (qui
 * se renverse par force brute sur 2^32 adresses IPv4) n'est jamais utilise.
 */
export const fingerprintOf = (
  organizationId: string,
  purpose: RateLimitPurpose,
  value: string
): string =>
  createHmac('sha256', env.BETTER_AUTH_SECRET)
    .update(`${organizationId}\n${purpose}\n${value}`)
    .digest('hex')

/** Decalage de Paris par rapport a UTC a un instant donne, en millisecondes. */
const parisOffsetMsAt = (instant: Date): number => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: COUNTER_TIME_ZONE,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(instant)
      .map(({type, value}) => [type, Number(value)])
  )
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/**
 * Debut du jour calendaire a Paris (minuit). Le changement d'heure a lieu a
 * 2 h ou 3 h locales : le decalage a minuit UTC du jour est celui de minuit a
 * Paris.
 */
export const dayWindowStartOf = (instant: Date): Date => {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone: COUNTER_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(instant)
    .split('-')
    .map(Number)
  const utcMidnight = new Date(Date.UTC(year, month - 1, day))
  return new Date(utcMidnight.getTime() - parisOffsetMsAt(utcMidnight))
}

/**
 * Debut de l'heure courante. Les decalages de Paris sont des heures entieres :
 * la troncature UTC coincide avec l'heure locale.
 */
export const hourWindowStartOf = (instant: Date): Date =>
  new Date(Math.floor(instant.getTime() / HOUR_MS) * HOUR_MS)

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
  const windowStart = dayWindowStartOf(new Date())

  return withTenant(organizationId, async () => {
    await purgeRateLimitCountersDao(organizationId, windowStart)
    const count = await incrementRateLimitCounterDao({
      organizationId,
      fingerprint: fingerprintOf(
        organizationId,
        RateLimitPurposeConst.MAGIC_LINK_ADDRESS,
        email
      ),
      windowStart,
    })
    return {allowed: count <= limit}
  })
}

/**
 * Consomme un envoi de formulaire public (s08b) : au plus N envois par visiteur
 * et par heure, N reglable par le bureau (`getContactMessagesPerHourLimit`,
 * ADR 010, 3 par defaut), le visiteur etant reconnu a l'**empreinte** de son
 * adresse IP. A chaque envoi, les empreintes de plus de 24 h de l'association
 * sont purgees, puis l'envoi est compte par un incrément atomique.
 *
 * Sans IP resoluble, l'envoi passe **sans etre compte** : un seau commun a
 * tous les visiteurs couperait le formulaire pour toute l'association.
 *
 * **Sans controle d'autorisation, et c'est delibere** : l'auteur est un
 * visiteur anonyme. L'IP ne traverse que cette methode, dont l'intercepteur ne
 * journalise pas les arguments.
 */
export const consumeContactMessageQuotaService = async (
  quota: ContactMessageQuota
): Promise<ContactMessageQuotaResult> => {
  const parsed = contactMessageQuotaServiceSchema.safeParse(quota)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }
  const {organizationId, ip} = parsed.data

  const limit = getContactMessagesPerHourLimit(
    await getAssociationSettingsService(organizationId)
  )
  if (!ip) {
    logger.warn(
      '[RATE-LIMIT-SERVICE] Adresse IP du visiteur introuvable : envoi non compte'
    )
    return {allowed: true, limit}
  }

  const now = new Date()
  return withTenant(organizationId, async () => {
    await purgeRateLimitCountersDao(
      organizationId,
      new Date(now.getTime() - FINGERPRINT_RETENTION_MS)
    )
    const count = await incrementRateLimitCounterDao({
      organizationId,
      fingerprint: fingerprintOf(
        organizationId,
        RateLimitPurposeConst.CONTACT_IP,
        ip
      ),
      windowStart: hourWindowStartOf(now),
    })
    return {allowed: count <= limit, limit}
  })
}

export type RateLimitPurgeResult = {organizations: number; deleted: number}

/**
 * Purge, hors de toute requete, les empreintes de plus de 24 h de **toutes**
 * les associations (s08b, critere 3). Chaque association est purgee dans son
 * propre `withTenant` : sous RLS forcee, une suppression sans scope ne
 * supprimerait rien, sans erreur. Jamais `withRlsBypass()`.
 *
 * **Sans controle d'autorisation, et c'est delibere** : operation de
 * maintenance appelee par un script serveur, sans session.
 */
export const purgeExpiredRateLimitFingerprintsService =
  async (): Promise<RateLimitPurgeResult> => {
    const cutoff = new Date(Date.now() - FINGERPRINT_RETENTION_MS)
    const organizationIds = await getAllOrganizationIdsDao()

    let deleted = 0
    for (const organizationId of organizationIds) {
      deleted += await withTenant(organizationId, () =>
        purgeRateLimitCountersDao(organizationId, cutoff)
      )
    }
    return {organizations: organizationIds.length, deleted}
  }
