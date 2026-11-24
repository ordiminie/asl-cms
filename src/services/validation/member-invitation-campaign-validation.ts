import {z} from 'zod'

import type {
  LaunchMemberInvitationsInput,
  MemberInvitationsPageInput,
  RemindNeverSignedInInput,
} from '../types/domain/member-invitation-campaign-types'

/**
 * Validation du lancement des invitations et de sa relance (s42b, ADR 072).
 * Aucun contenu n'est recu : il est lu dans les reglages et fige a la
 * creation.
 */

const uuid = z.string().uuid()

export const launchMemberInvitationsServiceSchema = z.object({
  organizationId: uuid,
}) satisfies z.ZodType<LaunchMemberInvitationsInput>

export const remindNeverSignedInServiceSchema = z.object({
  organizationId: uuid,
  submissionId: uuid,
}) satisfies z.ZodType<RemindNeverSignedInInput>

export const memberInvitationsPageServiceSchema = z.object({
  organizationId: uuid,
  page: z.number().int().min(1),
}) satisfies z.ZodType<MemberInvitationsPageInput>
