import 'server-only'

import {z} from 'zod'

import {getCampaignTargetRowsDao} from '@/db/repositories/campaign-repository'
import {
  addRecipientGroupMembersTxnDao,
  createRecipientGroupTxnDao,
  deleteRecipientGroupTxnDao,
  getReadableMemberProfileIdsDao,
  getRecipientGroupByIdDao,
  getRecipientGroupMemberIdsDao,
  listRecipientGroupsDao,
  removeRecipientGroupMembersTxnDao,
  renameRecipientGroupTxnDao,
} from '@/db/repositories/recipient-group-repository'
import {withTenant} from '@/db/tenant-scope'

import {getAuthUser} from './authentication/auth-service'
import {canManageRecipientGroups} from './authorization/recipient-group-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {NotFoundError} from './errors/not-found-error'
import {DuplicateRecipientGroupNameError} from './errors/recipient-group-errors'
import {ValidationParsedZodError} from './errors/validation-error'
import {
  campaignTargetCountsOf,
  computeCampaignTarget,
} from './rules/campaign-rules'
import {
  CreateRecipientGroupInput,
  RecipientGroupDetailDTO,
  RecipientGroupDTO,
  RecipientGroupMembersInput,
  RecipientGroupMembersResult,
  RecipientGroupScopeInput,
  RenameRecipientGroupInput,
} from './types/domain/recipient-group-types'
import {
  createRecipientGroupServiceSchema,
  recipientGroupMembersServiceSchema,
  recipientGroupOrganizationIdSchema,
  recipientGroupScopeServiceSchema,
  renameRecipientGroupServiceSchema,
} from './validation/recipient-group-validation'

/**
 * Groupes de destinataires des campagnes (s27, ADR 060 §4). Reserves au
 * bureau : chaque fonction valide l'entree, puis exige `campaign.group.manage`
 * sur l'association, puis s'execute sous `withTenant`. Une fiche ou un groupe
 * d'une autre association est invisible sous le tenant, donc refuse.
 * Ni noms ni fiches dans les journaux (intercepteur sans details).
 */

const GROUPS_DENIED =
  "Seul le bureau de l'association peut composer les groupes de destinataires"
const GROUP_NOT_FOUND = 'Groupe introuvable'
const PROFILE_NOT_FOUND = 'Fiche introuvable dans cette association'

const parseOrThrow = <S extends z.ZodType>(
  schema: S,
  input: unknown
): z.output<S> => {
  const parsed = schema.safeParse(input)
  if (!parsed.success) throw new ValidationParsedZodError(parsed.error)
  return parsed.data
}

const requireGroupsManager = async (organizationId: string): Promise<void> => {
  const authUser = await getAuthUser()
  if (!canManageRecipientGroups(authUser, organizationId)) {
    throw new AuthorizationError(GROUPS_DENIED)
  }
}

/** Le compte connecte compose-t-il les groupes de cette association ? */
export const canManageRecipientGroupsService = async (
  organizationId: string
): Promise<boolean> => {
  const parsed = recipientGroupOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) return false
  return canManageRecipientGroups(await getAuthUser(), parsed.data)
}

/** Les groupes de l'association, par nom, avec leur nombre de fiches. */
export const listRecipientGroupsService = async (
  organizationId: string
): Promise<RecipientGroupDTO[]> => {
  const orgId = parseOrThrow(recipientGroupOrganizationIdSchema, organizationId)
  await requireGroupsManager(orgId)
  return withTenant(orgId, () => listRecipientGroupsDao(orgId))
}

/**
 * Un groupe ouvert et sa composition, comptee comme la cible d'une campagne
 * (critere 5, ADR 060 §2) ; `undefined` s'il est introuvable sous le tenant.
 */
export const getRecipientGroupService = async (
  input: RecipientGroupScopeInput
): Promise<RecipientGroupDetailDTO | undefined> => {
  const data = parseOrThrow(recipientGroupScopeServiceSchema, input)
  await requireGroupsManager(data.organizationId)

  return withTenant(data.organizationId, async () => {
    const group = await getRecipientGroupByIdDao(data.groupId)
    if (!group) return undefined
    const [memberIds, rows] = await Promise.all([
      getRecipientGroupMemberIdsDao(data.groupId),
      getCampaignTargetRowsDao(data.organizationId),
    ])
    const members = new Set(memberIds)
    const target = computeCampaignTarget(rows, (row) =>
      members.has(row.memberProfileId)
    )
    return {...group, counts: campaignTargetCountsOf(target)}
  })
}

