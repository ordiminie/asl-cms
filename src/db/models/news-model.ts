import {sql} from 'drizzle-orm'
import {
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization} from './auth-model'

/**
 * Cycle de vie d'une actualite (s05, ADR 023). Son propre enum, distinct de
 * `page_status` : les deux modeles evoluent chacun a leur rythme.
 */
export const newsStatusEnum = pgEnum('news_status', [
  'draft',
  'published',
  'unpublished',
])

/**
 * Actualite datee d'une association (s05, ADR 023) : un modele a **champs
 * fixes** (ADR 007), pas une page de blocs ni une ligne de `posts` (blog
 * herite, hors produit). Table metier : RLS forcee, policy `tenant_isolation`
 * (ADR 002).
 *
 * - `slug` est nul tant que l'actualite n'a pas de titre, puis fixe au premier
 *   enregistrement titre et **jamais recalcule** : c'est l'URL stable.
 *   Unique **par association**.
 * - `published_on` est une `date` sans heure ni fuseau, choisie par le bureau.
 * - `image_key` suit la convention de colonne de cle de fichier (`_key`) que
 *   l'inventaire de s12c lira.
 */
export const news = pgTable(
  'news',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    slug: text('slug'),
    title: text('title').default('').notNull(),
    publishedOn: date('published_on', {mode: 'string'}).notNull(),
    imageKey: text('image_key'),
    imageAlt: text('image_alt').default('').notNull(),
    content: text('content').default('').notNull(),
    status: newsStatusEnum('status').default('draft').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('news_organization_slug_unique').on(
      table.organizationId,
      table.slug
    ),
    index('news_organization_status_published_on_idx').on(
      table.organizationId,
      table.status,
      table.publishedOn
    ),
  ]
)

export type NewsModel = typeof news.$inferSelect
export type AddNewsModel = typeof news.$inferInsert
