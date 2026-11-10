import 'server-only'

import {z} from 'zod'

import {
  createUnsubscribeIfAbsentTxnDao,
  getRecipientByTokenDao,
  getUnsubscribeByMemberDao,
  type RecipientByTokenRowModel,
} from '@/db/repositories/member-unsubscribe-repository'
import {withTenant} from '@/db/tenant-scope'

import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  ConfirmUnsubscribeResult,
  MemberUnsubscribeDTO,
  UnsubscribePageState,
  UnsubscribeRequestInput,
} from './types/domain/campaign-types'
import {
  unsubscribeRequestServiceSchema,
  unsubscribeTokenSchema,
} from './validation/campaign-validation'

/**
 * Desinscription des campagnes (s25, ADR 051).
 *
 * **Sans controle d'autorisation, et c'est delibere** : le jeton aleatoire
 * de 256 bits est le seul titre, comme le visiteur anonyme de
 * `createContactMessageService`. L'association vient du **domaine appele**,
 * passee par l'appelant : un jeton d'une autre association ne se resout pas
 * sous la RLS. La lecture (page `GET`) n'ecrit jamais ; seule la confirmation
 * (`POST`) ecrit, et une seule fois.
 */

type ResolvedRecipient = RecipientByTokenRowModel & {memberProfileId: string}

const parseRequest = (input: UnsubscribeRequestInput) => {
  const parsed = unsubscribeRequestServiceSchema.safeParse(input)
  if (!parsed.success) throw new ValidationParsedZodError(parsed.error)
  return parsed.data
}

/** La ligne du jeton dans cette association, ou rien. */
const resolveRecipient = async (
  organizationId: string,
  token: string
): Promise<ResolvedRecipient | undefined> => {
  if (!unsubscribeTokenSchema.safeParse(token).success) return undefined
  const row = await getRecipientByTokenDao(token)
  if (!row || row.organizationId !== organizationId || !row.memberProfileId) {
    return undefined
  }
  return {...row, memberProfileId: row.memberProfileId}
}

/** L'etat de la page publique ; **lecture seule**. */
export const getUnsubscribePageStateService = async (
  input: UnsubscribeRequestInput
): Promise<UnsubscribePageState> => {
  const {organizationId, token} = parseRequest(input)
  return withTenant(organizationId, async () => {
    const recipient = await resolveRecipient(organizationId, token)
    if (!recipient) return {status: 'invalid'}
    return recipient.unsubscribedAt ? {status: 'already'} : {status: 'confirm'}
  })
}

/** Enregistre le refus de la fiche du jeton ; idempotent. */
export const confirmUnsubscribeService = async (
  input: UnsubscribeRequestInput
): Promise<ConfirmUnsubscribeResult> => {
  const {organizationId, token} = parseRequest(input)
  return withTenant(organizationId, async () => {
    const recipient = await resolveRecipient(organizationId, token)
    if (!recipient) return {status: 'invalid'}
    if (recipient.unsubscribedAt) return {status: 'already'}

    const created = await createUnsubscribeIfAbsentTxnDao({
      organizationId,
      memberProfileId: recipient.memberProfileId,
      campaignId: recipient.campaignId,
    })
    return created ? {status: 'unsubscribed'} : {status: 'already'}
  })
}

const memberUnsubscribeServiceSchema = z.object({
  organizationId: z.string().uuid(),
  memberProfileId: z.string().uuid(),
})

/**
 * Le refus d'une fiche, pour la mention de la fiche du bureau (ecran 5).
 * **Avec** autorisation, celle-ci : `member.profile.manage` sur
 * l'association. Lu a part de la fiche : la desinscription n'entre jamais
 * dans `toMemberProfileDto`.
 */
export const getMemberUnsubscribeService = async (input: {
  organizationId: string
  memberProfileId: string
}): Promise<MemberUnsubscribeDTO | null> => {
  const parsed = memberUnsubscribeServiceSchema.safeParse(input)
  if (!parsed.success) throw new ValidationParsedZodError(parsed.error)
  const {organizationId, memberProfileId} = parsed.data

  const authUser = await getAuthUser()
  if (
    !canPerformAction(
      authUser,
      organizationId,
      ActionIdConst.MEMBER_PROFILE_MANAGE
    )
  ) {
    throw new AuthorizationError(
      "Seul le bureau de l'association peut consulter cette fiche"
    )
  }

  const row = await withTenant(organizationId, () =>
    getUnsubscribeByMemberDao(memberProfileId)
  )
  return row ? {createdAt: row.createdAt.toISOString()} : null
}
