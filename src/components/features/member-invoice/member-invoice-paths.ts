import {memberProfilePathOf} from '@/components/features/member-profile/member-profile-paths'

/** Chemins des factures d'une fiche dans le back-office (s19). */
export const newMemberInvoicePathOf = (memberProfileId: string): string =>
  `${memberProfilePathOf(memberProfileId)}/factures/nouvelle`

export const memberInvoicePathOf = (
  memberProfileId: string,
  invoiceId: string
): string => `${memberProfilePathOf(memberProfileId)}/factures/${invoiceId}`

/** Valeur de `?facture=` au retour d'un enregistrement (3c). */
export const INVOICE_SAVED = 'enregistree'

/** La fiche, avec le temoin de la facture qui vient d'etre enregistree. */
export const savedInvoicePathOf = (memberProfileId: string): string =>
  `${memberProfilePathOf(memberProfileId)}?facture=${INVOICE_SAVED}`
