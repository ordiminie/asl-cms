import 'server-only'

import {
  listInvoicesByProfileIdsDao,
  MemberInvoiceRow,
} from '@/db/repositories/member-invoice-repository'
import {withTenant} from '@/db/tenant-scope'

import {BILLING_PROVIDER_MANUAL} from '../types/domain/association-settings-types'
import type {MemberInvoice} from '../types/domain/member-invoice-types'
import type {MemberBillingProvider} from './member-billing-provider'

/**
 * Une ligne de la base, reduite au domaine : ni horodatage ni identifiant
 * externe. Le lien de paiement n'est pas une colonne : chaque fournisseur le
 * renseigne lui-meme (ADR 063 §1).
 */
export const toMemberInvoice = (
  row: MemberInvoiceRow
): Omit<MemberInvoice, 'paymentUrl'> => ({
  id: row.id,
  memberProfileId: row.memberProfileId,
  parcelId: row.parcelId,
  parcelNumber: row.parcelNumber,
  meterNumber: row.meterNumber,
  source: row.source,
  year: row.year,
  issuedOn: row.issuedOn,
  dueOn: row.dueOn,
  amountCents: row.amountCents,
  status: row.status,
  hasPdf: row.hasPdf,
})

/**
 * Implementation « manuel » (s19) : les factures saisies par le bureau, lues
 * dans `member_invoice` sous le scope du tenant. Aucun lien de paiement : une
 * facture saisie a la main se regle par virement (s21, critere 2).
 */
export const manualMemberBillingProvider: MemberBillingProvider = {
  id: BILLING_PROVIDER_MANUAL,
  canWrite: true,
  listInvoicesOf: async (organizationId, memberProfileIds) =>
    withTenant(organizationId, async () =>
      (await listInvoicesByProfileIdsDao(memberProfileIds)).map((row) => ({
        ...toMemberInvoice(row),
        paymentUrl: null,
      }))
    ),
}
