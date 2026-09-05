import mailchimp from '@mailchimp/mailchimp_marketing'

import {env} from '@/env'
import {logger} from '@/lib/logger'

mailchimp.setConfig({
  apiKey: env.MAILCHIMP_API_KEY,
  server: env.MAILCHIMP_SERVER_PREFIX,
})

const getAudienceId = (listId?: string): string => {
  const audienceId = listId || env.MAILCHIMP_AUDIENCE_ID
  if (!audienceId) {
    throw new Error('MAILCHIMP_AUDIENCE_ID is not configured')
  }
  return audienceId
}

export async function subscribeToNewsletterService(
  email: string,
  tags?: string[]
) {
  if (!email || email.trim() === '') {
    return {error: 'Email is required'}
  }

  try {
    const audienceId = getAudienceId()
    const subscriberHash = email.toLowerCase()

    const response = await mailchimp.lists.setListMember(
      audienceId,
      subscriberHash,
      {
        email_address: email,
        status_if_new: 'subscribed',
        status: 'subscribed',
      }
    )

    logger.info(`Subscriber ${email} added/updated in newsletter`)

    if (tags && tags.length > 0) {
      await mailchimp.lists.updateListMemberTags(audienceId, subscriberHash, {
        tags: tags.map((tag) => ({name: tag, status: 'active'})),
      })
      logger.info(`Tags ${tags.join(', ')} added to ${email}`)
    }

    return {success: true, status: response.status}
  } catch (error: unknown) {
    const mailchimpError = error as {response?: {body?: {detail?: string}}}
    const message =
      mailchimpError.response?.body?.detail || 'An error occurred.'
    logger.error(`Error subscribing ${email} to newsletter: ${message}`)
    throw new Error(message)
  }
}

export async function addTagToSubscriberService(
  email: string,
  tag: string,
  listId?: string
) {
  if (!email || email.trim() === '') {
    return {error: 'Email is required'}
  }

  if (!tag || tag.trim() === '') {
    return {error: 'Tag is required'}
  }

  try {
    const audienceId = getAudienceId(listId)
    const subscriberHash = email.toLowerCase()

    try {
      await mailchimp.lists.getListMember(audienceId, subscriberHash)
    } catch {
      await mailchimp.lists.setListMember(audienceId, subscriberHash, {
        email_address: email,
        status_if_new: 'subscribed',
      })
      logger.info(`Subscriber ${email} created in list ${audienceId}`)
    }

    await mailchimp.lists.updateListMemberTags(audienceId, subscriberHash, {
      tags: [{name: tag, status: 'active'}],
    })

    logger.info(`Tag ${tag} added to ${email} in list ${audienceId}`)
    return {success: true, message: 'Tag added successfully'}
  } catch (error: unknown) {
    const mailchimpError = error as {
      response?: {body?: {detail?: string}}
      message?: string
    }
    logger.error(`Error adding tag to ${email}: ${mailchimpError.message}`, {
      email,
      tag,
      listId,
      error,
    })
    throw new Error(
      mailchimpError.response?.body?.detail ||
        'An error occurred while adding tag.'
    )
  }
}

export async function removeTagFromSubscriberService(
  email: string,
  tag: string,
  listId?: string
) {
  if (!email || email.trim() === '') {
    return {error: 'Email is required'}
  }

  if (!tag || tag.trim() === '') {
    return {error: 'Tag is required'}
  }

  try {
    const audienceId = getAudienceId(listId)
    const subscriberHash = email.toLowerCase()

    try {
      await mailchimp.lists.getListMember(audienceId, subscriberHash)
    } catch {
      logger.warn(`Subscriber ${email} not found in list ${audienceId}`)
      return {error: 'Subscriber not found'}
    }

    await mailchimp.lists.updateListMemberTags(audienceId, subscriberHash, {
      tags: [{name: tag, status: 'inactive'}],
    })

    logger.info(`Tag ${tag} removed from ${email} in list ${audienceId}`)
    return {success: true, message: 'Tag removed successfully'}
  } catch (error: unknown) {
    const mailchimpError = error as {
      response?: {body?: {detail?: string}}
      message?: string
    }
    logger.error(
      `Error removing tag from ${email}: ${mailchimpError.message}`,
      {
        email,
        tag,
        listId,
        error,
      }
    )
    throw new Error(
      mailchimpError.response?.body?.detail ||
        'An error occurred while removing tag.'
    )
  }
}

export async function unsubscribeFromNewsletterService(
  email: string,
  listId?: string
) {
  if (!email || email.trim() === '') {
    return {error: 'Email is required'}
  }

  try {
    const audienceId = getAudienceId(listId)
    const subscriberHash = email.toLowerCase()

    await mailchimp.lists.updateListMember(audienceId, subscriberHash, {
      status: 'unsubscribed',
    })

    logger.info(`Subscriber ${email} unsubscribed from list ${audienceId}`)
    return {success: true, message: 'Unsubscribed successfully'}
  } catch (error: unknown) {
    const mailchimpError = error as {
      response?: {body?: {detail?: string}}
      message?: string
    }
    logger.error(`Error unsubscribing ${email}: ${mailchimpError.message}`, {
      email,
      listId,
      error,
    })
    throw new Error(
      mailchimpError.response?.body?.detail ||
        'An error occurred while unsubscribing.'
    )
  }
}
