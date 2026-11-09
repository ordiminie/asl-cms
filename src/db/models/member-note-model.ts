import {sql} from 'drizzle-orm'
import {
  check,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization, user} from './auth-model'
import {memberProfile} from './member-profile-model'

export const memberNoteKindEnum = pgEnum('member_note_kind', [
  'note',
  'exchange',
])

export const memberNoteChannelEnum = pgEnum('member_note_channel', [
  'phone',
  'mail',
  'in_person',
  'email',
])

/**
 * Notes internes et echanges consignes par le bureau sur un membre (s24,
 * ADR 050). Table metier : RLS forcee, policy `tenant_isolation` (ADR 002).
 * Reservee au bureau : aucun ecran ni service cote membre ne la lit.
 *
 * - Une seule table pour le fil : `kind` distingue une note d'un echange, et
 *   `channel` est renseigne **si et seulement si** l'entree est un echange.
 * - `entry_date` ordonne le fil : le jour choisi pour un echange, le jour de
 *   saisie (Paris) pour une note. Ordre `entry_date desc, created_at desc,
 *   id desc`.
 * - `member_profile_id` en `ON DELETE RESTRICT` : une note n'a pas de sens
 *   sans sa fiche, et ne devient pas orpheline en silence.
 * - Auteur par copie (`author_*`, `on_behalf_of_*` pendant une imitation, s48) :
 *   l'auteur d'origine ne change jamais.
 * - `updated_at` nul tant que l'entree n'a pas ete modifiee. Suppression
 *   physique.
 */
export const memberNote = pgTable(
  'member_note',
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
    kind: memberNoteKindEnum('kind').notNull(),
    channel: memberNoteChannelEnum('channel'),
    entryDate: date('entry_date', {mode: 'string'}).notNull(),
    body: text('body').notNull(),
    authorUserId: uuid('author_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    authorName: text('author_name'),
    onBehalfOfUserId: uuid('on_behalf_of_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    onBehalfOfName: text('on_behalf_of_name'),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true}),
  },
  (table) => [
    index('member_note_organization_member_entry_idx').on(
      table.organizationId,
      table.memberProfileId,
      table.entryDate.desc(),
      table.createdAt.desc()
    ),
    check(
      'member_note_channel_kind_check',
      sql`(${table.kind} = 'exchange') = (${table.channel} IS NOT NULL)`
    ),
  ]
)

export type MemberNoteModel = typeof memberNote.$inferSelect
export type AddMemberNoteModel = typeof memberNote.$inferInsert
export type MemberNoteKindModel = (typeof memberNoteKindEnum.enumValues)[number]
export type MemberNoteChannelModel =
  (typeof memberNoteChannelEnum.enumValues)[number]
