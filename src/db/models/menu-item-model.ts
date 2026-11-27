import {relations, sql} from 'drizzle-orm'
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization} from './auth-model'
import {page} from './page-model'

/**
 * Entree du menu du site public d'une association (ADR 021, s04b) : une cible,
 * un rang, et sa **propre** visibilite — independante du statut de publication
 * de la page (critere 6).
 *
 * La cible est une page **ou** une adresse (ADR 078, s50), jamais les deux : la
 * contrainte `menu_item_page_xor_address_check` le garantit en base. Une entree
 * de page garde le titre de sa page ; le libelle propre n'existe que pour
 * l'entree libre, d'ou « libelle present si et seulement si adresse
 * presente ». L'adresse est validee par l'application (liste blanche de
 * `classifyLinkAddress`), a l'ecriture et au rendu.
 *
 * `organization_id` est porte **directement**, comme `page` et contrairement a
 * `content_block` : la requete reelle est « toutes les entrees de cette
 * association », sans point d'entree `page_id` prealable. La policy RLS forcee
 * s'ecrit donc sans jointure.
 *
 * Unique `(organization_id, page_id)` : une page n'apparait qu'une fois dans le
 * menu d'une meme association. Le selecteur d'ajout l'exclut deja cote
 * interface ; la base le garantit en dernier ressort, meme gabarit defensif que
 * `page_organization_slug_unique`. Les `NULL` restant distincts, plusieurs
 * entrees libres coexistent.
 */
export const menuItem = pgTable(
  'menu_item',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    pageId: uuid('page_id').references(() => page.id, {onDelete: 'cascade'}),
    label: text('label'),
    address: text('address'),
    rank: integer('rank').notNull(),
    visible: boolean('visible').default(true).notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('menu_item_organization_page_unique').on(
      table.organizationId,
      table.pageId
    ),
    check(
      'menu_item_page_xor_address_check',
      sql`(${table.pageId} is not null and ${table.label} is null and ${table.address} is null) or (${table.pageId} is null and ${table.label} is not null and ${table.address} is not null)`
    ),
  ]
)

export const menuItemRelations = relations(menuItem, ({one}) => ({
  page: one(page, {
    fields: [menuItem.pageId],
    references: [page.id],
  }),
}))

export type MenuItemModel = typeof menuItem.$inferSelect
export type AddMenuItemModel = typeof menuItem.$inferInsert
