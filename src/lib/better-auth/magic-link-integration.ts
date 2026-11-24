import {getUserByEmailDao} from '@/db/repositories/user-repository'
import type {MagicLinkEmailAssociation} from '@/lib/emails/magic-link-email'
import {resolveSupportedLocale} from '@/lib/helper/locale-helper'
import {logger} from '@/lib/logger'
import {getIdentityVersionFromKey} from '@/services/types/domain/association-identity-types'
import {getAccentHue} from '@/services/types/domain/association-settings-types'
import type {Organization} from '@/services/types/domain/organization-types'

import {canOpenSessionOn, organizationOfRequest} from './association-membership'
import {
  associationOriginOf,
  rebaseMagicLinkUrl,
  requestHostOf,
} from './association-origin'
import type {InvitationLinkRequest} from './invitation-link'
import {
  MAGIC_LINK_EXPIRES_IN_SECONDS,
  MAGIC_LINK_VERIFY_RATE_LIMIT,
} from './magic-link-constants'

type SendMagicLinkData = {
  email: string
  url: string
  token?: string
  /** `body.metadata` de `signInMagicLink`, transmis tel quel par le plugin. */
  metadata?: Record<string, unknown>
}

type VerificationWhere = {
  field: 'identifier' | 'value'
  value: string
  operator?: 'eq' | 'ne'
}

/** Ce que `sendMagicLink` lit du contexte de requete de Better Auth. */
type MagicLinkRequestContext = {
  headers?: Headers
  request?: Request
  context?: {
    adapter: {
      deleteMany: (data: {
        model: string
        where: VerificationWhere[]
      }) => Promise<number>
      update: (data: {
        model: string
        where: VerificationWhere[]
        update: {expiresAt: Date}
      }) => Promise<unknown>
    }
  }
}

const requestHeadersOf = (ctx?: MagicLinkRequestContext) =>
  ctx?.headers ?? ctx?.request?.headers

/**
 * Le logo n'est montre dans l'email qu'en PNG (design system §1.8, §5.2) : un
 * WebP est mal rendu par plusieurs messageries, le nom seul le remplace.
 */
const pngLogoUrlOf = (organization: Organization, origin: string) => {
  const logoKey = organization.identityLogoKey
  const version = getIdentityVersionFromKey(logoKey)
  if (!version || !logoKey?.endsWith('.png')) {
    return undefined
  }
  return `${origin}/api/identity/logo?v=${encodeURIComponent(version)}`
}

/**
 * Les facades de service, chargees **a l'appel** et jamais au chargement du
 * module. `auth.ts` importe ce module ; or chaque facade charge son service,
 * qui charge `auth-service`, qui charge `auth.ts`. Un import statique fermerait
 * ce cycle, et `createServiceInterceptor` lit l'espace de noms du service des
 * son chargement : selon l'ordre d'evaluation, une zone morte temporelle
 * (`Cannot access '…' before initialization`) casse le build de production.
 * L'import dynamique retire toute arete statique vers la couche service :
 * le cycle n'existe plus, quel que soit l'ordre. Garde :
 * `magic-link-integration-imports.test.ts` parcourt le graphe d'imports.
 */
const loadServices = async () => {
  const [settings, emails, rateLimits] = await Promise.all([
    import('@/services/facades/association-settings-service-facade'),
    import('@/services/facades/email-service-facade'),
    import('@/services/facades/rate-limit-service-facade'),
  ])
  return {
    getAssociationSettingsService: settings.getAssociationSettingsService,
    sendMagicLinkEmailService: emails.sendMagicLinkEmailService,
    consumeMagicLinkRequestQuotaService:
      rateLimits.consumeMagicLinkRequestQuotaService,
  }
}

type MagicLinkServices = Awaited<ReturnType<typeof loadServices>>

