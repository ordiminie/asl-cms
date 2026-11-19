import 'server-only'

import {listInvoicesByProfileIdsDao} from '@/db/repositories/member-invoice-repository'
import {withTenant} from '@/db/tenant-scope'

import {BILLING_PROVIDER_PENNYLANE} from '../types/domain/association-settings-types'
import {toMemberInvoice} from './manual-member-billing-provider'
import type {MemberBillingProvider} from './member-billing-provider'

/**
 * Implementation « Pennylane » (s20, ADR 062 §1) : les factures que la
 * synchronisation planifiee a ecrites dans `member_invoice`, lues sous le
 * scope du tenant. **Aucun appel reseau a l'affichage** (critere 9) : une API
 * indisponible laisse les dernieres donnees connues. Le bureau ne saisit plus
 * (`canWrite: false`) ; les factures `site` deja saisies restent lues.
 */
export const pennylaneMemberBillingProvider: MemberBillingProvider = {
  id: BILLING_PROVIDER_PENNYLANE,
  canWrite: false,
  listInvoicesOf: async (organizationId, memberProfileIds) =>
    withTenant(organizationId, async () =>
      (await listInvoicesByProfileIdsDao(memberProfileIds)).map(toMemberInvoice)
    ),
}
