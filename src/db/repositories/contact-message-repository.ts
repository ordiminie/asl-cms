import {and, count, desc, eq} from 'drizzle-orm'

import {
  AddContactMessageModel,
  contactMessage,
  ContactMessageModel,
} from '@/db/models/contact-message-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Messages recus depuis la page Contact (s08, ADR 025). Sous RLS forcee : hors
 * `withTenant(organizationId, ...)`, rien ne sort et rien ne s'ecrit.
 */

export type ContactMessagePageRows = {
  rows: ContactMessageModel[]
  total: number
}

/**
 * Le plus recent d'abord, puis l'identifiant : un departage stable, pour que
 * la pagination ne saute ni ne repete une ligne.
 */
const CONTACT_MESSAGE_ORDER = [
  desc(contactMessage.createdAt),
  desc(contactMessage.id),
] as const

export const createContactMessageDao = async (
  input: Pick<
    AddContactMessageModel,
    'organizationId' | 'senderName' | 'senderEmail' | 'subject' | 'body'
  >
): Promise<ContactMessageModel> => {
  const [row] = await getDb().insert(contactMessage).values(input).returning()
  return row
}

export const getContactMessageByIdDao = async (
  messageId: string
): Promise<ContactMessageModel | undefined> => {
  const [row] = await getDb()
    .select()
    .from(contactMessage)
    .where(eq(contactMessage.id, messageId))
  return row
}

export const getContactMessagesPageDao = async (input: {
  organizationId: string
  limit: number
  offset: number
}): Promise<ContactMessagePageRows> => {
  const where = eq(contactMessage.organizationId, input.organizationId)
  const [rows, [{total}]] = await Promise.all([
    getDb()
      .select()
      .from(contactMessage)
      .where(where)
      .orderBy(...CONTACT_MESSAGE_ORDER)
      .limit(input.limit)
      .offset(input.offset),
    getDb().select({total: count()}).from(contactMessage).where(where),
  ])
  return {rows, total}
}

export const countUnreadContactMessagesDao = async (
  organizationId: string
): Promise<number> => {
  const [{total}] = await getDb()
    .select({total: count()})
    .from(contactMessage)
    .where(
      and(
        eq(contactMessage.organizationId, organizationId),
        eq(contactMessage.read, false)
      )
    )
  return total
}

export const setContactMessageReadDao = async (
  messageId: string,
  read: boolean
): Promise<ContactMessageModel | undefined> => {
  const [row] = await getDb()
    .update(contactMessage)
    .set({read})
    .where(eq(contactMessage.id, messageId))
    .returning()
  return row
}

export const markContactMessageNotificationFailedDao = async (
  messageId: string
): Promise<void> => {
  await getDb()
    .update(contactMessage)
    .set({notificationFailed: true})
    .where(eq(contactMessage.id, messageId))
}
