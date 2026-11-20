/**
 * Types de domaine des factures des membres (s19, ADR 059). Ecrits sans
 * importer le modele Drizzle (`rule-architecture`).
 *
 * **Aucun moyen de paiement** : le produit ne fait transiter aucune donnee
 * bancaire. Le paiement (s21, ADR 063) est un lien sortant, donne par le
 * fournisseur facture par facture : un lien, jamais un moyen de paiement.
 */

/**
 * Classe d'un statut de facture (ADR 059 §4) : seul `unpaid` est impaye ;
 * `unclassified` n'est ni regle ni impaye, hors de toute relance.
 */
export type InvoiceStatusClass = 'unpaid' | 'settled' | 'unclassified'

/** D'ou vient une facture : saisie par le bureau, ou ecrite par Pennylane (s20). */
export type MemberInvoiceSource = 'site' | 'pennylane'

export const MemberInvoiceSourceConst = {
  SITE: 'site',
  PENNYLANE: 'pennylane',
} as const satisfies Record<string, MemberInvoiceSource>

/**
 * Une facture telle qu'un fournisseur la rend. `status` est **opaque**, tel
 * que la source le fournit ; dates ISO `YYYY-MM-DD` ; montant en centimes.
 */
export type MemberInvoice = {
  id: string
  /** La fiche facturee : la seule cle de rattachement. */
  memberProfileId: string
  /**
   * Le terrain facture, descriptif. Nul pour une facture Pennylane : son
   * terrain est celui de la fiche a la date d'emission (ADR 062 §4).
   */
  parcelId: string | null
  parcelNumber: string | null
  meterNumber: string | null
  source: MemberInvoiceSource
  year: number
  issuedOn: string
  dueOn: string
  amountCents: number
  status: string
  /** La source fournit un PDF (s20, ADR 062 §6) ; jamais son adresse. */
  hasPdf: boolean
  /**
   * Le lien de paiement de la facture, tel que le fournisseur le donne
   * (s21, ADR 063) ; nul sans lien. Non garde : le service le filtre.
   */
  paymentUrl: string | null
}

/** Bornes de l'annee d'une facture : un garde-fou de saisie, pas un parametre. */
export const MEMBER_INVOICE_YEAR_MIN = 2000
export const MEMBER_INVOICE_YEAR_MAX = 2100
/** Plafond d'un statut saisi. */
export const MEMBER_INVOICE_STATUS_MAX_LENGTH = 200

/** Ce que le bureau saisit d'une facture ; la source est toujours `site`. */
export type MemberInvoiceFields = {
  parcelId: string
  year: number
  issuedOn: string
  dueOn: string
  amountCents: number
  status: string
}

export type CreateMemberInvoiceInput = MemberInvoiceFields & {
  organizationId: string
  memberProfileId: string
}

export type UpdateMemberInvoiceInput = MemberInvoiceFields & {
  organizationId: string
  invoiceId: string
}

/** Refus metier d'une saisie : rien n'est ecrit. */
export type MemberInvoiceWriteRefusal =
  /** La fiche n'est pas proprietaire de la parcelle a la date d'emission. */
  | {status: 'parcel_not_owned'}
  /** Le statut n'est dans aucune des deux listes du tenant (ADR 059 §8). */
  | {status: 'unknown_status'}

export type CreateMemberInvoiceResult =
  {status: 'saved'; invoiceId: string} | MemberInvoiceWriteRefusal

export type UpdateMemberInvoiceResult =
  {status: 'saved'} | {status: 'not_found'} | MemberInvoiceWriteRefusal

/**
 * Une facture dans le back-office : sa source et son objet compose. Sans le
 * lien de paiement, qui ne sert qu'au membre (ADR 063 §4).
 */
export type BoardInvoiceDTO = Omit<MemberInvoice, 'paymentUrl'> & {
  subject: string
  statusClass: InvoiceStatusClass
}

/** La carte « Factures » d'une fiche : ses factures, et si le site saisit. */
export type BoardMemberInvoicesDTO = {
  canWrite: boolean
  /** Les factures viennent de Pennylane (s20) : lecture seule, mise a jour. */
  syncedFromPennylane: boolean
  /** Derniere synchronisation reussie (ISO) ; nulle sans elle. */
  syncedAt: string | null
  invoices: BoardInvoiceDTO[]
}
