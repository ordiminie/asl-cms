import {z} from 'zod'

import {
  IMPERSONATION_REASON_MAX_LENGTH,
  OpenImpersonationInput,
} from '../types/domain/impersonation-types'

/** Validation de l'ouverture d'une session a la place d'un compte (s48). */
export const openImpersonationServiceSchema = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  reason: z.string().trim().max(IMPERSONATION_REASON_MAX_LENGTH).optional(),
}) satisfies z.Schema<OpenImpersonationInput>
