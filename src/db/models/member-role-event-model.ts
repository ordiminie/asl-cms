import {sql} from 'drizzle-orm'
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization, organizationRoleEnum, user} from './auth-model'
import {memberProfile} from './member-profile-model'

export const memberRoleEventReasonEnum = pgEnum('member_role_event_reason', [
  'assignment',
  'presidency_transfer',
  'email_change',
  'removal',
])

/**
 * Trace des changements de role d'association (s14, ADR 039). Table metier :
 * RLS forcee, policy `tenant_isolation` (ADR 002). Stockee, sans ecran ; elle
 * entre dans l'export de s38.
 *
 * - Une ligne par compte dont le role change : une passation en ecrit deux.
 * - `from_role` / `to_role` nuls pour une ligne `member` creee ou supprimee.
 * - Le membre vise et l'auteur sont designes par cle (`SET NULL`) **et** par
 *   leur nom copie au moment du changement : l'historique survit a la
 *   suppression d'une fiche ou d'un compte et au changement d'adresse.
 *   Jamais l'email comme identite.
 * - `author_user_id` nul = acte d'exploitation (« Zourite Studio »).
 */
export const memberRoleEvent = pgTable(
  'member_role_event',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    memberProfileId: uuid('member_profile_id').references(
      () => memberProfile.id,
      {onDelete: 'set null'}
    ),
    targetUserId: uuid('target_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    targetName: text('target_name'),
    authorUserId: uuid('author_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    authorName: text('author_name'),
    fromRole: organizationRoleEnum('from_role'),
    toRole: organizationRoleEnum('to_role'),
    reason: memberRoleEventReasonEnum('reason').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('member_role_event_organization_created_at_idx').on(
      table.organizationId,
      table.createdAt
    ),
  ]
)

export type MemberRoleEventModel = typeof memberRoleEvent.$inferSelect
export type AddMemberRoleEventModel = typeof memberRoleEvent.$inferInsert
export type MemberRoleEventReasonModel =
  (typeof memberRoleEventReasonEnum.enumValues)[number]
