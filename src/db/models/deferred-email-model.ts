import {sql} from 'drizzle-orm'
import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization} from './auth-model'

/**
 * Email reporte faute de budget du jour (s52, ADR 053 §4). Le message est
 * conserve **deja rendu** (objet, texte, HTML, en-tetes) jusqu'a son rejeu par
 * la tache `email.deliver_deferred` ; la ligne est **supprimee** une fois
 * partie (critere 7). `to_verify` : arret entre l'envoi et son
 * enregistrement, jamais renvoye (ADR 052). `failed` : refuse par le
 * fournisseur a chaque tentative (`campaign.send_max_attempts`), jamais
 * renvoye ; l'adresse et le contenu sont effaces, seuls la nature, la
 * reference et le jour restent pour le bureau.
 *
 * Donnees personnelles : jamais lues hors du rejeu, jamais journalisees ; la
 * vue du bureau ne lit que la nature, la reference et le jour d'envoi.
 *
 * Table metier : RLS forcee, policy `tenant_isolation` (ADR 002).
 */
export const deferredEmail = pgTable(
  'deferred_email',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    nature: text('nature').notNull(),
    recipient: text('recipient').notNull(),
    subject: text('subject').notNull(),
    textBody: text('text_body').notNull(),
    htmlBody: text('html_body'),
    headers: jsonb('headers').$type<Record<string, string>>(),
    replyTo: text('reply_to'),
    senderName: text('sender_name'),
    /** Jour de Paris ou l'email doit partir. */
    sendOn: date('send_on', {mode: 'string'}).notNull(),
    status: text('status', {
      enum: ['pending', 'sending', 'to_verify', 'failed'],
    })
      .default('pending')
      .notNull(),
    attempts: integer('attempts').default(0).notNull(),
    /** Reference d'affichage : type et id de l'objet, jamais son contenu. */
    referenceType: text('reference_type'),
    referenceId: uuid('reference_id'),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('deferred_email_organization_status_idx').on(
      table.organizationId,
      table.status
    ),
  ]
)

export type DeferredEmailModel = typeof deferredEmail.$inferSelect
export type AddDeferredEmailModel = typeof deferredEmail.$inferInsert
