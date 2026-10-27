import 'server-only'

import {getMemberProfileByIdDao} from '@/db/repositories/member-profile-repository'
import {getMemberProfileByUserIdDao} from '@/db/repositories/member-profile-repository'
import {insertMemberRoleEventDao} from '@/db/repositories/member-role-event-repository'
import {
  countCapableMembersDao,
  getOrganizationByDomainDao,
  getOrganizationOwnerDao,
  getUserRoleInOrganizationDao,
  lockOrganizationRolesDao,
  updateMemberRoleFromDao,
} from '@/db/repositories/organization-repository'
import {getUserByEmailDao} from '@/db/repositories/user-repository'
import {withTenant} from '@/db/tenant-scope'

import {getAuthUser} from './authentication/auth-service'
import {canAssignMemberRole} from './authorization/member-role-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {decideRoleChange} from './rules/member-role-rules'
import {RoleConst} from './types/domain/auth-types'
import {
  MemberAccountRole,
  MemberAccountRoleConst,
} from './types/domain/member-account-types'
import {
  ChangeMemberRoleInput,
  MemberRoleChangeDecision,
  MemberRoleChangeKind,
  MemberRoleChangeResult,
  TransferPresidencyByOperatorResult,
} from './types/domain/member-role-types'
import {User} from './types/domain/user-types'
import {
  changeMemberRoleServiceSchema,
  transferPresidencyByOperatorServiceSchema,
} from './validation/member-role-validation'

/**
 * Changement de role d'association (s14, ADR 039) : le seul chemin
 * d'ecriture d'un role, avec `replaceMemberAccount` pour le deplacement par
 * changement d'adresse. Jamais `auth.api.updateMemberRole`.
 *
 * Sous `withTenant` : relire la fiche (RLS — une fiche d'une autre
 * association n'existe pas), prendre le verrou de l'association, relire les
 * roles, decompter les comptes capables, decider, ecrire, tracer. Le
 * `user_id` vise est celui de la fiche relue, jamais une valeur du
 * navigateur.
 */

const ASSIGN_DENIED =
  "Seul le bureau de l'association peut désigner les membres du bureau"

/** Auteur d'un acte d'exploitation (D8) : la trace porte `author_user_id` nul. */
const OPERATOR_AUTHOR_NAME = 'Zourite Studio'

type RoleWrite = {
  organizationId: string
  userId: string
  from: MemberAccountRole
  to: MemberAccountRole
}

type RoleTrace = {
  memberProfileId: string | null
  targetName: string
  author: {userId: string | null; name: string}
  reason: 'assignment' | 'presidency_transfer'
}

/**
 * Ecrit un role, seulement s'il vaut encore `from`. Sous le verrou, zero
 * ligne touchee est une incoherence : l'echec annule toute la transaction.
 */
const writeRole = async ({
  organizationId,
  userId,
  from,
  to,
}: RoleWrite): Promise<void> => {
  const touched = await updateMemberRoleFromDao(
    userId,
    organizationId,
    from,
    to
  )
  if (touched !== 1) {
    throw new Error(
      `Rôle de ${userId} changé pendant l'enregistrement (${from} -> ${to})`
    )
  }
}

const traceRole = async (write: RoleWrite, trace: RoleTrace): Promise<void> =>
  insertMemberRoleEventDao({
    organizationId: write.organizationId,
    memberProfileId: trace.memberProfileId,
    targetUserId: write.userId,
    targetName: trace.targetName,
    authorUserId: trace.author.userId,
    authorName: trace.author.name,
    fromRole: write.from,
    toRole: write.to,
    reason: trace.reason,
  })

/** Ecritures d'une passation : successeur d'abord, ancienne President(e) ensuite. */
const transferPresidency = async (
  successor: RoleWrite & {memberProfileId: string | null; name: string},
  predecessor: {userId: string; name: string} | undefined,
  author: RoleTrace['author']
): Promise<void> => {
  const writes: (RoleWrite & {memberProfileId: string | null; name: string})[] =
    [successor]
  if (predecessor) {
    const profile = await getMemberProfileByUserIdDao(
      successor.organizationId,
      predecessor.userId
    )
    writes.push({
      organizationId: successor.organizationId,
      userId: predecessor.userId,
      from: MemberAccountRoleConst.OWNER,
      to: MemberAccountRoleConst.BOARD,
      memberProfileId: profile?.id ?? null,
      name: predecessor.name,
    })
  }
  for (const write of writes) await writeRole(write)
  for (const write of writes) {
    await traceRole(write, {
      memberProfileId: write.memberProfileId,
      targetName: write.name,
      author,
      reason: 'presidency_transfer',
    })
  }
}

const CHANGE_OF: Record<
  'assign' | 'demote' | 'transfer_presidency',
  MemberRoleChangeKind
> = {
  assign: 'assigned',
  demote: 'demoted',
  transfer_presidency: 'presidency_transferred',
}

type ApplyDecisionInput = {
  organizationId: string
  decision: Exclude<MemberRoleChangeDecision, {kind: 'refuse'} | {kind: 'none'}>
  target: {
    userId: string
    role: MemberAccountRole
    memberProfileId: string
    name: string
  }
  viewer: User
}

