'use server'

import {refresh} from 'next/cache'
import {getTranslations} from 'next-intl/server'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import type {ContactMessageReadActionResult} from '@/components/features/contact/contact-message-detail'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {setContactMessageReadService} from '@/services/facades/contact-message-service-facade'

/**
 * Server Actions des messages recus (s08, ecran 3).
 *
 * Chacune rejoue le controle de session (`requireActionAuth`) avant d'appeler
 * la facade — le service reverifie `contact.message.read` de son cote — puis
 * rafraichit le routeur **apres** le succes seulement : la liste reprend le
 * nouvel etat de lecture. Un refus est rendu comme un resultat traduit, jamais
 * leve : l'ecran l'ecrit dans la page.
 */

const setRead = async (
  messageId: string,
  read: boolean
): Promise<ContactMessageReadActionResult> => {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    await setContactMessageReadService({
      organizationId: tenant.id,
      messageId,
      read,
    })

    refresh()
    return {status: 'saved'}
  } catch (error) {
    const t = await getTranslations('BureauContactMessagesPage.errors')
    return {
      status: 'error',
      message:
        error instanceof AuthorizationError ? t('forbidden') : t('failed'),
    }
  }
}

/** Marque le message lu a son ouverture (decision E). Idempotent. */
export async function markContactMessageReadAction(
  messageId: string
): Promise<ContactMessageReadActionResult> {
  return setRead(messageId, true)
}

/** « Marquer comme non lu ». Idempotent. */
export async function markContactMessageUnreadAction(
  messageId: string
): Promise<ContactMessageReadActionResult> {
  return setRead(messageId, false)
}
