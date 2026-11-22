import {sql} from 'drizzle-orm'
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization, user} from './auth-model'
import {memberProfile} from './member-profile-model'
import {recipientGroup} from './recipient-group-model'

export const campaignStatusEnum = pgEnum('campaign_status', [
  'sending',
  'sent',
  'interrupted',
])

/**
 * La nature d'un envoi (s27b, ADR 064), figee a la creation de la campagne :
 * reclasser un modele vaut pour la campagne suivante, jamais pour une campagne
 * en cours. Les valeurs suivent `CAMPAIGN_NATURES` du domaine.
 */
export const campaignNatureEnum = pgEnum('campaign_nature', [
  'facultative',
  'statutaire',
])

export const campaignRecipientStatusEnum = pgEnum('campaign_recipient_status', [
  'pending',
  'sent',
  'failed',
  'sending',
  'to_verify',
  'unsubscribed',
])

export const campaignPartStatusEnum = pgEnum('campaign_part_status', [
  'scheduled',
  'sending',
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
    /**
     * Nature figee a l'envoi (s27b, ADR 064) : commande la livraison et le
     * pied de page. `facultative` pour les campagnes anterieures.
     */
    nature: campaignNatureEnum('nature').default('facultative').notNull(),
    targetKind: text('target_kind').notNull(),
    /**
     * Groupe vise (s27, ADR 060 §5), `SET NULL` : supprimer le groupe ne
     * touche pas l'archive, qui garde son nom copie a l'envoi.
     */
    targetGroupId: uuid('target_group_id').references(() => recipientGroup.id, {
      onDelete: 'set null',
    }),
    targetGroupName: text('target_group_name'),
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
    /**
     * Statistiques de campagne (s30, ADR 068) : `stats_tracked` dit que chaque
     * email porte le tag fournisseur de la campagne (`false` pour les
     * campagnes anterieures, jamais agregees). Le releve conserve
     * (`stats_unique_*`, `stats_read_at`) n'est ecrit qu'a la consolidation de
     * l'agregat Brevo : restitution, pas mesure. Sous la RLS de `campaign`.
     */
    statsTracked: boolean('stats_tracked').default(false).notNull(),
    statsUniqueOpens: integer('stats_unique_opens'),
    statsUniqueClicks: integer('stats_unique_clicks'),
    statsReadAt: timestamp('stats_read_at', {withTimezone: true}),
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
 * Une part quotidienne d'une campagne (s26, ADR 052) : un jour de Paris, le
 * nombre de destinataires qui le recoivent, son etat. Table metier : RLS
 * forcee, policy `tenant_isolation`. Une tache `campaign.deliver_part` la
 * livre ; l'etat visible du bureau se lit ici, jamais dans le jsonb de la
 * tache.
 *
 * s52 (revue, n° 1) : une part entamee dont le budget du jour reporte le
 * reste garde son jour ; `deferred_to` dit le jour ou part ce reste et
 * `deferred_count` combien de destinataires il compte. Le plan d'envoi
 * compte ce reste ce jour-la, sous le plafond des campagnes.
 */
export const campaignPart = pgTable(
  'campaign_part',
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
    number: integer('number').notNull(),
    scheduledFor: date('scheduled_for', {mode: 'string'}).notNull(),
    recipientCount: integer('recipient_count').notNull(),
    status: campaignPartStatusEnum('status').default('scheduled').notNull(),
    finishedAt: timestamp('finished_at', {withTimezone: true}),
    /** Jour de Paris ou part le reste reporte faute de budget, ou rien. */
    deferredTo: date('deferred_to', {mode: 'string'}),
    /** Destinataires du reste reporte, figes au report. */
    deferredCount: integer('deferred_count'),
  },
  (table) => [
    unique('campaign_part_campaign_number_unique').on(
      table.campaignId,
      table.number
    ),
    index('campaign_part_organization_day_idx').on(
      table.organizationId,
      table.scheduledFor
    ),
  ]
)

/**
 * Une ligne d'envoi par destinataire, creee **avant** le premier email
 * (ADR 051) : point d'interception de s26, source des statistiques de s30.
 * `member_profile_id` en SET NULL : l'archive survit a la suppression d'une
 * fiche. Le jeton de desinscription (32 octets aleatoires) n'est jamais une
 * identite en clair.
 *
 * s26 (ADR 052) : chaque ligne appartient a une part (`part_id`). Elle passe
 * `pending -> sending` **avant** l'envoi, puis `sent` ; un arret ou un echec
 * incertain la laisse `to_verify`, jamais renvoyee. Une fiche desinscrite
 * entre deux parts passe `unsubscribed`.
 *
 * s54 (ADR 057) : une ligne par **adresse** (`email`, unique sans casse par
 * campagne) ; le refus est porte par l'adresse de fiche
 * (`member_profile_email.unsubscribed_at`), `member_unsubscribe` est retiree.
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
    /**
     * L'adresse visee (s54, ADR 057), ecrite a la creation de la cible : une
     * fiche porte plusieurs adresses, la ligne dit a laquelle elle s'adresse.
     */
    email: text('email').notNull(),
    partId: uuid('part_id')
      .notNull()
      .references(() => campaignPart.id, {onDelete: 'cascade'}),
    status: campaignRecipientStatusEnum('status').default('pending').notNull(),
    unsubscribeToken: text('unsubscribe_token').notNull(),
    sentAt: timestamp('sent_at', {withTimezone: true}),
    /** Instant du passage `pending -> sending`, juste avant l'envoi. */
    claimedAt: timestamp('claimed_at', {withTimezone: true}),
  },
  (table) => [
    uniqueIndex('campaign_recipient_campaign_email_idx').on(
      table.campaignId,
      sql`lower(${table.email})`
    ),
    unique('campaign_recipient_organization_token_unique').on(
      table.organizationId,
      table.unsubscribeToken
    ),
    index('campaign_recipient_campaign_status_idx').on(
      table.campaignId,
      table.status
    ),
    index('campaign_recipient_part_status_idx').on(table.partId, table.status),
  ]
)

