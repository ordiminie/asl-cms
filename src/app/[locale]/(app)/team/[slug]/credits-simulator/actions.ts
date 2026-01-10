'use server'

import {requireActionAuth} from '@/app/dal/user-dal'
import {canConsumeCredits} from '@/services/authorization/credit-authorization'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  consumeService,
  getBalanceService,
  refundCreditsService,
} from '@/services/facades/credit-service-facade'
import {ActionResponse} from '@/services/types/common-type'
import {RoleConst} from '@/services/types/domain/auth-types'

const AI_GENERATION_COST = 5

export interface SimulatorResult {
  success: boolean
  output?: string
  creditsUsed: number
  newBalance: number
  refunded?: boolean
  error?: string
}

/**
 * Simule une génération IA qui consomme des crédits
 * ~20% de chance d'erreur avec refund
 */
export async function simulateAiGenerationAction(
  organizationId: string,
  prompt: string
): Promise<ActionResponse<SimulatorResult>> {
  try {
    await requireActionAuth({
      roles: [RoleConst.USER, RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
    })

    const canConsume = await canConsumeCredits(organizationId)
    if (!canConsume) {
      throw new AuthorizationError('Non autorisé à consommer des crédits')
    }

    // Vérifier le solde avant
    const balanceBefore = await getBalanceService(organizationId)
    if (balanceBefore < AI_GENERATION_COST) {
      return {
        success: false,
        message: 'Solde insuffisant',
        data: {
          success: false,
          creditsUsed: 0,
          newBalance: balanceBefore,
          error: `Solde insuffisant. Vous avez ${balanceBefore} crédits, il en faut ${AI_GENERATION_COST}.`,
        },
      }
    }

    // Consommer les crédits AVANT la génération
    await consumeService(
      organizationId,
      AI_GENERATION_COST,
      `AI Generation: ${prompt.slice(0, 50)}...`
    )

    // Simuler un délai de traitement (1-3 secondes)
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 + Math.random() * 2000)
    )

    // ~20% de chance d'erreur
    const shouldFail = Math.random() < 0.2

    if (shouldFail) {
      // Simuler une erreur API - REFUND les crédits
      await refundCreditsService(
        organizationId,
        AI_GENERATION_COST,
        `AI Generation failed - ${prompt.slice(0, 30)}...`
      )

      const newBalance = await getBalanceService(organizationId)

      return {
        success: true,
        message: 'Erreur API - crédits remboursés',
        data: {
          success: false,
          creditsUsed: 0,
          newBalance,
          refunded: true,
          error:
            'Erreur du service IA externe. Vos crédits ont été remboursés.',
        },
      }
    }

    // Succès - générer une fausse réponse
    const fakeResponses = [
      `Voici une analyse approfondie de votre demande concernant "${prompt.slice(0, 30)}...":\n\nL'intelligence artificielle a traité votre requête avec succès. Les résultats indiquent une forte corrélation avec les patterns existants dans votre dataset.`,
      `Génération complète pour: "${prompt.slice(0, 30)}..."\n\nLe modèle a identifié plusieurs insights clés qui pourraient améliorer votre workflow de 23%.`,
      `Analyse terminée!\n\nBasé sur votre prompt "${prompt.slice(0, 30)}...", voici mes recommandations:\n1. Optimiser les processus existants\n2. Implémenter une stratégie data-driven\n3. Automatiser les tâches répétitives`,
      `Traitement réussi de "${prompt.slice(0, 30)}...".\n\nLe système a généré des insights personnalisés basés sur les meilleures pratiques du domaine. Confidence score: 94.2%`,
    ]

    const randomResponse =
      fakeResponses[Math.floor(Math.random() * fakeResponses.length)]
    const newBalance = await getBalanceService(organizationId)

    return {
      success: true,
      message: 'Génération réussie',
      data: {
        success: true,
        output: randomResponse,
        creditsUsed: AI_GENERATION_COST,
        newBalance,
      },
    }
  } catch (error) {
    console.error('Error in AI generation simulation:', error)

    if (error instanceof AuthorizationError) {
      return {
        success: false,
        message: "Vous n'êtes pas autorisé à utiliser cette fonctionnalité",
      }
    }

    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Erreur lors de la génération',
    }
  }
}

/**
 * Récupère le solde actuel
 */
export async function getCreditsBalanceAction(
  organizationId: string
): Promise<ActionResponse<number>> {
  try {
    await requireActionAuth({
      roles: [RoleConst.USER, RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
    })

    const balance = await getBalanceService(organizationId)

    return {
      success: true,
      message: 'Solde récupéré',
      data: balance,
    }
  } catch (error) {
    console.error('Error getting balance:', error)

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Erreur lors de la récupération du solde',
    }
  }
}
