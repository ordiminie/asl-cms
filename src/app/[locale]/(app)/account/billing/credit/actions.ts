'use server'

import {headers} from 'next/headers'

import {requireActionAuth} from '@/app/dal/user-dal'
import {createCreditPackCheckoutSession} from '@/lib/stripe/credit-pack-checkout'
import {getAuthUser} from '@/services/authentication/auth-service'
import {canReadCredits} from '@/services/authorization/credit-authorization'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {ValidationError} from '@/services/errors/validation-error'
import {
  getCreditBalanceService,
  getCreditPacksService,
  getRecentActivityService,
  getUsageGraphDataService,
} from '@/services/facades/credit-service-facade'
import {ActionResponse} from '@/services/types/common-type'
import {RoleConst} from '@/services/types/domain/auth-types'
import {
  CreditActivityItem,
  CreditBalanceDetails,
  CreditPackConfig,
  CreditUsageDay,
} from '@/services/types/domain/credit-types'

/**
 * Action pour récupérer le solde de crédits
 */
export async function getCreditBalanceAction(
  organizationId: string
): Promise<ActionResponse<CreditBalanceDetails>> {
  try {
    const canRead = await canReadCredits(organizationId)
    if (!canRead) {
      throw new AuthorizationError('Non autorisé à lire les crédits')
    }

    const balance = await getCreditBalanceService(organizationId)

    return {
      success: true,
      message: 'Solde récupéré avec succès',
      data: balance,
    }
  } catch (error) {
    console.error('Error getting credit balance:', error)

    if (error instanceof AuthorizationError) {
      return {
        success: false,
        message: "Vous n'êtes pas autorisé à voir les crédits",
      }
    }

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Erreur lors de la récupération du solde',
    }
  }
}

/**
 * Action pour récupérer l'activité récente
 */
export async function getRecentCreditActivityAction(
  organizationId: string,
  limit = 20
): Promise<ActionResponse<CreditActivityItem[]>> {
  try {
    const canRead = await canReadCredits(organizationId)
    if (!canRead) {
      throw new AuthorizationError('Non autorisé à lire les crédits')
    }

    const activities = await getRecentActivityService(organizationId, limit)

    return {
      success: true,
      message: 'Activité récupérée avec succès',
      data: activities,
    }
  } catch (error) {
    console.error('Error getting credit activity:', error)

    if (error instanceof AuthorizationError) {
      return {
        success: false,
        message: "Vous n'êtes pas autorisé à voir l'activité",
      }
    }

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Erreur lors de la récupération de l'activité",
    }
  }
}

/**
 * Action pour récupérer les données du graphique d'utilisation
 */
export async function getCreditUsageGraphAction(
  organizationId: string,
  periodStart: Date | string,
  periodEnd: Date | string
): Promise<ActionResponse<CreditUsageDay[]>> {
  try {
    const canRead = await canReadCredits(organizationId)
    if (!canRead) {
      throw new AuthorizationError('Non autorisé à lire les crédits')
    }

    // Convertir les strings en Date si nécessaire (sérialisation Server Actions)
    const startDate =
      typeof periodStart === 'string' ? new Date(periodStart) : periodStart
    const endDate =
      typeof periodEnd === 'string' ? new Date(periodEnd) : periodEnd

    const usageData = await getUsageGraphDataService(
      organizationId,
      startDate,
      endDate
    )

    return {
      success: true,
      message: 'Données récupérées avec succès',
      data: usageData,
    }
  } catch (error) {
    console.error('Error getting credit usage graph:', error)

    if (error instanceof AuthorizationError) {
      return {
        success: false,
        message: "Vous n'êtes pas autorisé à voir les statistiques",
      }
    }

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Erreur lors de la récupération des statistiques',
    }
  }
}

/**
 * Action pour acheter un pack de crédits
 */
export async function purchaseCreditPackAction(
  organizationId: string,
  packId: string
): Promise<ActionResponse<{checkoutUrl: string}>> {
  try {
    await requireActionAuth({
      roles: [RoleConst.USER, RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
    })

    const user = await getAuthUser()
    if (!user) {
      throw new AuthorizationError('Utilisateur non connecté')
    }

    // Récupérer les packs depuis la DB
    const packs = await getCreditPacksService()
    const pack = packs.find((p) => p.id === packId)
    if (!pack) {
      throw new ValidationError('Pack non trouvé')
    }

    if (!pack.stripePriceId) {
      throw new ValidationError("Ce pack n'est pas encore configuré")
    }

    const headersList = await headers()
    const host = headersList.get('host') || 'localhost:3000'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const baseUrl = `${protocol}://${host}`

    const successUrl = `${baseUrl}/account/billing/credit?success=true`
    const cancelUrl = `${baseUrl}/account/billing/credit?canceled=true`

    const result = await createCreditPackCheckoutSession(
      organizationId,
      packId,
      successUrl,
      cancelUrl,
      user.email,
      user.stripeCustomerId || undefined
    )

    if (!result.success || !result.url) {
      throw new Error(result.error || 'Erreur lors de la création du checkout')
    }

    return {
      success: true,
      message: 'Redirection vers le paiement...',
      data: {checkoutUrl: result.url},
    }
  } catch (error) {
    console.error('Error purchasing credit pack:', error)

    if (error instanceof AuthorizationError) {
      return {
        success: false,
        message: "Vous n'êtes pas autorisé à acheter des crédits",
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
          : "Erreur lors de l'achat du pack de crédits",
    }
  }
}

/**
 * Action pour récupérer les packs de crédits disponibles
 */
export async function getCreditPacksAction(): Promise<
  ActionResponse<CreditPackConfig[]>
> {
  try {
    const packs = await getCreditPacksService()

    return {
      success: true,
      message: 'Packs récupérés avec succès',
      data: packs,
    }
  } catch (error) {
    console.error('Error getting credit packs:', error)

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Erreur lors de la récupération des packs',
    }
  }
}
