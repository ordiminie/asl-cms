import {relations, sql} from 'drizzle-orm'
import {integer, jsonb, pgTable, text, uuid} from 'drizzle-orm/pg-core'

import {page} from './page-model'

/**
 * Bloc typé d'une page (ADR 019) : `type` en texte libre et `data` en `jsonb`,
 * sans schema de colonnes par type. La forme de `data` est garantie par le
 * schema Zod discriminé du service, jamais par la base — c'est ce qui permet a
 * un `type` que le code ne reconnait plus d'etre simplement ignore au rendu
 * plutot que de casser la page (critere 9).
 *
 * Pas de colonne `organization_id` dupliquee : le tenant est celui de la page,
 * et la policy RLS forcee de cette table joint `page` pour le retrouver.
 */
export const contentBlock = pgTable('content_block', {
  id: uuid('id')
    .default(sql`uuid_generate_v4()`)
    .primaryKey(),
  pageId: uuid('page_id')
    .notNull()
    .references(() => page.id, {onDelete: 'cascade'}),
  type: text('type').notNull(),
  rank: integer('rank').notNull(),
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
})

export const contentBlockRelations = relations(contentBlock, ({one}) => ({
  page: one(page, {
    fields: [contentBlock.pageId],
    references: [page.id],
  }),
}))

export type ContentBlockModel = typeof contentBlock.$inferSelect
export type AddContentBlockModel = typeof contentBlock.$inferInsert
