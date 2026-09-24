import {sql} from 'drizzle-orm'
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization} from './auth-model'

/**
 * Fiche d'un membre du bureau (s06) : un modele a **champs fixes** (ADR 007),
 * pas une page de blocs. Table metier : RLS forcee, policy `tenant_isolation`
 * (ADR 002).
 *
 * **Aucune cle etrangere vers `user` ni vers un membre proprietaire** : une
 * fiche n'est pas un compte. Un membre du bureau peut n'avoir aucun compte, et
 * le role d'autorisation `board` n'est pas le role affiche.
 *
 * `role_label` porte le role **affiche** (Presidente, Tresorier…), texte libre
 * (ADR 010). Il ne s'appelle pas `role` : l'homonymie avec le role
 * d'autorisation serait le meme piege que les deux « admin ».
 *
 * `photo_key` suit la convention de colonne de cle de fichier (`_key`) que
 * l'inventaire de s12c lira.
 *
 * `rank` porte l'ordre d'affichage, **sans contrainte d'unicite** sur
 * `(organization_id, rank)` : la renumerotation rang par rang la violerait
 * transitoirement, et `menu_item` n'en a pas non plus. La garantie de
 * contiguite est applicative, prouvee en e2e sur les rangs en base.
 */
export const boardMember = pgTable(
  'board_member',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    name: text('name').notNull(),
    roleLabel: text('role_label').notNull(),
    photoKey: text('photo_key'),
    biography: text('biography').default('').notNull(),
    rank: integer('rank').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('board_member_organization_rank_idx').on(
      table.organizationId,
      table.rank
    ),
  ]
)

export type BoardMemberModel = typeof boardMember.$inferSelect
export type AddBoardMemberModel = typeof boardMember.$inferInsert