/** Cree un groupe vide ; un nom deja pris, sans casse, est refuse. */
export const createRecipientGroupService = async (
  input: CreateRecipientGroupInput
): Promise<RecipientGroupDTO> => {
  const data = parseOrThrow(createRecipientGroupServiceSchema, input)
  await requireGroupsManager(data.organizationId)

  const result = await withTenant(data.organizationId, () =>
    createRecipientGroupTxnDao(data)
  )
  if (result.status === 'duplicate_name') {
    throw new DuplicateRecipientGroupNameError()
  }
  return result.row
}

/** Renomme un groupe ; un nom deja pris, sans casse, est refuse. */
export const renameRecipientGroupService = async (
  input: RenameRecipientGroupInput
): Promise<RecipientGroupDTO> => {
  const data = parseOrThrow(renameRecipientGroupServiceSchema, input)
  await requireGroupsManager(data.organizationId)

  const result = await withTenant(data.organizationId, () =>
    renameRecipientGroupTxnDao(data.groupId, data.name)
  )
  if (result.status === 'duplicate_name') {
    throw new DuplicateRecipientGroupNameError()
  }
  if (result.status === 'not_found') throw new NotFoundError(GROUP_NOT_FOUND)
  return result.row
}

/**
 * Supprime un groupe : ni les fiches ni les campagnes deja envoyees ne
 * changent (critere 6, ADR 060 §5).
 */
export const deleteRecipientGroupService = async (
  input: RecipientGroupScopeInput
): Promise<void> => {
  const data = parseOrThrow(recipientGroupScopeServiceSchema, input)
  await requireGroupsManager(data.organizationId)

  const deleted = await withTenant(data.organizationId, () =>
    deleteRecipientGroupTxnDao(data.groupId)
  )
  if (!deleted) throw new NotFoundError(GROUP_NOT_FOUND)
}

const requireGroup = async (groupId: string): Promise<void> => {
  if (!(await getRecipientGroupByIdDao(groupId))) {
    throw new NotFoundError(GROUP_NOT_FOUND)
  }
}

const groupAfterChange = async (
  groupId: string,
  changed: number
): Promise<RecipientGroupMembersResult> => {
  const group = await getRecipientGroupByIdDao(groupId)
  if (!group) throw new NotFoundError(GROUP_NOT_FOUND)
  return {group, changed}
}

/**
 * Ajoute des fiches a un groupe, depuis la liste des membres (critere 3).
 * Idempotent ; une fiche illisible sous le tenant refuse tout l'ajout.
 */
export const addMembersToRecipientGroupService = async (
  input: RecipientGroupMembersInput
): Promise<RecipientGroupMembersResult> => {
  const data = parseOrThrow(recipientGroupMembersServiceSchema, input)
  await requireGroupsManager(data.organizationId)

  return withTenant(data.organizationId, async () => {
    await requireGroup(data.groupId)
    const readable = await getReadableMemberProfileIdsDao(data.memberProfileIds)
    if (readable.length !== data.memberProfileIds.length) {
      throw new NotFoundError(PROFILE_NOT_FOUND)
    }
    const added = await addRecipientGroupMembersTxnDao(
      data.organizationId,
      data.groupId,
      data.memberProfileIds
    )
    return groupAfterChange(data.groupId, added)
  })
}

/** Retire des fiches d'un groupe, depuis la liste filtree sur ce groupe. */
export const removeMembersFromRecipientGroupService = async (
  input: RecipientGroupMembersInput
): Promise<RecipientGroupMembersResult> => {
  const data = parseOrThrow(recipientGroupMembersServiceSchema, input)
  await requireGroupsManager(data.organizationId)

  return withTenant(data.organizationId, async () => {
    await requireGroup(data.groupId)
    const removed = await removeRecipientGroupMembersTxnDao(
      data.groupId,
      data.memberProfileIds
    )
    return groupAfterChange(data.groupId, removed)
  })
}
