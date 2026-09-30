import {sql} from 'drizzle-orm'
import {pgTable, text, timestamp, uniqueIndex, uuid} from 'drizzle-orm/pg-core'

import {organization} from './auth-model'

/**
 * Categorie administrable d'une association (s10, ADR 028). **Generique** :
 * `domain` dit a quel usage elle appartient (`'report'` aujourd'hui ; s23 et
 * s35 ajouteront le leur sans migration). Table metier : RLS forcee, policy
 * `tenant_isolation` (ADR 002).
 *
 * - Le nom `categories` est pris par le blog herite (ADR 023) : d'ou
 *   `association_category`.
 * - `domain` est un texte ferme **par le code**, pas un `pgEnum`.
 * - `routing_email` est nul quand l'adresse est absente : aucune chaine vide
 *   n'est jamais ecrite (ADR 028 §4).
 * - Suppression **logique** (`deleted_at`) : les signalements qui la
 *   referencent continuent de lire son nom (critere 5).
 * - Nom unique parmi les categories **actives** d'un domaine, sans tenir
 *   compte de la casse : une categorie supprimee ne reserve pas son nom.
 */
export const associationCategory = pgTable(
  'association_category',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    domain: text('domain').notNull(),
    name: text('name').notNull(),
    routingEmail: text('routing_email'),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', {withTimezone: true}),
  },
  (table) => [
    uniqueIndex('association_category_active_name_idx')
      .on(table.organizationId, table.domain, sql`lower(${table.name})`)
      .where(sql`${table.deletedAt} is null`),
  ]
)

export type AssociationCategoryModel = typeof associationCategory.$inferSelect
export type AddAssociationCategoryModel =
  typeof associationCategory.$inferInsert