/** L'association telle que l'email la montre : nom, teinte, logo PNG. */
const emailAssociationOf = async (
  organization: Organization,
  origin: string,
  services: MagicLinkServices
): Promise<MagicLinkEmailAssociation> => {
  const settings = await services.getAssociationSettingsService(organization.id)
  const logoUrl = pngLogoUrlOf(organization, origin)

  return {
    name: organization.name,
    hue: getAccentHue(settings),
    ...(logoUrl ? {logoUrl} : {}),
  }
}

/**
 * Revoque les liens encore en attente pour cette adresse, sauf celui qui part :
 * seul le dernier lien envoye fonctionne (« Le precedent ne fonctionne plus »,
 * ecran B). La table `verification` appartient a Better Auth : on la touche par
 * **son** adaptateur, celui du contexte de l'appel, comme le plugin qui vient
 * d'y ecrire la ligne. Format du plugin 1.7.1 : `identifier` = jeton en clair
 * (`storeToken: 'plain'`, le defaut, que `magicLinkOptions` ne change pas) et
 * `value` = `JSON.stringify({email, name})`, `name` absent sur nos demandes.
 */
const revokeEarlierMagicLinks = async (
  email: string,
  token: string | undefined,
  ctx?: MagicLinkRequestContext
) => {
  if (!token || !ctx?.context) return
  await ctx.context.adapter.deleteMany({
    model: 'verification',
    where: [
      {field: 'value', value: JSON.stringify({email})},
      {field: 'identifier', value: token, operator: 'ne'},
    ],
  })
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * La demande d'invitation portee par `metadata.invitation`, si elle est bien
 * formee. Le canal de retour est une fonction : il ne peut venir que du code
 * serveur, jamais d'un corps JSON (route HTTP fermee).
 */
const invitationRequestOf = (
  metadata: Record<string, unknown> | undefined
): InvitationLinkRequest | undefined => {
  const candidate = metadata?.invitation as
    Partial<InvitationLinkRequest> | undefined
  if (
    !candidate ||
    typeof candidate.organizationId !== 'string' ||
    typeof candidate.expiresInDays !== 'number' ||
    typeof candidate.deliver !== 'function'
  ) {
    return undefined
  }
  return candidate as InvitationLinkRequest
}

/** Retire le jeton tout juste cree : aucun lien ne doit subsister. */
const discardToken = async (token: string, ctx?: MagicLinkRequestContext) => {
  await ctx?.context?.adapter.deleteMany({
    model: 'verification',
    where: [{field: 'identifier', value: token}],
  })
}

/**
 * Prolonge la ligne `verification` du jeton a la duree de l'invitation
 * (ADR 071) : le plugin l'a creee a sa duree globale, celle du lien demande.
 */
const extendToken = async (
  token: string,
  expiresInDays: number,
  ctx?: MagicLinkRequestContext
) => {
  await ctx?.context?.adapter.update({
    model: 'verification',
    where: [{field: 'identifier', value: token}],
    update: {expiresAt: new Date(Date.now() + expiresInDays * DAY_MS)},
  })
}

/**
 * Branche « invitation » (s42a, ADR 071) : l'association vient de la demande,
 * jamais de l'hote ; aucun quota de la demande anonyme ; meme controle
 * d'ouverture de session que la connexion ; liens precedents revoques, jeton
 * prolonge, lien rebase sur l'association puis rendu a l'appelant. **Rien
 * n'est envoye** : l'envoi, la trace et le report appartiennent au service
 * d'invitation. Lecture de l'association par son identifiant, chargee a
 * l'appel (aucune arete statique, et aucune session requise hors requete).
 */
const issueInvitation = async (
  {email, url, token}: SendMagicLinkData,
  invitation: InvitationLinkRequest,
  ctx?: MagicLinkRequestContext
) => {
  if (!token) return
  const {getOrganizationByIdDao} =
    await import('@/db/repositories/organization-repository')
  const organization = await getOrganizationByIdDao(invitation.organizationId)
  const origin = associationOriginOf(organization?.domain)
  const user = organization && origin ? await getUserByEmailDao(email) : null
  if (
    !organization ||
    !origin ||
    !user ||
    !canOpenSessionOn(user, organization)
  ) {
    logger.warn('[INVITATION-LINK] Compte hors de l’association : aucun lien')
    await discardToken(token, ctx)
    return
  }

  await revokeEarlierMagicLinks(email, token, ctx)
  await extendToken(token, invitation.expiresInDays, ctx)
  invitation.deliver({url: rebaseMagicLinkUrl(url, origin), token})
}

/**
 * Envoi du lien de connexion (s03). Chaque demande est d'abord comptee pour
 * l'association du domaine appele, adresse connue ou non (3 par adresse et par
 * jour par defaut, reglage du bureau) : au-dela, rien ne part et le lien
 * precedent reste valable. Aucune IP n'est lue. Adresse inconnue, ou compte
 * sans appartenance a l'association du domaine (s03c) : **rien** — ni email
 * ni compte (`disableSignUp`). Membre de l'association, ou SuperAdmin (s46b,
 * `canOpenSessionOn`, ADR 034) : les liens
 * precedents sont revoques, puis l'email de l'association part par le service
 * d'email (plus de notification : un lien secret n'a rien a faire dans la
 * liste des notifications), avec un lien rebase sur l'origine de
 * l'association, lue en base (ADR 022). Dans tous les cas, l'ecran reste le meme (ecran
 * B). Ni l'URL ni le jeton ne sont journalises. Un echec du transport remonte
 * a Better Auth. L'email parle la locale de la page de demande, que l'action
 * transmet par `metadata.locale` : verifiee contre le routage, francais sinon
 * (ADR 008). Une demande portant `metadata.invitation` (s42a, ADR 071) prend
 * la branche de l'invitation, qui n'envoie rien.
 */
export async function sendMagicLink(
  {email, url, token, metadata}: SendMagicLinkData,
  ctx?: MagicLinkRequestContext
) {
  const invitation = invitationRequestOf(metadata)
  if (invitation) {
    await issueInvitation({email, url, token}, invitation, ctx)
    return
  }

  const services = await loadServices()
  const host = requestHostOf(requestHeadersOf(ctx))

  const organization = await organizationOfRequest(host)
  const origin = associationOriginOf(organization?.domain)
  if (!organization || !origin) {
    logger.warn(
      '[MAGIC-LINK] Aucune association sur le domaine appele : lien non envoye'
    )
    return
  }

  const {allowed} = await services.consumeMagicLinkRequestQuotaService({
    organizationId: organization.id,
    email,
  })
  if (!allowed) {
    logger.warn(
      '[MAGIC-LINK] Seuil de demandes du jour atteint : lien non envoye'
    )
    return
  }

  const user = await getUserByEmailDao(email)
  if (!user || !canOpenSessionOn(user, organization)) return

  const association = await emailAssociationOf(organization, origin, services)
  await revokeEarlierMagicLinks(email, token, ctx)
  await services.sendMagicLinkEmailService({
    organizationId: organization.id,
    email,
    url: rebaseMagicLinkUrl(url, origin),
    association,
    locale: resolveSupportedLocale(metadata?.locale),
  })
}

/** Options du plugin `magicLink` de Better Auth : configurer, pas reecrire. */
export const magicLinkOptions = {
  expiresIn: MAGIC_LINK_EXPIRES_IN_SECONDS,
  disableSignUp: true,
  rateLimit: {...MAGIC_LINK_VERIFY_RATE_LIMIT},
  sendMagicLink,
}

/**
 * Routes HTTP de Better Auth fermees (`disabledPaths`). La demande de lien ne
 * passe que par `requestMagicLinkAction` : en direct, elle contournerait le
 * plancher de duree et la limitation de debit, et laisserait deviner si un
 * compte existe. `disabledPaths` n'agit que sur le routeur HTTP :
 * `auth.api.signInMagicLink`, appele par l'action, et `/magic-link/verify`,
 * ouvert par le lien de l'email, restent en service.
 */
export const MAGIC_LINK_DISABLED_HTTP_PATHS: readonly string[] = [
  '/sign-in/magic-link',
]
