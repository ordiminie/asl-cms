import type {Organization} from '@/services/types/domain/organization-types'

/**
 * Lien d'invitation d'un membre (s42a, ADR 071). Il nait du **seul**
 * generateur du lien de connexion, `auth.api.signInMagicLink`, appele sans
 * `Request` et avec des en-tetes construits sur le domaine de l'association :
 * utilisable hors de toute requete (rejeu d'une invitation reportee). La
 * branche « invitation » de `sendMagicLink` le prolonge, revoque les liens
 * precedents de l'adresse, le rebase sur l'association, puis le rend ici par
 * le canal `metadata.invitation` ; elle n'envoie rien. Ni l'URL ni le jeton ne
 * sont journalises.
 */

/** Destination d'un lien d'invitation ouvert : la meme que le lien demande. */
export const INVITATION_CALLBACK_URL = '/login/destination'
/** Motif porte par le lien d'erreur d'une invitation (page du lien invalide). */
export const INVITATION_ERROR_REASON = 'invitation'
export const INVITATION_ERROR_CALLBACK_URL = `/login/lien-invalide?motif=${INVITATION_ERROR_REASON}`

/** Un lien d'invitation emis : l'URL sur l'association et son jeton. */
export type InvitationLink = {url: string; token: string}

/**
 * Ce que l'appelant passe a `sendMagicLink` par `metadata.invitation` : jamais
 * serialise (la route HTTP est fermee), seul le code serveur peut le fournir.
 */
export type InvitationLinkRequest = {
  organizationId: string
  expiresInDays: number
  deliver: (link: InvitationLink) => void
}

/**
 * Emet le lien d'invitation d'un compte sur une association. `email` est
 * l'adresse **du compte** : la revocation des liens precedents compare la
 * valeur exacte. Rend `null` quand aucun lien n'est emis (association sans
 * domaine, compte qui n'en est pas membre).
 */
export const issueInvitationLink = async ({
  organization,
  email,
  expiresInDays,
}: {
  organization: Pick<Organization, 'id' | 'domain'>
  email: string
  expiresInDays: number
}): Promise<InvitationLink | null> => {
  if (!organization.domain) return null

  const {auth} = await import('./auth')
  let issued: InvitationLink | null = null
  const invitation: InvitationLinkRequest = {
    organizationId: organization.id,
    expiresInDays,
    deliver: (link) => {
      issued = link
    },
  }
  await auth.api.signInMagicLink({
    headers: new Headers({host: organization.domain}),
    body: {
      email: email.trim().toLowerCase(),
      callbackURL: INVITATION_CALLBACK_URL,
      errorCallbackURL: INVITATION_ERROR_CALLBACK_URL,
      metadata: {invitation},
    },
  })
  return issued
}

/**
 * Revoque un lien d'invitation emis mais jamais parti (invitation reportee,
 * ADR 071 §4) : sa ligne `verification` est retiree par l'adaptateur de
 * Better Auth ; le rejeu en emettra un neuf.
 */
export const revokeInvitationLink = async (token: string): Promise<void> => {
  const {auth} = await import('./auth')
  const context = await auth.$context
  await context.internalAdapter.deleteVerificationByIdentifier(token)
}
