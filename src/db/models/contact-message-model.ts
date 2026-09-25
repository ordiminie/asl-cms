import {sql} from 'drizzle-orm'
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization} from './auth-model'

/**
 * Message envoye depuis la page publique `/contact` (s08, ADR 025). Table
 * dediee, a champs fixes : `user_submissions` reste au boilerplate.
 *
 * - **Aucun jsonb, aucune colonne d'adresse** : il n'existe pas d'endroit ou
 *   ecrire l'adresse IP d'un visiteur.
 * - `notification_failed` est une colonne, pas une metadonnee : le badge de la
 *   liste du bureau se lit sans deballer de jsonb.
 * - Table metier : RLS forcee, policy `tenant_isolation` (ADR 002).
 */
export const contactMessage = pgTable(
  'contact_message',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    senderName: text('sender_name'),
    senderEmail: text('sender_email').notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    read: boolean('read').default(false).notNull(),
    notificationFailed: boolean('notification_failed').default(false).notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('contact_message_organization_created_at_idx').on(
      table.organizationId,
      table.createdAt.desc()
    ),
  ]
)

export type ContactMessageModel = typeof contactMessage.$inferSelect
export type AddContactMessageModel = typeof contactMessage.$inferInsert
