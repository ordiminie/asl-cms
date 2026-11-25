import {sql} from 'drizzle-orm'
import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import {associationCategory} from './association-category-model'
import {organization} from './auth-model'
import {memberProfile} from './member-profile-model'

/**
 * Document nominatif d'une fiche (s32, ADR 073) : facture, convocation
 * deposees par le bureau pour **une** fiche. Table metier : RLS forcee,
 * policy `tenant_isolation` (ADR 002).
 *
 * - `member_profile_id` est la **cle de rattachement**, en `RESTRICT` : seuls
 *   les comptes relies a cette fiche voient le document ; une vente ne le
 *   deplace pas (ADR 059 §3). Jamais le compte : une fiche sans compte a son
 *   dossier.
 * - `category_id` vers une categorie du domaine `member_document`, en
 *   `RESTRICT` : la suppression d'une categorie est logique.
 * - `document_date` : la date ecrite sur le document, saisie par le bureau ;
 *   descriptive, elle ordonne la liste du membre.
 * - `file_key` suit la convention `_key` de l'inventaire de s12c. La cle vit
 *   dans le dossier de la fiche, **hors** des portees de `CONTENT_FILE_SCOPES`.
 * - Pas de `updated_at` : un document se retire puis se redepose.
 */
export const memberDocument = pgTable(
  'member_document',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    memberProfileId: uuid('member_profile_id')
      .notNull()
      .references(() => memberProfile.id, {onDelete: 'restrict'}),
    title: text('title').notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => associationCategory.id, {onDelete: 'restrict'}),
    documentDate: date('document_date', {mode: 'string'}).notNull(),
    fileKey: text('file_key').notNull(),
    fileBytes: integer('file_bytes').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('member_document_organization_profile_idx').on(
      table.organizationId,
      table.memberProfileId
    ),
    index('member_document_organization_created_at_idx').on(
      table.organizationId,
      table.createdAt
    ),
  ]
)

export type MemberDocumentModel = typeof memberDocument.$inferSelect
export type AddMemberDocumentModel = typeof memberDocument.$inferInsert
