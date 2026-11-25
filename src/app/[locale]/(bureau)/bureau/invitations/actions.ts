'use server'

import {revalidatePath} from 'next/cache'
import {after} from 'next/server'
import {getTranslations} from 'next-intl/server'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {MEMBER_INVITATIONS_PATH} from '@/components/features/member-invitation-campaign/member-invitation-paths'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  launchMemberInvitationsService,
  remindNeverSignedInService,
} from '@/services/facades/member-invitation-campaign-service-facade'
import type {
  LaunchMemberInvitationsActionResult,
  RemindNeverSignedInActionResult,
} from '@/services/types/domain/member-invitation-campaign-types'

/**
 * Server Actions du lancement des invitations et de sa relance (s42b, ADR
 * 072). Tenant du domaine, traductions, controle de session, facade — le
 * service reverifie `campaign.manage`. La livraison immediate part par
 * `after()`, posee ici apres une creation ; aucun lien ni adresse n'est rendu
 * ni journalise.
 */

type Translator = Awaited<ReturnType<typeof getTranslations>>

const failureOf = (error: unknown, t: Translator) => ({
  status: 'error' as const,
  message: t(
    error instanceof AuthorizationError ? 'errors.forbidden' : 'errors.failed'
  ),
})

/** « Lancer les invitations » : un lancement par association (Q7). */
export async function launchMemberInvitationsAction(): Promise<LaunchMemberInvitationsActionResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('MemberInvitationsBureau')

  try {
    await requireActionAuth()

    const result = await launchMemberInvitationsService({
      organizationId: tenant.id,
    })
    if (result.status !== 'created') return result

    if (result.deliver) after(result.deliver)
    revalidatePath(MEMBER_INVITATIONS_PATH)
    return {status: 'created', campaignId: result.campaignId}
  } catch (error) {
    return failureOf(error, t)
  }
}

/**
 * « Relancer les jamais connectes », avec la soumission tiree a l'ouverture
 * de la page : un double envoi retrouve la relance existante.
 */
export async function remindNeverSignedInAction(
  submissionId: string
): Promise<RemindNeverSignedInActionResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('MemberInvitationsBureau')

  try {
    await requireActionAuth()

    const result = await remindNeverSignedInService({
      organizationId: tenant.id,
      submissionId,
    })
    if (result.status !== 'created') return result

    if (result.deliver) after(result.deliver)
    revalidatePath(MEMBER_INVITATIONS_PATH)
    return {status: 'created', campaignId: result.campaignId}
  } catch (error) {
    return failureOf(error, t)
  }
}
