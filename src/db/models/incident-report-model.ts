import {sql} from 'drizzle-orm'
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import {associationCategory} from './association-category-model'
import {organization, user} from './auth-model'

/**
 * Signalement envoye depuis la page publique `/signaler` (s10, ADR 028). Table
 * metier : RLS forcee, policy `tenant_isolation` (ADR 002).
 *
 * - **Aucun jsonb, aucune colonne d'adresse** (discipline de `contact_message`,
 *   ADR 025) : l'IP d'un visiteur n'a nulle part ou s'ecrire.
 * - `category_id` est nul quand l'association ne propose aucune categorie ;
 *   `ON DELETE RESTRICT` : une suppression physique par erreur echoue au lieu
 *   d'effacer les signalements (la suppression d'une categorie est logique).
 * - `status` est un texte ferme par le code : `reported`, `in_progress`,
 *   `resolved`, dans cet ordre seulement.
 * - `member_id` est pose **sans cle etrangere** et **aucun code ne l'ecrit** :
 *   la fiche membre n'existe pas encore (s12) ; s22 ajoutera la contrainte.
 */
export const incidentReport = pgTable(
  'incident_report',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    categoryId: uuid('category_id').references(() => associationCategory.id, {
      onDelete: 'restrict',
    }),
    location: text('location').notNull(),
    description: text('description').notNull(),
    reporterName: text('reporter_name'),
    reporterEmail: text('reporter_email'),
    reporterPhone: text('reporter_phone'),
    status: text('status').default('reported').notNull(),
    memberId: uuid('member_id'),
    notificationFailed: boolean('notification_failed').default(false).notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('incident_report_organization_created_at_idx').on(
      table.organizationId,
      table.createdAt.desc()
    ),
  ]
)

/**
 * Historique des statuts d'un signalement (critere 3) : une ligne par
 * changement, horodatee et attribuee.
 *
 * - `author_user_id` nul = « depuis le site » (le premier evenement) ;
 *   `ON DELETE SET NULL` pour qu'un compte supprime n'efface pas l'historique.
 * - `author_name` copie le nom **au moment du changement** : l'attribution
 *   survit a la suppression ou au renommage du compte.
 * - Porte son propre `organization_id` : la policy n'a pas de jointure a faire.
 */
export const incidentReportEvent = pgTable(
  'incident_report_event',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    reportId: uuid('report_id')
      .notNull()
      .references(() => incidentReport.id, {onDelete: 'cascade'}),
    status: text('status').notNull(),
    authorUserId: uuid('author_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    authorName: text('author_name'),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('incident_report_event_report_created_at_idx').on(
      table.reportId,
      table.createdAt
    ),
  ]
)

export type IncidentReportModel = typeof incidentReport.$inferSelect
export type AddIncidentReportModel = typeof incidentReport.$inferInsert
export type IncidentReportEventModel = typeof incidentReportEvent.$inferSelect
export type AddIncidentReportEventModel =
  typeof incidentReportEvent.$inferInsert
