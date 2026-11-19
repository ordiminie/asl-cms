import {jsonb, pgTable, text, timestamp, uuid} from 'drizzle-orm/pg-core'

import {organization} from './auth-model'

/** Factures comptees par une synchronisation : ecrites, et ecartees par motif. */
export type BillingSyncCountsModel = Record<string, number>

/** Un client Pennylane sans fiche (critere 3) : ce que le bureau en lit. */
export type BillingSyncUnmatchedCustomerModel = {
  id: string
  name: string
  reference: string | null
}

/**
 * Un ecart de terrain (ADR 062 §4) : ce que dit la facture, et la fiche a
 * laquelle elle est rattachee. Jamais le texte libre entier.
 */
export type BillingSyncTerrainMismatchModel = {
  invoiceNumber: string
  memberProfileId: string
  memberProfileName: string
  parcels: string[]
  meter: string | null
}

/**
 * Etat de la synchronisation des factures d'une association (s20, ADR 062
 * §7) : une ligne par association. Table metier : RLS forcee, policy
 * `tenant_isolation` (ADR 002).
 *
 * - `last_error` : code d'echec (`missing_key`, `unauthorized`,
 *   `unavailable`, `rate_limited`), nul apres un succes.
 * - Aucune adresse de PDF, aucun moyen de paiement.
 */
export const billingSyncState = pgTable('billing_sync_state', {
  organizationId: uuid('organization_id')
    .primaryKey()
    .references(() => organization.id, {onDelete: 'cascade'}),
  lastAttemptAt: timestamp('last_attempt_at', {withTimezone: true}),
  lastSuccessAt: timestamp('last_success_at', {withTimezone: true}),
  lastError: text('last_error'),
  counts: jsonb('counts').$type<BillingSyncCountsModel>().default({}).notNull(),
  unmatchedCustomers: jsonb('unmatched_customers')
    .$type<BillingSyncUnmatchedCustomerModel[]>()
    .default([])
    .notNull(),
  terrainMismatches: jsonb('terrain_mismatches')
    .$type<BillingSyncTerrainMismatchModel[]>()
    .default([])
    .notNull(),
  createdAt: timestamp('created_at', {withTimezone: true})
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', {withTimezone: true})
    .defaultNow()
    .notNull(),
})

export type BillingSyncStateModel = typeof billingSyncState.$inferSelect
export type AddBillingSyncStateModel = typeof billingSyncState.$inferInsert
