import {sql} from 'drizzle-orm'
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization, user} from './auth-model'

export const impersonationEventKindEnum = pgEnum('impersonation_event_kind', [
  'opened',
  'closed',
])

/**
 * Trace des sessions ouvertes par le SuperAdmin a la place d'un compte (s48,
 * ADR 041). Table metier : RLS forcee, policy `tenant_isolation` (ADR 002).
 * Stockee, sans ecran ; s38 l'exportera ou la declarera exclue.
 *
 * - Une ligne par evenement : `opened` a l'ouverture, `closed` a la sortie
 *   explicite. L'expiration et la deconnexion ne sont pas tracees (ADR 041).
 * - `session_id` copie l'id de la session imitee, pour relier les deux lignes ;
 *   sans cle etrangere, la session etant supprimee a la sortie.
 * - Le SuperAdmin et le compte vise sont designes par cle (`SET NULL`) **et**
 *   par leur nom copie : l'historique survit a la suppression d'un compte.
 *   Jamais l'email comme identite.
 * - `reason` : motif facultatif saisi a l'ouverture (200 caracteres).
 */
export const impersonationEvent = pgTable(
  'impersonation_event',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    kind: impersonationEventKindEnum('kind').notNull(),
    adminUserId: uuid('admin_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    adminName: text('admin_name'),
    targetUserId: uuid('target_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    targetName: text('target_name'),
    sessionId: text('session_id'),
    reason: text('reason'),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('impersonation_event_organization_created_at_idx').on(
      table.organizationId,
      table.createdAt
    ),
  ]
)

export type ImpersonationEventModel = typeof impersonationEvent.$inferSelect
export type AddImpersonationEventModel = typeof impersonationEvent.$inferInsert
export type ImpersonationEventKindModel =
  (typeof impersonationEventKindEnum.enumValues)[number]
