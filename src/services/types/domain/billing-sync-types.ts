/**
 * Types de domaine de la synchronisation des factures Pennylane (s20, ADR
 * 062). Ecrits sans importer le modele Drizzle (`rule-architecture`).
 * Aucune adresse de PDF, aucun moyen de paiement.
 */

/** Motif d'echec d'une synchronisation (ADR 062 §7). */
export type BillingSyncErrorCode =
  'missing_key' | 'unauthorized' | 'unavailable' | 'rate_limited'

/** Factures ecrites, et ecartees par motif (ADR 062 §3). */
export type BillingSyncCounts = {
  written: number
  draft: number
  creditNote: number
  noCustomer: number
  noDate: number
  notEur: number
  nonPositive: number
  unmatched: number
}

/** Ce que rend une synchronisation. */
export type PennylaneSyncResult =
  /** Le fournisseur de l'association n'est pas Pennylane : rien n'est fait. */
  | {status: 'skipped'}
  | {status: 'failed'; error: BillingSyncErrorCode}
  | {status: 'synced'; counts: BillingSyncCounts}

/** Un client Pennylane qui porte une facture sans fiche (critere 3). */
export type BillingSyncUnmatchedCustomer = {
  id: string
  name: string
  reference: string | null
}

/**
 * Un ecart de terrain (ADR 062 §4) : ce que la facture ecrit, et sa fiche.
 */
export type BillingSyncTerrainMismatch = {
  invoiceNumber: string
  memberProfileId: string
  memberProfileName: string
  parcels: string[]
  meter: string | null
}

/** La carte « Synchronisation Pennylane » des reglages (s20, ecran 3). */
export type BillingSyncOverviewDTO = {
  /** Derniere tentative (ISO) ; nulle sans tentative. */
  lastAttemptAt: string | null
  /** Derniere synchronisation reussie (ISO) ; nulle sans elle. */
  syncedAt: string | null
  /** Motif de la derniere tentative, si elle a echoue. */
  lastError: BillingSyncErrorCode | null
  /** Comptes de la derniere relecture reussie ; nuls sans elle. */
  counts: BillingSyncCounts | null
  unmatchedCustomers: BillingSyncUnmatchedCustomer[]
  terrainMismatches: BillingSyncTerrainMismatch[]
  /** Les fiches de l'association sans identifiant client (calculees). */
  profilesWithoutId: {id: string; name: string}[]
}

export const BILLING_SYNC_ERROR_CODES = [
  'missing_key',
  'unauthorized',
  'unavailable',
  'rate_limited',
] as const satisfies readonly BillingSyncErrorCode[]

/** Ce que rend « Mettre a jour maintenant » a l'ecran (s20, ecran 3). */
export type PennylaneSyncActionState = {
  status: 'synced' | 'failed' | 'error'
  message: string
}

export type PennylaneSyncAction = (
  prevState?: PennylaneSyncActionState,
  formData?: FormData
) => Promise<PennylaneSyncActionState>
