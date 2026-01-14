'use server'

import {headers} from 'next/headers'
import {RateLimiterMemory} from 'rate-limiter-flexible'

import {createUserSubmissionService} from '@/services/facades/user-submission-service-facade'

export type ContactFormState = {
  success: boolean
  message: string
}

const rateLimiter = new RateLimiterMemory({
  points: 3,
  duration: 300,
})

function isRateLimiterRes(error: unknown) {
  return (
    error &&
    typeof error === 'object' &&
    'remainingPoints' in error &&
    'msBeforeNext' in error
  )
}

export async function submitContactAction(
  _prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for') ||
    headersList.get('x-real-ip') ||
    'unknown'

  try {
    await rateLimiter.consume(ip)
  } catch (error) {
    if (isRateLimiterRes(error)) {
      const retryAfter = Math.ceil(
        (error as {msBeforeNext: number}).msBeforeNext / 1000
      )
      return {
        success: false,
        message: `Trop de requêtes. Réessayez dans ${retryAfter} secondes.`,
      }
    }
    throw error
  }

  const email = formData.get('email') as string
  const subject = formData.get('subject') as string
  const content = formData.get('content') as string

  if (!email || !subject || !content) {
    return {
      success: false,
      message: 'Tous les champs sont obligatoires.',
    }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return {
      success: false,
      message: 'Veuillez entrer un email valide.',
    }
  }

  if (subject.length < 3 || subject.length > 255) {
    return {
      success: false,
      message: 'Le sujet doit contenir entre 3 et 255 caractères.',
    }
  }

  if (content.length < 10 || content.length > 5000) {
    return {
      success: false,
      message: 'Le message doit contenir entre 10 et 5000 caractères.',
    }
  }

  try {
    await createUserSubmissionService({
      email,
      type: 'contact',
      subject,
      message: content,
      metadata: {
        source: 'contact-page',
        ip: ip || undefined,
      },
    })

    return {
      success: true,
      message:
        'Votre message a été envoyé avec succès. Nous vous répondrons rapidement.',
    }
  } catch (error) {
    console.error('Error submitting contact form:', error)
    return {
      success: false,
      message: 'Une erreur est survenue. Veuillez réessayer plus tard.',
    }
  }
}
