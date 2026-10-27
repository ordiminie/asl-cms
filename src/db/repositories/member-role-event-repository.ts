import {
  AddMemberRoleEventModel,
  memberRoleEvent,
} from '@/db/models/member-role-event-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Ecrit une ligne de la trace des roles (s14, ADR 039). Table sous RLS
 * forcee : l'appelant est dans `withTenant`, sinon l'ecriture est refusee.
 */
export const insertMemberRoleEventDao = async (
  row: AddMemberRoleEventModel
): Promise<void> => {
  await getDb().insert(memberRoleEvent).values(row)
}
