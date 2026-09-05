'use server'

import {subscribeToNewsletterService} from '@/services/facades/newsletter-service-facade'
import {NewsletterEmailTag} from '@/services/types/domain/newsletter-email-types'

export async function subscribeToNewsletterAction(email: string) {
  if (!email || email.trim() === '') {
    return {success: false, error: 'Email is required'}
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return {success: false, error: 'Invalid email format'}
  }

  try {
    await subscribeToNewsletterService(email, [NewsletterEmailTag.Newsletter])
    return {success: true}
  } catch (error) {
    console.error('Error subscribing to newsletter:', error)
    return {
      success: false,
      error: 'An error occurred while subscribing',
    }
  }
}
