import {sql} from 'drizzle-orm'
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization} from './auth-model'
import {memberProfile} from './member-profile-model'
import {parcel} from './parcel-model'

/**
 * Source d'une facture (s19, ADR 059 §1) : ensemble ferme du produit, pas un
 * statut de fournisseur. `site` = saisie par le bureau ; `pennylane` = ecrite
 * par la synchronisation (s20), lecture seule.
 */
export const memberInvoiceSourceEnum = pgEnum('member_invoice_source', [
  'site',
  'pennylane',
])

/**
 * Facture d'un membre (s19, ADR 059 §1). Table metier : RLS forcee, policy
 * `tenant_isolation` (ADR 002).
 *
 * - `member_profile_id` est la **cle de rattachement** : seule la fiche
 *   facturee voit la facture ; une vente ne la deplace pas. `RESTRICT`.
 * - `parcel_id` est **descriptif** (le terrain facture), verifie a l'ecriture
 *   par la lecture datee de la propriete ; jamais une cle de visibilite.
 * - `status` est un texte **opaque**, sans contrainte de valeurs (ADR 011).
 * - `amount_cents` : centimes entiers, euro implicite (ADR 059 §2).
 * - Aucun champ de paiement.
 */
export const memberInvoice = pgTable(
  'member_invoice',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    memberProfileId: uuid('member_profile_id')
      .notNull()
      .references(() => memberProfile.id, {onDelete: 'restrict'}),
    parcelId: uuid('parcel_id')
      .notNull()
      .references(() => parcel.id, {onDelete: 'restrict'}),
    source: memberInvoiceSourceEnum('source').notNull(),
    externalId: text('external_id'),
    year: integer('year').notNull(),
    issuedOn: date('issued_on', {mode: 'string'}).notNull(),
    dueOn: date('due_on', {mode: 'string'}).notNull(),
    amountCents: integer('amount_cents').notNull(),
    status: text('status').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('member_invoice_member_profile_idx').on(
      table.memberProfileId,
      table.issuedOn.desc()
    ),
    uniqueIndex('member_invoice_organization_external_id_idx')
      .on(table.organizationId, table.externalId)
      .where(sql`${table.externalId} is not null`),
    check(
      'member_invoice_amount_positive_check',
      sql`${table.amountCents} > 0`
    ),
    check(
      'member_invoice_due_on_check',
      sql`${table.dueOn} >= ${table.issuedOn}`
    ),
  ]
)

/**
 * Statut de facture deja signale au bureau (s19, ADR 059 §5) : une ligne par
 * statut « a classer » et par association, posee quand l'email est parti.
 * Table metier : RLS forcee, policy `tenant_isolation`.
 */
export const invoiceStatusAlert = pgTable(
  'invoice_status_alert',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    status: text('status').notNull(),
    notifiedAt: timestamp('notified_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('invoice_status_alert_organization_status_unique').on(
      table.organizationId,
      table.status
    ),
  ]
)

export type MemberInvoiceModel = typeof memberInvoice.$inferSelect
export type AddMemberInvoiceModel = typeof memberInvoice.$inferInsert
export type InvoiceStatusAlertModel = typeof invoiceStatusAlert.$inferSelect
