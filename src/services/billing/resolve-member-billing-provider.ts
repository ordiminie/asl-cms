import 'server-only'

import {
  BILLING_PROVIDER_SETTING_KEY,
  ResolvedAssociationSettings,
} from '../types/domain/association-settings-types'
import {manualMemberBillingProvider} from './manual-member-billing-provider'
import type {MemberBillingProvider} from './member-billing-provider'

const PROVIDERS: readonly MemberBillingProvider[] = [
  manualMemberBillingProvider,
]

/**
 * Le fournisseur de factures de l'association, choisi par le reglage
 * `billing.provider` (ADR 011 : jamais par variable d'environnement).
 * Defaut ferme : une valeur sans implementation est une erreur explicite,
 * jamais un repli silencieux.
 */
export const resolveMemberBillingProvider = (
  settings: ResolvedAssociationSettings
): MemberBillingProvider => {
  const value = settings[BILLING_PROVIDER_SETTING_KEY]?.value
  const provider = PROVIDERS.find((candidate) => candidate.id === value)
  if (!provider) {
    throw new Error(
      `Fournisseur de factures sans implementation : ${String(value)}`
    )
  }
  return provider
}
