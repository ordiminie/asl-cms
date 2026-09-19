import {sql} from 'drizzle-orm'
import {
  date,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization} from './auth-model'

/**
 * Compteurs journaliers de la limitation de debit (s03 : demandes de lien de
 * connexion). Une ligne = une association, une **empreinte** (HMAC de
 * l'adresse, jamais la valeur en clair — PRD, « Limitation de debit des
 * formulaires publics ») et un jour (Europe/Paris), avec le nombre de demandes
 * du jour. Le changement de jour remet le compteur a zero sans tache planifiee ;
 * les lignes des jours passes sont purgees a chaque demande. En base et non en
 * memoire : un compteur en memoire repartirait a zero au redemarrage.
 *
 * L'unicite sur (association, empreinte, jour) porte l'incrément atomique :
 * `insert ... on conflict ... do update set count = count + 1 returning count`.
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
    fingerprint: text('fingerprint').notNull(),
    day: date('day', {mode: 'string'}).notNull(),
    count: integer('count').default(1).notNull(),
  },
  (table) => [
    uniqueIndex('rate_limit_event_counter_idx').on(
      table.organizationId,
      table.fingerprint,
      table.day
    ),
  ]
)

export type RateLimitEventModel = typeof rateLimitEvent.$inferSelect
export type AddRateLimitEventModel = typeof rateLimitEvent.$inferInsert
