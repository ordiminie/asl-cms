import {sql} from 'drizzle-orm'
import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization, user} from './auth-model'
import {memberProfile} from './member-profile-model'

export const campaignStatusEnum = pgEnum('campaign_status', [
  'sending',
  'sent',
  'interrupted',
])

export const campaignRecipientStatusEnum = pgEnum('campaign_recipient_status', [
  'pending',
  'sent',
  'failed',
])

/**
 * Archive d'une campagne email (s25, ADR 051). Table metier : RLS forcee,
 * policy `tenant_isolation` (ADR 002).
 *
 * - Corps Markdown **tel qu'ecrit** (variables non remplacees).
 * - Decomptes figes a l'envoi ; `sent_count` avance a chaque email parti.
 * - `submission_id` unique par association : un double clic retrouve la
 *   campagne existante au lieu d'en creer une seconde.
 * - Auteur par copie (`author_*`, `on_behalf_of_*` pendant une imitation).
 */
export const campaign = pgTable(
  'campaign',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    submissionId: uuid('submission_id').notNull(),
    subject: text('subject').notNull(),
    preheader: text('preheader'),
    bodyMarkdown: text('body_markdown').notNull(),
    templateId: text('template_id'),
    targetKind: text('target_kind').notNull(),
    recipientCount: integer('recipient_count').notNull(),
    withoutEmailCount: integer('without_email_count').notNull(),
    unsubscribedCount: integer('unsubscribed_count').notNull(),
    sentCount: integer('sent_count').default(0).notNull(),
    status: campaignStatusEnum('status').notNull(),
    sendDate: date('send_date', {mode: 'string'}).notNull(),
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
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
    finishedAt: timestamp('finished_at', {withTimezone: true}),
  },
  (table) => [
    unique('campaign_organization_submission_unique').on(
      table.organizationId,
      table.submissionId
    ),
    index('campaign_organization_created_idx').on(
      table.organizationId,
      table.createdAt.desc()
    ),
  ]
)

/**
 * Une ligne d'envoi par destinataire, creee **avant** le premier email
 * (ADR 051) : point d'interception de s26, source des statistiques de s30.
 * `member_profile_id` en SET NULL : l'archive survit a la suppression d'une
 * fiche. Le jeton de desinscription (32 octets aleatoires) n'est jamais une
 * identite en clair.
 */
export const campaignRecipient = pgTable(
  'campaign_recipient',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaign.id, {onDelete: 'cascade'}),
    memberProfileId: uuid('member_profile_id').references(
      () => memberProfile.id,
      {onDelete: 'set null'}
    ),
    status: campaignRecipientStatusEnum('status').default('pending').notNull(),
    unsubscribeToken: text('unsubscribe_token').notNull(),
    sentAt: timestamp('sent_at', {withTimezone: true}),
  },
  (table) => [
    unique('campaign_recipient_campaign_member_unique').on(
      table.campaignId,
      table.memberProfileId
    ),
    unique('campaign_recipient_organization_token_unique').on(
      table.organizationId,
      table.unsubscribeToken
    ),
    index('campaign_recipient_campaign_status_idx').on(
      table.campaignId,
      table.status
    ),
  ]
)

/**
 * Le refus d'une fiche de recevoir les campagnes (ADR 051). Porte par la
 * fiche, jamais par l'adresse. Aucune levee en V1.
 */
export const memberUnsubscribe = pgTable(
  'member_unsubscribe',
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
    campaignId: uuid('campaign_id').references(() => campaign.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('member_unsubscribe_organization_member_unique').on(
      table.organizationId,
      table.memberProfileId
    ),
  ]
)

export type CampaignModel = typeof campaign.$inferSelect
export type AddCampaignModel = typeof campaign.$inferInsert
export type CampaignRecipientModel = typeof campaignRecipient.$inferSelect
export type AddCampaignRecipientModel = typeof campaignRecipient.$inferInsert
export type MemberUnsubscribeModel = typeof memberUnsubscribe.$inferSelect
export type CampaignStatusModel = (typeof campaignStatusEnum.enumValues)[number]
export type CampaignRecipientStatusModel =
  (typeof campaignRecipientStatusEnum.enumValues)[number]
