import {sql} from 'drizzle-orm'
import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization} from './auth-model'

/**
 * Compteurs de la limitation de debit, **table unique du produit** (s03 :
 * demandes de lien de connexion, par jour ; s08b : formulaires publics, par
 * heure). Une ligne = une association, une **empreinte** (HMAC de la valeur
 * comptee, liee a l'usage — jamais la valeur en clair, PRD « Limitation de
 * debit des formulaires publics ») et le **debut de sa fenetre**
 * (`window_start`), avec le nombre d'evenements de la fenetre. Le changement de
 * fenetre remet le compteur a zero sans tache planifiee. En base et non en
 * memoire : un compteur en memoire repartirait a zero au redemarrage.
 *
 * Invariant de la table partagee : une purge n'efface que des lignes dont la
 * fenetre est deja close pour **tous** les usages — son seuil est toujours
 * anterieur ou egal au debut de la fenetre courante de l'usage le plus long
 * (le jour).
 *
 * L'unicite sur (association, empreinte, fenetre) porte l'incrément atomique :
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
    windowStart: timestamp('window_start', {withTimezone: true}).notNull(),
    count: integer('count').default(1).notNull(),
  },
  (table) => [
    uniqueIndex('rate_limit_event_counter_idx').on(
      table.organizationId,
      table.fingerprint,
      table.windowStart
    ),
  ]
)

export type RateLimitEventModel = typeof rateLimitEvent.$inferSelect
export type AddRateLimitEventModel = typeof rateLimitEvent.$inferInsert
