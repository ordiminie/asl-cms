import {sql} from 'drizzle-orm'
import {pgTable, timestamp, uniqueIndex, uuid} from 'drizzle-orm/pg-core'

import {organization, user} from './auth-model'

/**
 * Traces d'invitation et de premiere connexion d'un compte sur une
 * association (s42a). Une ligne par (association, compte) : un meme compte
 * membre de deux associations a deux lignes, jamais une trace globale.
 *
 * - `last_invited_at` : le dernier envoi d'invitation **parti** (jamais un
 *   envoi reporte, ecrit au depart reel).
 * - `first_signed_in_at` : la premiere connexion reussie sur cette
 *   association, hors connexion a la place du membre (s48) ; ecrite une seule
 *   fois.
 *
 * Table metier : RLS forcee, policy `tenant_isolation` sur sa propre colonne
 * `organization_id` (ADR 002). `ON DELETE CASCADE` des deux cotes.
 */
export const memberInvitationState = pgTable(
  'member_invitation_state',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, {onDelete: 'cascade'}),
    lastInvitedAt: timestamp('last_invited_at', {withTimezone: true}),
    firstSignedInAt: timestamp('first_signed_in_at', {withTimezone: true}),
  },
  (table) => [
    uniqueIndex('member_invitation_state_organization_user_idx').on(
      table.organizationId,
      table.userId
    ),
  ]
)

export type MemberInvitationStateModel =
  typeof memberInvitationState.$inferSelect
