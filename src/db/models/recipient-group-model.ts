import {sql} from 'drizzle-orm'
import {
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization} from './auth-model'
import {memberProfile} from './member-profile-model'

/**
 * Groupe de destinataires compose par le bureau (s27, ADR 060 §4). Table
 * metier : RLS forcee, policy `tenant_isolation` (ADR 002). Nom unique par
 * association, sans casse.
 */
export const recipientGroup = pgTable(
  'recipient_group',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('recipient_group_organization_name_idx').on(
      table.organizationId,
      sql`lower(${table.name})`
    ),
  ]
)

/**
 * Appartenance d'une fiche a un groupe (s27, ADR 060 §4). Porte son propre
 * `organization_id` (RLS forcee, sans jointure). Disparait avec le groupe
 * comme avec la fiche : une fiche supprimee quitte ses groupes.
 */
export const recipientGroupMember = pgTable(
  'recipient_group_member',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    groupId: uuid('group_id')
      .notNull()
      .references(() => recipientGroup.id, {onDelete: 'cascade'}),
    memberProfileId: uuid('member_profile_id')
      .notNull()
      .references(() => memberProfile.id, {onDelete: 'cascade'}),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({columns: [table.groupId, table.memberProfileId]})]
)

export type RecipientGroupModel = typeof recipientGroup.$inferSelect
export type AddRecipientGroupModel = typeof recipientGroup.$inferInsert
export type RecipientGroupMemberModel = typeof recipientGroupMember.$inferSelect
