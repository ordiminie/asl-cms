'use server'

import {getAuthUser} from '@/services/authentication/auth-service'
import {createUserSubmissionService} from '@/services/facades/user-submission-service-facade'

export async function createQuickFeedbackAction(message: string) {
  try {
    const user = await getAuthUser()

    if (!user) {
      return {
        success: false,
        message: 'Vous devez être connecté pour envoyer un feedback',
      }
    }

    await createUserSubmissionService({
      userId: user.id,
      type: 'feedback',
      subject: 'Quick Feedback',
      message,
      metadata: {
        source: 'quick-feedback-button',
        sourceUrl:
          typeof window !== 'undefined' ? window.location.href : undefined,
      },
    })

    return {
      success: true,
      message: 'Feedback envoyé avec succès',
    }
  } catch (error) {
    console.error('Error creating quick feedback:', error)
    return {
      success: false,
      message: "Erreur lors de l'envoi du feedback",
    }
  }
}
