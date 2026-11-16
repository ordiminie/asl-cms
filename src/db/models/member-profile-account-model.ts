import {sql} from 'drizzle-orm'
import {index, pgTable, timestamp, uniqueIndex, uuid} from 'drizzle-orm/pg-core'

import {organization, user} from './auth-model'
import {memberProfile} from './member-profile-model'

/**
 * Lien fiche ↔ compte (s53, ADR 054, remplace l'ADR 037). Table metier : RLS
 * forcee, policy `tenant_isolation` sur sa propre colonne `organization_id`
 * (ADR 002).
 *
 * - Une adresse portee par plusieurs fiches d'une association = une personne
 *   = un compte relie a chacune : plusieurs lignes pour un meme `user_id`.
 * - **Unique `(member_profile_id, user_id)`** (s54, ADR 056 §3) : un compte
 *   par adresse active, donc plusieurs comptes par fiche ; un meme lien
 *   n'existe qu'une fois.
 * - `ON DELETE CASCADE` des deux cotes : une fiche ou un compte supprime
 *   emporte le lien, jamais l'autre bout.
 * - « Mes fiches » se lit par `(organization_id, user_id)`, toujours triee
 *   (ADR 054 §7), jamais par egalite d'adresses.
 */
export const memberProfileAccount = pgTable(
  'member_profile_account',
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
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, {onDelete: 'cascade'}),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('member_profile_account_profile_user_idx').on(
      table.memberProfileId,
      table.userId
    ),
    index('member_profile_account_organization_user_idx').on(
      table.organizationId,
      table.userId
    ),
  ]
)

export type MemberProfileAccountModel = typeof memberProfileAccount.$inferSelect
export type AddMemberProfileAccountModel =
  typeof memberProfileAccount.$inferInsert
