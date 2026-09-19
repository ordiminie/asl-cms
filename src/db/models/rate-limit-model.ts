import {sql} from 'drizzle-orm'
import {index, pgTable, text, timestamp, uuid} from 'drizzle-orm/pg-core'

import {organization} from './auth-model'

/**
 * Demandes comptees par la limitation de debit (s03 : demandes de lien de
 * connexion). Une ligne = une demande acceptee, dans un seau (`bucket`) et pour
 * une **empreinte** : un HMAC de l'adresse ou de l'IP, jamais la valeur en
 * clair (PRD, « Limitation de debit des formulaires publics »). Les lignes de
 * plus de 24 h sont purgees a chaque demande. En base et non en memoire : un
 * compteur en memoire repartirait a zero au redemarrage.
 *
 * Table metier : RLS forcee, policy `tenant_isolation` (ADR 002).
 */
export const rateLimitEvent = pgTable(
  'rate_limit_event',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    bucket: text('bucket').notNull(),
    fingerprint: text('fingerprint').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('rate_limit_event_lookup_idx').on(
      table.organizationId,
      table.bucket,
      table.fingerprint,
      table.createdAt
    ),
  ]
)

export type RateLimitEventModel = typeof rateLimitEvent.$inferSelect
export type AddRateLimitEventModel = typeof rateLimitEvent.$inferInsert
