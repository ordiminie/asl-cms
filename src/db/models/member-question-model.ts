import {sql} from 'drizzle-orm'
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import {associationCategory} from './association-category-model'
import {organization} from './auth-model'
import {memberProfile} from './member-profile-model'

/**
 * Question posee par un membre connecte au bureau (s23). Table metier : RLS
 * forcee, policy `tenant_isolation` (ADR 002).
 *
 * - `member_id` designe la **fiche** du membre (`member_profile`, ADR 049),
 *   resolue par la session, jamais l'email. L'identite n'est pas copiee : le
 *   bureau la lit par jointure (une seule source). `ON DELETE RESTRICT`.
 * - `category_id` est obligatoire (un sujet du domaine `question`, ADR 028) ;
 *   `ON DELETE RESTRICT` : la suppression d'un sujet est logique, les
 *   questions recues gardent son nom (critere 5).
 * - `notification_failed` : temoin pose quand l'email au bureau n'est pas parti.
 */
export const memberQuestion = pgTable(
  'member_question',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    memberId: uuid('member_id')
      .notNull()
      .references(() => memberProfile.id, {onDelete: 'restrict'}),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => associationCategory.id, {onDelete: 'restrict'}),
    body: text('body').notNull(),
    notificationFailed: boolean('notification_failed').default(false).notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('member_question_organization_created_idx').on(
      table.organizationId,
      table.createdAt.desc()
    ),
  ]
)

export type MemberQuestionModel = typeof memberQuestion.$inferSelect
export type AddMemberQuestionModel = typeof memberQuestion.$inferInsert
