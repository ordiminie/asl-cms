import {sql} from 'drizzle-orm'
import {
  AnyPgColumn,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization, user} from './auth-model'
import {memberProfile} from './member-profile-model'

export const memberProfileEmailRoleEnum = pgEnum('member_profile_email_role', [
  'holder',
  'additional',
])

export const memberProfileEmailStatusEnum = pgEnum(
  'member_profile_email_status',
  ['active', 'pending']
)

export const memberProfileEmailOriginEnum = pgEnum(
  'member_profile_email_origin',
  ['file', 'site']
)

/**
 * Les adresses d'une fiche (s54, ADR 056, remplace l'ADR 040). Table metier :
 * RLS forcee, policy `tenant_isolation` sur sa propre colonne
 * `organization_id` (ADR 002).
 *
 * - `role` : titulaire ou supplementaire, **propre a chaque fiche** ; une
 *   fiche a au plus une titulaire active (index unique partiel), et exactement
 *   une des qu'une adresse est active (regle pure de succession).
 * - `status` : `pending` tant que le lien envoye par le membre n'est pas
 *   confirme ; une adresse en attente ne recoit rien et ne se connecte pas.
 * - `origin` : fichier Pennylane ou saisie sur le site, affichee au bureau.
 * - `added_by_user_id` : l'auteur d'un ajout par le membre, nul pour le
 *   fichier et le bureau.
 * - `replaces_email_id` : l'adresse qu'une modification en attente
 *   remplacera.
 * - `confirmation_token_hash` : SHA-256 du jeton, **jamais** le jeton en
 *   clair ; `expires_at` borne l'attente.
 * - `unsubscribed_at` : le refus des campagnes, porte par l'adresse (ADR
 *   057).
 */
export const memberProfileEmail = pgTable(
  'member_profile_email',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    memberProfileId: uuid('member_profile_id')
      .notNull()
      .references(() => memberProfile.id, {onDelete: 'cascade'}),
    email: text('email').notNull(),
    role: memberProfileEmailRoleEnum('role').notNull(),
    status: memberProfileEmailStatusEnum('status').notNull(),
    origin: memberProfileEmailOriginEnum('origin').notNull(),
    addedByUserId: uuid('added_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    replacesEmailId: uuid('replaces_email_id').references(
      (): AnyPgColumn => memberProfileEmail.id,
      {onDelete: 'cascade'}
    ),
    confirmationTokenHash: text('confirmation_token_hash'),
    expiresAt: timestamp('expires_at', {withTimezone: true}),
    unsubscribedAt: timestamp('unsubscribed_at', {withTimezone: true}),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('member_profile_email_profile_email_idx').on(
      table.memberProfileId,
      sql`lower(${table.email})`
    ),
    uniqueIndex('member_profile_email_active_holder_idx')
      .on(table.memberProfileId)
      .where(sql`${table.role} = 'holder' and ${table.status} = 'active'`),
    index('member_profile_email_organization_email_idx').on(
      table.organizationId,
      sql`lower(${table.email})`
    ),
  ]
)

export type MemberProfileEmailModel = typeof memberProfileEmail.$inferSelect
export type AddMemberProfileEmailModel = typeof memberProfileEmail.$inferInsert
export type MemberProfileEmailRoleModel =
  (typeof memberProfileEmailRoleEnum.enumValues)[number]
export type MemberProfileEmailStatusModel =
  (typeof memberProfileEmailStatusEnum.enumValues)[number]
export type MemberProfileEmailOriginModel =
  (typeof memberProfileEmailOriginEnum.enumValues)[number]
