import {relations, sql} from 'drizzle-orm'
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization} from './auth-model'
import {contentBlock} from './content-block-model'

/**
 * Cycle de vie d'une page (s04). Trois valeurs seulement : les statuts
 * `dirty`, `publishing` et `error` de la barre d'apercu sont des etats client,
 * derives du formulaire et de la requete en cours, jamais persistes.
 */
export const pageStatusEnum = pgEnum('page_status', [
  'draft',
  'published',
  'unpublished',
])

/**
 * Page du site public d'une association (ADR 007, ADR 019, ADR 020) : un
 * titre, un slug servi a la racine, et une liste ordonnee de blocs typés dans
 * `content_block`. Table metier : RLS forcee, policy `tenant_isolation`
 * (ADR 002).
 *
 * Le slug est unique **par association**, jamais globalement comme
 * `posts_translation.slug` du blog herite : deux associations ont le droit
 * d'avoir chacune leur page `/adherer`.
 */
export const page = pgTable(
  'page',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    status: pageStatusEnum('status').default('draft').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('page_organization_slug_unique').on(
      table.organizationId,
      table.slug
    ),
  ]
)

export const pageRelations = relations(page, ({many}) => ({
  blocks: many(contentBlock),
}))

export type PageModel = typeof page.$inferSelect
export type AddPageModel = typeof page.$inferInsert
export type UpdatePageModel = typeof page.$inferInsert
