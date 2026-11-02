import {
  AddImpersonationEventModel,
  impersonationEvent,
} from '@/db/models/impersonation-event-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Ecrit une ligne de la trace des sessions a la place d'un compte (s48,
 * ADR 041). Table sous RLS forcee : l'appelant est dans `withTenant`, sinon
 * l'ecriture est refusee.
 */
export const insertImpersonationEventDao = async (
  row: AddImpersonationEventModel
): Promise<void> => {
  await getDb().insert(impersonationEvent).values(row)
}
