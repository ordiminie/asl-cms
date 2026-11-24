import 'server-only'

import {
  markFirstSignInTxnDao,
  markInvitedTxnDao,
} from '@/db/repositories/member-invitation-state-repository'
import {
  getLinkedAccountsDao,
  getMemberProfileByIdDao,
} from '@/db/repositories/member-profile-repository'
import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {withTenant} from '@/db/tenant-scope'
import {associationOriginOf} from '@/lib/better-auth/association-origin'
import {issueInvitationLink} from '@/lib/better-auth/invitation-link'
import type {EmailAssociation} from '@/lib/emails/association-header'
import {pngLogoUrlOf} from '@/lib/emails/logo-url'
import {PRODUCT_LOCALE} from '@/lib/helper/locale-helper'
import {logger} from '@/lib/logger'

import {getAssociationSettingsService} from './association-settings-service'
import {sendInvitationEmailService} from './email-service'
import {NotFoundError} from './errors/not-found-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {
  accountOfEmail,
  readProfileEmails,
  requireMemberProfileManager,
} from './member-profile-support'
import {
  getAccentHue,
  getInvitationLinkDays,
  getInvitationText,
} from './types/domain/association-settings-types'
import type {
  InviteMemberProfileInput,
  MemberInvitationResult,
} from './types/domain/member-profile-types'
import {memberProfileServiceSchema} from './validation/member-profile-validation'

/**
 * Invitation d'un membre et traces de connexion (s42a, ADR 071). Une
 * invitation part a **chaque** adresse active de la fiche, chacune avec son
 * propre lien, ne du seul generateur du lien de connexion. Ni lien ni jeton
 * dans un journal : l'intercepteur de la facade n'en logge ni les arguments ni
 * le resultat.
 */

const PROFILE_NOT_FOUND = 'Fiche introuvable'
const ASSOCIATION_NOT_FOUND = 'Association introuvable'

/** Une adresse active de la fiche et le compte qui la porte. */
type InvitationTarget = {
  email: string
  account: {userId: string; email: string} | undefined
}

/** Les adresses actives de la fiche, dans son ordre, avec leur compte. */
const readInvitationTargets = async (
  memberProfileId: string,
  now: Date
): Promise<InvitationTarget[]> => {
  const profile = await getMemberProfileByIdDao(memberProfileId)
  if (!profile) throw new NotFoundError(PROFILE_NOT_FOUND)
  const emails = (await readProfileEmails(profile.id, now)).filter(
    (email) => email.status === 'active'
  )
  const accounts = await getLinkedAccountsDao(profile.id)
  return emails.map((email) => ({
    email: email.email,
    account: accountOfEmail(accounts, email.email),
  }))
}

/** L'association, sa presentation dans l'email et ses reglages d'invitation. */
const readInvitationContext = async (organizationId: string) => {
  const [organization, settings] = await Promise.all([
    getOrganizationByIdDao(organizationId),
    getAssociationSettingsService(organizationId),
  ])
  const origin = associationOriginOf(organization?.domain)
  if (!organization || !origin) throw new NotFoundError(ASSOCIATION_NOT_FOUND)
  const logoUrl = pngLogoUrlOf(organization.identityLogoKey, origin)
  const association: EmailAssociation = {
    name: organization.name,
    hue: getAccentHue(settings),
    ...(logoUrl ? {logoUrl} : {}),
  }
  return {
    organization,
    association,
    days: getInvitationLinkDays(settings),
    text: getInvitationText(settings),
  }
}

type InvitationContext = Awaited<ReturnType<typeof readInvitationContext>>

/** Emet le lien d'une adresse et envoie son email ; trace « invitee le ». */
const inviteTarget = async (
  organizationId: string,
  target: InvitationTarget,
  context: InvitationContext,
  now: Date
): Promise<'sent' | 'deferred'> => {
  const {account} = target
  if (!account) throw new Error('Adresse active sans compte : lien non emis')
  const link = await issueInvitationLink({
    organization: context.organization,
    email: account.email,
    expiresInDays: context.days,
  })
  if (!link) throw new Error("Compte hors de l'association : lien non emis")

  const result = await sendInvitationEmailService({
    organizationId,
    email: target.email,
    url: link.url,
    token: link.token,
    association: context.association,
    text: context.text,
    expiresAt: new Date(now.getTime() + context.days * 24 * 60 * 60 * 1000),
    locale: PRODUCT_LOCALE,
  })
  if (result.status !== 'sent') return 'deferred'
  await withTenant(organizationId, () =>
    markInvitedTxnDao({organizationId, userId: account.userId, at: now})
  )
  return 'sent'
}

/**
 * Invite chaque adresse active d'une fiche (s42a, criteres 1, 6, 7, 8, 9).
 * `member.profile.manage` ; fiche lue sous le tenant (introuvable :
 * `NotFoundError`) ; aucune adresse active : refus « courrier uniquement ».
 * Chaque adresse, dans l'ordre de la fiche, recoit un lien neuf — les
 * precedents de l'adresse sont revoques par le generateur — puis son email ;
 * « invitee le » s'ecrit au depart reel. Une erreur apres un premier email
 * rend `partial` ; au premier, elle remonte.
 */
export const inviteMemberProfileService = async (
  input: InviteMemberProfileInput
): Promise<MemberInvitationResult> => {
  const parsed = memberProfileServiceSchema.safeParse(input)
  if (!parsed.success) throw new ValidationParsedZodError(parsed.error)
  const {organizationId, memberProfileId} = parsed.data
  await requireMemberProfileManager(organizationId)
  const now = new Date()

  const targets = await withTenant(organizationId, () =>
    readInvitationTargets(memberProfileId, now)
  )
  if (targets.length === 0) return {status: 'mail_only'}
  const context = await readInvitationContext(organizationId)

  const sent: string[] = []
  const deferred: string[] = []
  for (const target of targets) {
    try {
      const outcome = await inviteTarget(organizationId, target, context, now)
      if (outcome === 'sent') sent.push(target.email)
      else deferred.push(target.email)
    } catch (error) {
      if (sent.length === 0 && deferred.length === 0) throw error
      logger.error('[MEMBER-INVITATION] Invitation interrompue', {
        error: error instanceof Error ? error.name : 'unknown',
      })
      return {status: 'partial', sent, deferred}
    }
  }
  return {status: deferred.length > 0 ? 'deferred' : 'sent', sent, deferred}
}

/**
 * Premiere connexion reussie d'un compte sur une association (s42a). Appelee
 * par le hook de creation de session, **sans facade** : aucune session n'est
 * encore lisible, et le hook a deja verifie que le compte est membre de
 * l'association du domaine et que la session n'est pas une imitation. N'ecrit
 * que si la trace est encore nulle.
 */
export const recordFirstSignIn = async (input: {
  organizationId: string
  userId: string
  at: Date
}): Promise<void> => {
  await withTenant(input.organizationId, () => markFirstSignInTxnDao(input))
}
