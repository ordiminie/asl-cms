import {env} from '@/env'
import {normalizeTenantHost} from '@/lib/helper/tenant-helper'

/**
 * Hote d'une requete : `x-forwarded-host` d'abord, derriere le reverse proxy
 * du VPS (meme ordre que `getCurrentTenantDal`).
 */
export const requestHostOf = (headers: Headers | undefined) =>
  headers?.get('x-forwarded-host')?.split(',')[0]?.trim() ??
  headers?.get('host') ??
  undefined

/**
 * Caracteres de motif de Better Auth (`matchesOriginPattern`) : une origine
 * qui en porte un deviendrait un joker parmi les origines de confiance.
 */
const HOST_PATTERN_CHARACTERS = /[*?]/

/**
 * Origine d'une association (ADR 022) : l'adresse de la plateforme
 * (`BETTER_AUTH_URL`) dont le nom d'hote devient le domaine de l'association,
 * lu en base. Protocole et port sont ceux de la plateforme ; aucun en-tete
 * n'est lu, ce qui rend la fonction utilisable hors requete.
 */
export const associationOriginOf = (
  domain: string | null | undefined,
  platformUrl: string = env.BETTER_AUTH_URL
): string | undefined => {
  const hostname = normalizeTenantHost(domain)
  if (!hostname || HOST_PATTERN_CHARACTERS.test(hostname)) return undefined

  const origin = new URL(platformUrl)
  origin.hostname = hostname
  return origin.hostname === hostname ? origin.origin : undefined
}

const CALLBACK_PARAMS = [
  'callbackURL',
  'errorCallbackURL',
  'newUserCallbackURL',
] as const

/** Chemin d'une adresse de retour, reporte sur l'origine de l'association. */
const onOrigin = (callback: string, origin: string) => {
  const resolved = new URL(callback, origin)
  return `${origin}${resolved.pathname}${resolved.search}${resolved.hash}`
}

/**
 * Lien de connexion rebase sur l'origine de l'association (ADR 022). Le plugin
 * construit le lien sur le `baseURL` fixe : chemin et jeton sont gardes,
 * l'origine est remplacee, et chaque adresse de retour devient absolue sur
 * cette meme origine. Une adresse de retour vers une autre origine est ramenee
 * a son chemin : le lien ne redirige jamais hors de l'association.
 */
export const rebaseMagicLinkUrl = (url: string, origin: string): string => {
  const source = new URL(url)
  const rebased = new URL(`${source.pathname}${source.search}`, origin)
  for (const param of CALLBACK_PARAMS) {
    const callback = rebased.searchParams.get(param)
    if (callback !== null) {
      rebased.searchParams.set(param, onOrigin(callback, origin))
    }
  }
  return rebased.toString()
}

/**
 * Origines de confiance de Better Auth, calculees a chaque requete (ADR 022) :
 * la liste d'environnement, plus l'origine de l'association servie par l'hote
 * de la requete, lue en base. Une nouvelle association est reconnue des sa
 * ligne en base, sans redeploiement ; un hote inconnu n'ajoute rien. La
 * facade est chargee a l'appel, pour la meme raison que dans
 * `magic-link-integration.ts` (aucune arete statique vers les services).
 */
export const trustedOriginsOf = async (
  request?: Request
): Promise<string[]> => {
  const origins = [...env.BETTER_AUTH_TRUSTED_ORIGINS]
  const domain = normalizeTenantHost(requestHostOf(request?.headers))
  if (!domain) return origins

  const {getOrganizationByDomainService} =
    await import('@/services/facades/organization-service-facade')
  const organization = await getOrganizationByDomainService(domain)
  const origin = associationOriginOf(organization?.domain)
  return origin ? [...origins, origin] : origins
}
