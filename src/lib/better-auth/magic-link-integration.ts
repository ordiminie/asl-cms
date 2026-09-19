import {getUserByEmailDao} from '@/db/repositories/user-repository'
import {env} from '@/env'
import type {MagicLinkEmailAssociation} from '@/lib/emails/magic-link-email'
import {normalizeTenantHost} from '@/lib/helper/tenant-helper'
import {logger} from '@/lib/logger'
import {getAssociationSettingsService} from '@/services/facades/association-settings-service-facade'
import {sendMagicLinkEmailService} from '@/services/facades/email-service-facade'
import {getOrganizationByDomainService} from '@/services/facades/organization-service-facade'
import {getIdentityVersionFromKey} from '@/services/types/domain/association-identity-types'
import {getAccentHue} from '@/services/types/domain/association-settings-types'
import type {Organization} from '@/services/types/domain/organization-types'

import {MAGIC_LINK_EXPIRES_IN_SECONDS} from './magic-link-constants'

type SendMagicLinkData = {
  email: string
  url: string
}

/** Ce que `sendMagicLink` lit du contexte de requete de Better Auth. */
type MagicLinkRequestContext = {
  headers?: Headers
  request?: Request
}

const requestHeadersOf = (ctx?: MagicLinkRequestContext) =>
  ctx?.headers ?? ctx?.request?.headers

/**
 * Hote et protocole de la requete : `x-forwarded-*` d'abord, derriere le
 * reverse proxy du VPS (meme ordre que `getCurrentTenantDal`).
 */
const requestOriginOf = (headers: Headers | undefined) => {
  const host =
    headers?.get('x-forwarded-host')?.split(',')[0]?.trim() ??
    headers?.get('host') ??
    undefined
  const protocol =
    headers?.get('x-forwarded-proto')?.split(',')[0]?.trim() ??
    new URL(env.BETTER_AUTH_URL).protocol.replace(':', '')

  return {host, origin: host ? `${protocol}://${host}` : undefined}
}

/**
 * Le logo n'est montre dans l'email qu'en PNG (design system §1.8, §5.2) : un
 * WebP est mal rendu par plusieurs messageries, le nom seul le remplace.
 */
const pngLogoUrlOf = (
  organization: Organization,
  origin: string | undefined
) => {
  const logoKey = organization.identityLogoKey
  const version = getIdentityVersionFromKey(logoKey)
  if (!origin || !version || !logoKey?.endsWith('.png')) {
    return undefined
  }
  return `${origin}/api/identity/logo?v=${encodeURIComponent(version)}`
}

/**
 * L'association du domaine appele, telle que l'email la montre. Lue par les
 * facades de service, pas par la DAL : `src/lib` ne remonte pas vers la
 * presentation, et l'import de la DAL fermait un cycle
 * organization-service -> auth -> DAL -> organization-service qui cassait le
 * build de production.
 */
const associationOfRequest = async (
  ctx?: MagicLinkRequestContext
): Promise<MagicLinkEmailAssociation | undefined> => {
  const {host, origin} = requestOriginOf(requestHeadersOf(ctx))
  const domain = normalizeTenantHost(host)
  const organization = domain
    ? await getOrganizationByDomainService(domain)
    : undefined
  if (!organization?.domain) return undefined

  const settings = await getAssociationSettingsService(organization.id)
  const logoUrl = pngLogoUrlOf(organization, origin)

  return {
    name: organization.name,
    hue: getAccentHue(settings),
    ...(logoUrl ? {logoUrl} : {}),
  }
}

/**
 * Envoi du lien de connexion (s03). Adresse inconnue : **rien** — ni email ni
 * compte (`disableSignUp`). Adresse connue : l'email de l'association du
 * domaine appele, par le service d'email (plus de notification : un lien
 * secret n'a rien a faire dans la liste des notifications). Ni l'URL ni le
 * jeton ne sont journalises. Un echec du transport remonte a Better Auth.
 */
export async function sendMagicLink(
  {email, url}: SendMagicLinkData,
  ctx?: MagicLinkRequestContext
) {
  const user = await getUserByEmailDao(email)
  if (!user) return

  const association = await associationOfRequest(ctx)
  if (!association) {
    logger.warn(
      '[MAGIC-LINK] Aucune association sur le domaine appele : lien non envoye'
    )
    return
  }

  await sendMagicLinkEmailService({email, url, association})
}

/** Options du plugin `magicLink` de Better Auth : configurer, pas reecrire. */
export const magicLinkOptions = {
  expiresIn: MAGIC_LINK_EXPIRES_IN_SECONDS,
  disableSignUp: true,
  sendMagicLink,
}
