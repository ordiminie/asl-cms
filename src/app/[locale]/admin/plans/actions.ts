'use server'

import {revalidatePath, revalidateTag} from 'next/cache'

import {requireActionAuth} from '@/app/dal/user-dal'
import {
  createPlanSchema,
  editPlanSchema,
} from '@/components/features/admin/plans/plan-form-validation'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {ValidationError} from '@/services/errors/validation-error'
import {
  createPlanService,
  deletePlanService,
  softDeletePlanService,
  updatePlanService,
} from '@/services/facades/subscription-service-facade'
import {ActionResponse} from '@/services/types/common-type'
import {RoleConst} from '@/services/types/domain/auth-types'
import {
  CreatePlan,
  UpdatePlan,
} from '@/services/types/domain/subscription-types'

export async function createPlanAction(
  planData: CreatePlan
): Promise<ActionResponse> {
  try {
    await requireActionAuth({
      roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
    })

    const validationResult = createPlanSchema.safeParse(planData)
    if (!validationResult.success) {
      throw new ValidationError('Données invalides')
    }

    const newPlan = await createPlanService(validationResult.data)
    revalidatePath('/admin/plans')
    revalidateTag('plans', 'max')
    return {
      success: true,
      message: 'Plan créé avec succès',
      data: newPlan,
    }
  } catch (error) {
    console.error('Error creating plan:', error)

    // Gestion des erreurs d'autorisation et validation
    if (error instanceof AuthorizationError) {
      return {
        success: false,
        message: "Vous n'êtes pas autorisé à créer des plans",
      }
    }

    if (error instanceof ValidationError) {
      return {
        success: false,
        message: 'Les données fournies sont invalides',
      }
    }

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Erreur lors de la création du plan',
    }
  }
}

export async function updatePlanAction(
  planData: UpdatePlan
): Promise<ActionResponse> {
  try {
    // ✅ SÉCURITÉ OBLIGATOIRE - Vérification auth et rôles admin
    await requireActionAuth({
      roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
    })

    // ✅ VALIDATION ZOD côté serveur (sans l'ID)
    const {id, ...dataToValidate} = planData
    const validationResult = editPlanSchema.safeParse(dataToValidate)
    if (!validationResult.success) {
      throw new ValidationError('Données invalides')
    }

    const updatedPlan = await updatePlanService({
      id,
      ...validationResult.data,
    })
    revalidatePath('/admin/plans')
    revalidateTag('plans', 'max')
    return {
      success: true,
      message: 'Plan mis à jour avec succès',
      data: updatedPlan,
    }
  } catch (error) {
    console.error('Error updating plan:', error)

    // Gestion des erreurs d'autorisation et validation
    if (error instanceof AuthorizationError) {
      return {
        success: false,
        message: "Vous n'êtes pas autorisé à modifier des plans",
      }
    }

    if (error instanceof ValidationError) {
      return {
        success: false,
        message: 'Les données fournies sont invalides',
      }
    }

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Erreur lors de la mise à jour du plan',
    }
  }
}

export async function softDeletePlanAction(
  planId: string
): Promise<ActionResponse> {
  try {
    // ✅ SÉCURITÉ OBLIGATOIRE - Vérification auth et rôles admin
    await requireActionAuth({
      roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
    })

    await softDeletePlanService(planId)
    revalidatePath('/admin/plans')
    revalidateTag('plans', 'max')
    return {
      success: true,
      message: 'Plan archivé avec succès',
    }
  } catch (error) {
    console.error('Error archiving plan:', error)

    // Gestion des erreurs d'autorisation
    if (error instanceof AuthorizationError) {
      return {
        success: false,
        message: "Vous n'êtes pas autorisé à archiver des plans",
      }
    }

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Erreur lors de l'archivage du plan",
    }
  }
}

export async function deletePlanAction(
  planId: string
): Promise<ActionResponse> {
  try {
    // ✅ SÉCURITÉ OBLIGATOIRE - Vérification auth et rôles admin
    await requireActionAuth({
      roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
    })

    await deletePlanService(planId)
    revalidatePath('/admin/plans')
    revalidateTag('plans', 'max')
    return {
      success: true,
      message: 'Plan supprimé définitivement',
    }
  } catch (error) {
    console.error('Error deleting plan:', error)

    // Gestion des erreurs d'autorisation
    if (error instanceof AuthorizationError) {
      return {
        success: false,
        message: "Vous n'êtes pas autorisé à supprimer des plans",
      }
    }

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Erreur lors de la suppression du plan',
    }
  }
}
