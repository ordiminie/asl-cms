import {z} from 'zod'

import {ChangeMemberRoleInput} from '../types/domain/member-role-types'

/**
 * Validation du changement de role (s14). `role` reste une chaine bornee :
 * une valeur hors `member | board | owner` est refusee par la regle
 * (`invalid_role`, critere 6), avec un message a l'ecran.
 */
export const changeMemberRoleServiceSchema = z.object({
  organizationId: z.string().uuid(),
  memberProfileId: z.string().uuid(),
  role: z.string().max(32),
}) satisfies z.Schema<ChangeMemberRoleInput>

/** Arguments de `pnpm ops:transfer-presidency <domaine> <adresse>` (D8). */
export const transferPresidencyByOperatorServiceSchema = z.object({
  domain: z.string().trim().toLowerCase().min(1),
  email: z.string().trim().toLowerCase().email(),
})
