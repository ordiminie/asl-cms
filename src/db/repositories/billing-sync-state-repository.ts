import {eq, sql} from 'drizzle-orm'

import {
  type BillingSyncCountsModel,
  billingSyncState,
  BillingSyncStateModel,
  type BillingSyncTerrainMismatchModel,
  type BillingSyncUnmatchedCustomerModel,
} from '@/db/models/billing-sync-state-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Etat de la synchronisation Pennylane des factures (s20, ADR 062 §7). Sous
 * RLS forcee : hors `withTenant(organizationId, ...)`, rien ne sort et rien
 * ne s'ecrit. Une ligne par association, posee a la premiere tentative.
 */

export type BillingSyncSuccessWrite = {
  now: Date
  counts: BillingSyncCountsModel
  unmatchedCustomers: BillingSyncUnmatchedCustomerModel[]
  terrainMismatches: BillingSyncTerrainMismatchModel[]
}

export const getBillingSyncStateDao = async (
  organizationId: string
): Promise<BillingSyncStateModel | undefined> => {
  const [row] = await getDb()
    .select()
    .from(billingSyncState)
    .where(eq(billingSyncState.organizationId, organizationId))
  return row
}

/**
 * Note une tentative echouee et son motif. Le dernier succes, les comptes et
 * les listes restent ceux de la derniere relecture reussie.
 */
export const recordBillingSyncFailureDao = async (
  organizationId: string,
  now: Date,
  error: string
): Promise<void> => {
  await getDb()
    .insert(billingSyncState)
    .values({organizationId, lastAttemptAt: now, lastError: error})
    .onConflictDoUpdate({
      target: billingSyncState.organizationId,
      set: {lastAttemptAt: now, lastError: error, updatedAt: sql`now()`},
    })
}

/** Note une relecture complete et reussie : tout est remplace. */
export const recordBillingSyncSuccessDao = async (
  organizationId: string,
  write: BillingSyncSuccessWrite
): Promise<void> => {
  const values = {
    lastAttemptAt: write.now,
    lastSuccessAt: write.now,
    lastError: null,
    counts: write.counts,
    unmatchedCustomers: write.unmatchedCustomers,
    terrainMismatches: write.terrainMismatches,
  }
  await getDb()
    .insert(billingSyncState)
    .values({organizationId, ...values})
    .onConflictDoUpdate({
      target: billingSyncState.organizationId,
      set: {...values, updatedAt: sql`now()`},
    })
}