/**
 * Les fiches **ciblees** que represente l'adresse d'un destinataire, figees a
 * la creation de la campagne (s27, ADR 061) : la livraison ne cite qu'elles
 * dans `{nom}` et `{parcelle}`. Porte son propre `organization_id` (RLS
 * forcee, sans jointure). Disparait avec la ligne d'envoi comme avec la fiche.
 */
export const campaignRecipientProfile = pgTable(
  'campaign_recipient_profile',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    campaignRecipientId: uuid('campaign_recipient_id')
      .notNull()
      .references(() => campaignRecipient.id, {onDelete: 'cascade'}),
    memberProfileId: uuid('member_profile_id')
      .notNull()
      .references(() => memberProfile.id, {onDelete: 'cascade'}),
  },
  (table) => [
    primaryKey({
      columns: [table.campaignRecipientId, table.memberProfileId],
    }),
  ]
)

/**
 * Les fiches **ciblees sans adresse active**, figees a la creation de la
 * campagne dans la meme transaction que ses destinataires (s28, ADR 065) : le
 * courrier postal ne se genere que depuis cet ensemble. Porte son propre
 * `organization_id` (RLS forcee, sans jointure). Disparait avec la campagne
 * comme avec la fiche.
 */
export const campaignLetterProfile = pgTable(
  'campaign_letter_profile',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaign.id, {onDelete: 'cascade'}),
    memberProfileId: uuid('member_profile_id')
      .notNull()
      .references(() => memberProfile.id, {onDelete: 'cascade'}),
  },
  (table) => [primaryKey({columns: [table.campaignId, table.memberProfileId]})]
)

export type CampaignModel = typeof campaign.$inferSelect
export type AddCampaignModel = typeof campaign.$inferInsert
export type CampaignRecipientModel = typeof campaignRecipient.$inferSelect
export type AddCampaignRecipientModel = typeof campaignRecipient.$inferInsert
export type CampaignPartModel = typeof campaignPart.$inferSelect
export type AddCampaignPartModel = typeof campaignPart.$inferInsert
export type CampaignPartStatusModel =
  (typeof campaignPartStatusEnum.enumValues)[number]
export type CampaignNatureModel = (typeof campaignNatureEnum.enumValues)[number]
export type CampaignStatusModel = (typeof campaignStatusEnum.enumValues)[number]
export type CampaignRecipientStatusModel =
  (typeof campaignRecipientStatusEnum.enumValues)[number]