/** Ecrit et trace la decision de `decideRoleChange`. */
const applyDecision = async ({
  organizationId,
  decision,
  target,
  viewer,
}: ApplyDecisionInput): Promise<void> => {
  const author = {userId: viewer.id, name: viewer.name}
  const base = {organizationId, userId: target.userId, from: target.role}

  if (decision.kind === 'transfer_presidency') {
    await transferPresidency(
      {
        ...base,
        to: MemberAccountRoleConst.OWNER,
        memberProfileId: target.memberProfileId,
        name: target.name,
      },
      {userId: viewer.id, name: viewer.name},
      author
    )
    return
  }

  const write = {
    ...base,
    to:
      decision.kind === 'assign'
        ? MemberAccountRoleConst.BOARD
        : MemberAccountRoleConst.MEMBER,
  }
  await writeRole(write)
  await traceRole(write, {
    memberProfileId: target.memberProfileId,
    targetName: target.name,
    author,
    reason: 'assignment',
  })
}

const requireRoleAssigner = async (organizationId: string): Promise<User> => {
  const authUser = await getAuthUser()
  if (!authUser || !canAssignMemberRole(authUser, organizationId)) {
    throw new AuthorizationError(ASSIGN_DENIED)
  }
  return authUser
}

/**
 * Attribue ou retire le role Bureau, ou transmet la presidence, depuis la
 * fiche d'un membre (criteres 1 a 6).
 */
export const changeMemberRoleService = async (
  input: ChangeMemberRoleInput
): Promise<MemberRoleChangeResult> => {
  const parsed = changeMemberRoleServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, memberProfileId, role} = parsed.data
  const viewer = await requireRoleAssigner(organizationId)

  return withTenant(organizationId, async () => {
    const profile = await getMemberProfileByIdDao(memberProfileId)
    if (!profile) return {status: 'not_found'}
    if (profile.userId === null) return {status: 'no_account'}

    await lockOrganizationRolesDao(organizationId)
    const targetRole = await getUserRoleInOrganizationDao(
      profile.userId,
      organizationId
    )
    if (targetRole === null) return {status: 'no_account'}

    const viewerRole = await getUserRoleInOrganizationDao(
      viewer.id,
      organizationId
    )
    const self = viewer.id === profile.userId
    const decision = decideRoleChange({
      viewerRole,
      viewerIsSuperAdmin: viewer.role === RoleConst.SUPER_ADMIN,
      targetRole,
      nextRole: role,
      isSelf: self,
      capableCount: await countCapableMembersDao(organizationId),
    })

    if (decision.kind === 'refuse') {
      return {
        status: 'refused',
        reason: decision.reason,
        self,
        name: profile.name,
      }
    }
    if (decision.kind === 'none') {
      return {status: 'saved', change: 'none', self, name: profile.name}
    }

    await applyDecision({
      organizationId,
      decision,
      target: {
        userId: profile.userId,
        role: targetRole,
        memberProfileId: profile.id,
        name: profile.name,
      },
      viewer,
    })
    return {
      status: 'saved',
      change: CHANGE_OF[decision.kind],
      self,
      name: profile.name,
    }
  })
}

/**
 * Recours d'exploitation (D8, ADR 039) : la President(e) est partie sans
 * transmettre. Meme service, meme verrou : le compte de cette adresse, deja
 * membre de l'association du domaine, devient President(e) ; l'ancienne
 * repasse Bureau. Trace `presidency_transfer`, auteur « Zourite Studio ».
 * Appele par `pnpm ops:transfer-presidency`, jamais par un ecran.
 */
export const transferPresidencyByOperatorService = async (
  domain: string,
  email: string
): Promise<TransferPresidencyByOperatorResult> => {
  const parsed = transferPresidencyByOperatorServiceSchema.safeParse({
    domain,
    email,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const organization = await getOrganizationByDomainDao(parsed.data.domain)
  if (!organization) {
    throw new Error(`Aucune association pour le domaine ${parsed.data.domain}`)
  }
  const successor = await getUserByEmailDao(parsed.data.email)
  const noMemberAccount = new Error(
    `Aucun compte membre de cette association pour l'adresse ${parsed.data.email}`
  )
  if (!successor) throw noMemberAccount
  if (successor.role === RoleConst.SUPER_ADMIN) {
    throw new Error('Un compte SuperAdmin ne peut pas devenir Président(e)')
  }

  const organizationId = organization.id
  return withTenant(organizationId, async () => {
    await lockOrganizationRolesDao(organizationId)
    const role = await getUserRoleInOrganizationDao(
      successor.id,
      organizationId
    )
    if (role === null) throw noMemberAccount

    const predecessor = await getOrganizationOwnerDao(organizationId)
    const result = {
      organizationId,
      newOwnerUserId: successor.id,
      previousOwnerUserId: predecessor?.userId ?? null,
    }
    if (role === MemberAccountRoleConst.OWNER) {
      return {...result, changed: false}
    }

    const profile = await getMemberProfileByUserIdDao(
      organizationId,
      successor.id
    )
    await transferPresidency(
      {
        organizationId,
        userId: successor.id,
        from: role,
        to: MemberAccountRoleConst.OWNER,
        memberProfileId: profile?.id ?? null,
        name: successor.name,
      },
      predecessor,
      {userId: null, name: OPERATOR_AUTHOR_NAME}
    )
    return {...result, changed: true}
  })
}
