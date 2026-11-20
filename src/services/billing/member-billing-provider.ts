import type {MemberInvoice} from '../types/domain/member-invoice-types'

/**
 * Contrat d'un fournisseur de factures des membres (ADR 011, ADR 059 §7).
 * Un contrat de **lecture** : l'ecriture manuelle vit dans
 * `member-invoice-service`, gardee par `canWrite`. Fonctionnel, sans classe :
 * s20 livre une seconde implementation sans toucher la presentation.
 *
 * Aucun moyen de paiement dans le contrat : `paymentUrl` (s21, ADR 063) est
 * un lien sortant, renseigne explicitement par chaque implementation,
 * facture par facture — jamais une constante ni un reglage.
 */
export type MemberBillingProvider = {
  /** Valeur du reglage `billing.provider` qui designe cette implementation. */
  readonly id: string
  /** Le bureau peut-il saisir et corriger des factures sur le site ? */
  readonly canWrite: boolean
  /**
   * Les factures des fiches donnees, dans l'association donnee. Le tri et
   * la presentation sont l'affaire de l'appelant.
   */
  listInvoicesOf: (
    organizationId: string,
    memberProfileIds: readonly string[]
  ) => Promise<MemberInvoice[]>
}
