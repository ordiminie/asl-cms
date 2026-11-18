import {and, asc, eq, inArray, sql} from 'drizzle-orm'

import {memberProfile} from '@/db/models/member-profile-model'
import {
  recipientGroup,
  recipientGroupMember,
} from '@/db/models/recipient-group-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Groupes de destinataires et leurs appartenances (s27, ADR 060 §4). Sous RLS
 * forcee : hors `withTenant(organizationId, ...)`, rien ne sort et rien ne
 * s'ecrit. Les ecritures s'executent dans la transaction du scope de tenant.
 */

const NAME_INDEX = 'recipient_group_organization_name_idx'

/** Un groupe et son nombre de fiches. */
export type RecipientGroupRowModel = {
  id: string
  name: string
  profileCount: number
}

export type CreateRecipientGroupResult =
  {status: 'created'; row: RecipientGroupRowModel} | {status: 'duplicate_name'}

export type RenameRecipientGroupResult =
  | {status: 'updated'; row: RecipientGroupRowModel}
  | {status: 'not_found'}
  | {status: 'duplicate_name'}

/**
 * Violation de l'index unique des noms. Drizzle enveloppe l'erreur du pilote :
 * le code Postgres est sur l'erreur ou sur sa cause.
 */
const isDuplicateNameViolation = (error: unknown): boolean => {
  const candidates = [error, (error as {cause?: unknown})?.cause]
  return candidates.some((candidate) => {
    const pgError = candidate as {code?: string; constraint?: string}
    return pgError?.code === '23505' && pgError.constraint === NAME_INDEX
  })
}

const profileCountSql = sql<number>`(select count(*)::int from ${recipientGroupMember} where ${recipientGroupMember.groupId} = ${recipientGroup.id})`

const GROUP_ROW = {
  id: recipientGroup.id,
  name: recipientGroup.name,
  profileCount: profileCountSql,
}

/** Les groupes de l'association, par nom, avec leur nombre de fiches. */
export const listRecipientGroupsDao = async (
  organizationId: string
): Promise<RecipientGroupRowModel[]> =>
  getDb()
    .select(GROUP_ROW)
    .from(recipientGroup)
    .where(eq(recipientGroup.organizationId, organizationId))
    .orderBy(asc(sql`lower(${recipientGroup.name})`), asc(recipientGroup.id))

/** Un groupe par son identifiant ; un groupe d'une autre association est absent. */
export const getRecipientGroupByIdDao = async (
  groupId: string
): Promise<RecipientGroupRowModel | undefined> => {
  const [row] = await getDb()
    .select(GROUP_ROW)
    .from(recipientGroup)
    .where(eq(recipientGroup.id, groupId))
  return row
}

/** Cree un groupe ; un nom deja porte, sans casse, est refuse. */
export const createRecipientGroupTxnDao = async (input: {
  organizationId: string
  name: string
}): Promise<CreateRecipientGroupResult> => {
  try {
    return await getDb().transaction(async (tx) => {
      const [row] = await tx
        .insert(recipientGroup)
        .values(input)
        .returning({id: recipientGroup.id, name: recipientGroup.name})
      return {status: 'created', row: {...row, profileCount: 0}} as const
    })
  } catch (error) {
    if (isDuplicateNameViolation(error)) return {status: 'duplicate_name'}
    throw error
  }
}

/** Renomme un groupe ; un nom deja porte, sans casse, est refuse. */
export const renameRecipientGroupTxnDao = async (
  groupId: string,
  name: string
): Promise<RenameRecipientGroupResult> => {
  try {
    return await getDb().transaction(async (tx) => {
      const [row] = await tx
        .update(recipientGroup)
        .set({name, updatedAt: sql`now()`})
        .where(eq(recipientGroup.id, groupId))
        .returning(GROUP_ROW)
      return row
        ? ({status: 'updated', row} as const)
        : ({status: 'not_found'} as const)
    })
  } catch (error) {
    if (isDuplicateNameViolation(error)) return {status: 'duplicate_name'}
    throw error
  }
}

/**
 * Supprime un groupe : ses appartenances suivent (`CASCADE`), les fiches et
 * les campagnes restent (`SET NULL`, nom copie, ADR 060 §5).
 */
export const deleteRecipientGroupTxnDao = async (
  groupId: string
): Promise<{id: string} | undefined> => {
  const [row] = await getDb()
    .delete(recipientGroup)
    .where(eq(recipientGroup.id, groupId))
    .returning({id: recipientGroup.id})
  return row
}

/** Ajoute des fiches a un groupe, sans doublon : rend le nombre ajoute. */
export const addRecipientGroupMembersTxnDao = async (
  organizationId: string,
  groupId: string,
  memberProfileIds: string[]
): Promise<number> => {
  if (memberProfileIds.length === 0) return 0
  const rows = await getDb()
    .insert(recipientGroupMember)
    .values(
      memberProfileIds.map((memberProfileId) => ({
        organizationId,
        groupId,
        memberProfileId,
      }))
    )
    .onConflictDoNothing()
    .returning({memberProfileId: recipientGroupMember.memberProfileId})
  return rows.length
}

/** Retire des fiches d'un groupe : rend le nombre retire. */
export const removeRecipientGroupMembersTxnDao = async (
  groupId: string,
  memberProfileIds: string[]
): Promise<number> => {
  if (memberProfileIds.length === 0) return 0
  const rows = await getDb()
    .delete(recipientGroupMember)
    .where(
      and(
        eq(recipientGroupMember.groupId, groupId),
        inArray(recipientGroupMember.memberProfileId, memberProfileIds)
      )
    )
    .returning({memberProfileId: recipientGroupMember.memberProfileId})
  return rows.length
}

/** Les fiches d'un groupe. */
export const getRecipientGroupMemberIdsDao = async (
  groupId: string
): Promise<string[]> => {
  const rows = await getDb()
    .select({memberProfileId: recipientGroupMember.memberProfileId})
    .from(recipientGroupMember)
    .where(eq(recipientGroupMember.groupId, groupId))
  return rows.map((row) => row.memberProfileId)
}

/**
 * Parmi ces fiches, celles que le scope du tenant laisse lire : une fiche
 * d'une autre association est absente (ADR 060 §4).
 */
export const getReadableMemberProfileIdsDao = async (
  memberProfileIds: string[]
): Promise<string[]> => {
  if (memberProfileIds.length === 0) return []
  const rows = await getDb()
    .select({id: memberProfile.id})
    .from(memberProfile)
    .where(inArray(memberProfile.id, memberProfileIds))
  return rows.map((row) => row.id)
}
