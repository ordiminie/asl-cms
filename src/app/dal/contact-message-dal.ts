import 'server-only'

import {cache} from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {NotFoundError} from '@/services/errors/not-found-error'
import {ValidationParsedZodError} from '@/services/errors/validation-error'
import {
  canManageContactMessagesService,
  getContactMessageService,
  getContactMessagesPageService,
} from '@/services/facades/contact-message-service-facade'
import {
  ContactMessageDTO,
  ContactMessageListPageDTO,
} from '@/services/types/domain/contact-message-types'

/**
 * Messages recus (s08, ADR 025). **Aucun `'use cache'`** : c'est une donnee
 * d'administration, qui se streame derriere un `<Suspense>` et doit refleter
 * le dernier message arrive. Le service ouvre lui-meme le scope du tenant
 * (`withTenant`) pour l'association passee, celle du domaine appele.
 */
export const getContactMessagesForBureauDal = cache(
  async (
    organizationId: string,
    page: number
  ): Promise<ContactMessageListPageDTO> =>
    getContactMessagesPageService(organizationId, page)
)

/**
 * Un message du bureau. L'absence, ou un identifiant malforme qui ne peut
 * designer aucun message, devient `undefined`, que l'appelant traduit en 404 :
 * un refus ou une panne remonte.
 */
export const getContactMessageForBureauDal = cache(
  async (
    organizationId: string,
    messageId: string
  ): Promise<ContactMessageDTO | undefined> =>
    getContactMessageService(organizationId, messageId).catch(
      (error: unknown) => {
        if (
          error instanceof NotFoundError ||
          error instanceof ValidationParsedZodError
        )
          return undefined
        throw error
      }
    )
)

/**
 * L'utilisateur connecte peut-il consulter les messages de l'association du
 * domaine appele ? Donnee par utilisateur : jamais cachee au-dela de la
 * requete.
 */
export const canManageCurrentContactMessagesDal = cache(
  async (): Promise<boolean> => {
    const tenant = await requireCurrentTenantDal()
    return canManageContactMessagesService(tenant.id)
  }
)
