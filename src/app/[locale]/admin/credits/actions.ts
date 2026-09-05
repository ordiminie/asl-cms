'use server'

import {revalidatePath} from 'next/cache'
import {z} from 'zod'

import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {ValidationError} from '@/services/errors/validation-error'
import {grantCreditsService} from '@/services/facades/credit-service-facade'
import {searchOrganizationsForAdminService} from '@/services/facades/organization-service-facade'
import {ActionResponse} from '@/services/types/common-type'
import {RoleConst} from '@/services/types/domain/auth-types'
import {CreditEntry} from '@/services/types/domain/credit-types'
import {OrganizationSearchResult} from '@/services/types/domain/organization-types'

// Schema de validation pour l'octroi de crédits
const grantCreditsSchema = z.object({
  organizationId: z
    .string()
    .uuid({message: "L'ID de l'organisation est invalide"}),
  amount: z
    .number()
    .positive({message: 'Le montant doit être positif'})
    .max(10000, {message: 'Le montant maximum est 10000 crédits'}),
  reason: z.string().max(500).optional(),
  expiresAt: z.date().nullable().optional(),
})

export type GrantCreditsInput = z.infer<typeof grantCreditsSchema>

/**
 * Action admin pour accorder des crédits à une organisation
 */
export async function grantCreditsAction(
  input: GrantCreditsInput
): Promise<ActionResponse<CreditEntry>> {
  try {
    await requireActionAuth({
      roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
    })

    // Validation
    const validationResult = grantCreditsSchema.safeParse(input)
    if (!validationResult.success) {
      throw new ValidationError(
        validationResult.error.issues[0]?.message || 'Données invalides'
      )
    }

    const {organizationId, amount, reason, expiresAt} = validationResult.data

    // Appeler le service
    const creditEntry = await grantCreditsService(organizationId, amount, {
      reason,
      expiresAt,
    })

    revalidatePath('/admin/credits')
    revalidatePath(`/credits`) // Revalider aussi la page user

    return {
      success: true,
      message: `${amount} crédits accordés avec succès`,
      data: creditEntry,
    }
  } catch (error) {
    console.error('Error granting credits:', error)

    if (error instanceof AuthorizationError) {
      return {
        success: false,
        message: 'Seul un administrateur peut accorder des crédits',
      }
    }

    if (error instanceof ValidationError) {
      return {
        success: false,
        message: error.message,
      }
    }

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Erreur lors de l'octroi des crédits",
    }
  }
}

/**
 * Action admin pour rechercher des organisations par nom ou email membre
 */
export async function searchOrganizationsAction(
  searchTerm: string
): Promise<OrganizationSearchResult[]> {
  try {
    await requireActionAuth({
      roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
    })

    return await searchOrganizationsForAdminService(searchTerm)
  } catch {
    return []
  }
}
