import {sql} from 'drizzle-orm'
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import {associationCategory} from './association-category-model'
import {organization} from './auth-model'

/**
 * Document partage d'une association (s31, ADR 069) : statuts, PV, ordres du
 * jour publies par le bureau a tous ses membres authentifies. Table metier :
 * RLS forcee, policy `tenant_isolation` (ADR 002).
 *
 * - Table **dediee** : pas de discriminant partage / nominatif. Les documents
 *   nominatifs (s32) auront leur propre modele.
 * - `category_id` vers une categorie du domaine `document` en `RESTRICT` : la
 *   suppression d'une categorie est logique, le document garde son nom.
 * - `file_key` suit la convention de colonne de cle de fichier (`_key`) que
 *   lit l'inventaire de s12c. La cle vit **hors** des portees publiques de
 *   `CONTENT_FILE_SCOPES`.
 * - Pas de `updated_at` : un document ne se modifie pas, il se retire puis se
 *   redepose.
 */
export const sharedDocument = pgTable(
  'shared_document',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    title: text('title').notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => associationCategory.id, {onDelete: 'restrict'}),
    fileKey: text('file_key').notNull(),
    fileBytes: integer('file_bytes').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('shared_document_organization_created_at_idx').on(
      table.organizationId,
      table.createdAt
    ),
  ]
)

export type SharedDocumentModel = typeof sharedDocument.$inferSelect
export type AddSharedDocumentModel = typeof sharedDocument.$inferInsert
