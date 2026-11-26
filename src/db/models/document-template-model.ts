import {sql} from 'drizzle-orm'
import {index, pgTable, text, timestamp, uuid} from 'drizzle-orm/pg-core'

import {organization} from './auth-model'

/**
 * Modele de document ecrit par le bureau (s36, ADR 074 §1) : nom interne,
 * objet imprime et texte en Markdown restreint, variables non remplacees.
 * Table metier : RLS forcee, policy `tenant_isolation` (ADR 002). Table plate,
 * sans fichier ni lien vers les documents deposes, qui restent figes.
 */
export const documentTemplate = pgTable(
  'document_template',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    name: text('name').notNull(),
    subject: text('subject').notNull(),
    bodyMarkdown: text('body_markdown').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('document_template_organization_name_idx').on(
      table.organizationId,
      sql`lower(${table.name})`
    ),
  ]
)

export type DocumentTemplateModel = typeof documentTemplate.$inferSelect
export type AddDocumentTemplateModel = typeof documentTemplate.$inferInsert
