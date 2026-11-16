import 'server-only'

import {
  countLinkedProfilesDao,
  countMemberProfilesDao,
  createMemberProfileTxnDao,
  getMemberProfileByIdDao,
  getMemberProfileByPennylaneIdDao,
  getMemberProfilePageDao,
  getMemberProfilesByEmailDao,
  MemberProfileWithAccountRow,
  MyMemberProfileRow,
  updateMemberProfileContactTxnDao,
} from '@/db/repositories/member-profile-repository'
import {
  getMemberAccountDao,
  getOrganizationMembersDao,
} from '@/db/repositories/organization-repository'
import {withTenant} from '@/db/tenant-scope'

import {getActingContext, getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {canReadMemberAccount} from './authorization/member-account-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {
  applyMemberAccountDecision,
  getLinkedAccountRole,
  getMyMemberProfiles,
} from './member-account-service'
import {decideMemberAccount} from './rules/member-account-rules'
import {toMemberProfileDto} from './rules/member-profile-rules'
import {roleCardFor} from './rules/member-role-rules'
import {orderMyProfiles} from './rules/my-profiles-order-rules'
import {ActionIdConst} from './types/domain/action-registry-types'
import {RoleConst} from './types/domain/auth-types'
import {effectiveAuthor} from './types/domain/impersonation-types'
import {
  MemberAccountAuthor,
  MemberAccountRole,
} from './types/domain/member-account-types'
import {
  CreateMemberProfileInput,
  MEMBER_PROFILES_PAGE_SIZE,
  MemberAccountHolderDTO,
  MemberAccountProfileDTO,
  MemberProfileAccountDTO,
  MemberProfileDTO,
  MemberProfilePageDTO,
  MemberProfilePageInput,
  MemberProfileWriteResult,
  UpdateMemberProfileContactInput,
} from './types/domain/member-profile-types'
import {MemberRoleCardDTO} from './types/domain/member-role-types'
import {User} from './types/domain/user-types'
import {
  createMemberProfileServiceSchema,
  findByPennylaneIdServiceSchema,
  memberProfileOrganizationIdSchema,
  memberProfilePageServiceSchema,
  memberProfileServiceSchema,
  updateMemberProfileContactServiceSchema,
} from './validation/member-profile-validation'

/**
 * Fiches des proprietaires (s12, ADR 029). Chaque fonction : validation, puis
 * `member.profile.manage`, puis le repository sous le scope du tenant.
 *
 * Le compte d'une fiche suit son adresse (s12d) : l'ecriture de la fiche et
 * celle du compte tiennent dans le meme `withTenant`, par
 * `member-account-service`. Rien n'est envoye a l'ouverture. Une adresse deja
 * celle d'un compte de l'association n'y relie la fiche que sur confirmation
 * du bureau (s53, ADR 054 §4).
 */

const MANAGE_DENIED =
  "Seul le bureau de l'association peut gérer les fiches des propriétaires"

const requireMemberProfileManager = async (
  organizationId: string
): Promise<User | undefined> => {
  const authUser = await getAuthUser()
  if (
    !canPerformAction(
      authUser,
      organizationId,
      ActionIdConst.MEMBER_PROFILE_MANAGE
    )
  ) {
    throw new AuthorizationError(MANAGE_DENIED)
  }
  return authUser
}

const sortParcelNumbers = (numbers: string[]): string[] =>
  [...numbers].sort((a, b) => a.localeCompare(b, 'fr', {numeric: true}))

/** Une fiche d'un compte, telle que le bureau la lit (s53). */
const toAccountProfile = (
  profile: MyMemberProfileRow
): MemberAccountProfileDTO => ({
  id: profile.id,
  name: profile.name,
  parcelNumbers: sortParcelNumbers(profile.currentParcelNumbers),
})

/**
 * L'etat du compte d'une fiche (carte « Acces a l'espace membre ») : lecture
 * de l'appartenance d'un tiers, sous son `can*` (ADR 014). Nomme le compte et
 * les autres fiches qu'il reunit (s53, 3c).
 */
const readAccount = async (
  authUser: User | undefined,
  organizationId: string,
  memberProfileId: string,
  userId: string | null
): Promise<MemberProfileAccountDTO> => {
  if (!canReadMemberAccount(authUser, organizationId)) {
    throw new AuthorizationError(MANAGE_DENIED)
  }
  if (userId === null) return {status: 'mail_only'}

  const account = await getMemberAccountDao(userId, organizationId)
  if (!account) return {status: 'mail_only'}
  const profiles = await getMyMemberProfiles(organizationId, userId)
  return {
    status: 'open',
    loginEmail: account.email,
    boardRole: account.role === 'member' ? null : account.role,
    accountName: account.name,
    otherProfiles: profiles
      .filter((profile) => profile.id !== memberProfileId)
      .map(toAccountProfile),
  }
}

/** Role du compte d'une fiche lu par la carte d'acces ; `null` sans compte. */
const accountRoleOf = (
  account: MemberProfileAccountDTO
): MemberAccountRole | null =>
  account.status === 'open' ? (account.boardRole ?? 'member') : null

/** La carte « Role dans l'association » pour la personne connectee (s14). */
const roleCardOf = (
  authUser: User | undefined,
  organizationId: string,
  row: MemberProfileWithAccountRow,
  account: MemberProfileAccountDTO
): MemberRoleCardDTO =>
  roleCardFor(
    {
      role:
        authUser?.organizations?.find(
          (membership) => membership.organizationId === organizationId
        )?.role ?? null,
      isSuperAdmin: authUser?.role === RoleConst.SUPER_ADMIN,
      isSelf: authUser !== undefined && authUser.id === row.userId,
    },
    {role: accountRoleOf(account)}
  )

/** La fiche, l'etat de son compte et sa carte de role, pour l'ecran. */
const toProfileWithAccount = async (
  authUser: User | undefined,
  organizationId: string,
  row: MemberProfileWithAccountRow
): Promise<MemberProfileDTO> => {
  const account = await readAccount(
    authUser,
    organizationId,
    row.id,
    row.userId
  )
  return {
    ...toMemberProfileDto(row),
    account,
    roleCard: roleCardOf(authUser, organizationId, row, account),
  }
}

/**
 * Le role au bureau du compte de chaque fiche de la liste (badge, s14) :
 * lecture d'appartenance de tiers, sous son `can*` (ADR 014).
 */
const readBoardRoles = async (
  authUser: User | undefined,
  organizationId: string
): Promise<Map<string, 'board' | 'owner'>> => {
  if (!canReadMemberAccount(authUser, organizationId)) {
    throw new AuthorizationError(MANAGE_DENIED)
  }
  const members = await getOrganizationMembersDao(organizationId)
  return new Map(
    members.flatMap((membership) =>
      membership.role === 'member'
        ? []
        : [[membership.userId, membership.role] as const]
    )
  )
}

/**
 * Auteur d'un changement de compte, copie dans la trace des roles (D5) : le
 * SuperAdmin s'il agit a la place du compte vu (s48, ADR 041). A lire avant
 * `withTenant` : la session passe par le pool, que le scope retient.
 */
const authorOf = async (
  authUser: User | undefined
): Promise<MemberAccountAuthor> => {
  if (!authUser) return {userId: null, name: null}
  const author = effectiveAuthor(
    authUser,
    (await getActingContext())?.impersonator
  )
  return {
    userId: author.authorUserId,
    name: author.authorName,
    onBehalfOfUserId: author.onBehalfOfUserId,
    onBehalfOfName: author.onBehalfOfName,
  }
}

/**
 * Le compte de l'association qui porte deja cette adresse par une autre fiche
 * (s53, ADR 054 §4), lu dans la transaction de l'ecriture ; rien si aucune
 * autre fiche reliee ne la porte, ou si c'est deja le compte de la fiche.
 */
const findEmailHolder = async (
  organizationId: string,
  email: string | null,
  current: {memberProfileId: string | null; userId: string | null}
): Promise<MemberAccountHolderDTO | undefined> => {
  if (email === null) return undefined

  const holders = orderMyProfiles(
    (await getMemberProfilesByEmailDao(organizationId, email)).filter(
      (profile) =>
        profile.id !== current.memberProfileId && profile.userId !== null
    )
  )
  const userId = holders[0]?.userId
  if (!userId || userId === current.userId) return undefined

  const account = await getMemberAccountDao(userId, organizationId)
  const profiles = await getMyMemberProfiles(organizationId, userId)
  return {
    userId,
    name: account?.name ?? holders[0].name,
    profiles: profiles.map(toAccountProfile),
  }
}

/**
 * Le compte detenteur que l'ecriture peut rejoindre : celui que le bureau a
 * confirme, s'il est encore le detenteur ; sinon il faut redemander.
 */
const confirmedHolder = (
  holder: MemberAccountHolderDTO | undefined,
  confirmedAccountUserId: string | undefined
): {kind: 'none'} | {kind: 'confirmed'; userId: string} | {kind: 'ask'} => {
  if (!holder) return {kind: 'none'}
  if (holder.userId === confirmedAccountUserId) {
    return {kind: 'confirmed', userId: holder.userId}
  }
  return {kind: 'ask'}
}

/** Nombre d'autres fiches reliees au compte de la fiche (ADR 054 §5). */
const otherLinkedProfilesOf = async (
  organizationId: string,
  userId: string | null
): Promise<number> =>
  userId === null
    ? 0
    : Math.max(0, (await countLinkedProfilesDao(organizationId, userId)) - 1)

/**
 * Cree une fiche. Son identifiant est genere par la base : il ne depend ni de
 * l'email ni d'une parcelle (critere 1). Sans email, la fiche est « courrier
 * uniquement » (critere 7).
 */
export const createMemberProfileService = async (
  input: CreateMemberProfileInput
): Promise<MemberProfileWriteResult> => {
  const parsed = createMemberProfileServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {confirmedAccountUserId, ...fields} = parsed.data
  const {organizationId} = fields
  const authUser = await requireMemberProfileManager(organizationId)
  const author = await authorOf(authUser)

  return withTenant(organizationId, async () => {
    const holder = await findEmailHolder(organizationId, fields.email, {
      memberProfileId: null,
      userId: null,
    })
    const shared = confirmedHolder(holder, confirmedAccountUserId)
    if (shared.kind === 'ask' && holder) {
      return {status: 'email_shared', holder}
    }

    const {row} = await createMemberProfileTxnDao(fields)
    const {change, userId} = await applyMemberAccountDecision({
      organizationId,
      author,
      profile: {...row, userId: null},
      decision: decideMemberAccount({
        savedEmail: null,
        nextEmail: row.email,
        linkedRole: null,
        otherLinkedProfiles: 0,
        nextEmailAccountUserId:
          shared.kind === 'confirmed' ? shared.userId : null,
      }),
    })
    return {
      status: 'saved',
      profile: await toProfileWithAccount(authUser, organizationId, {
        ...row,
        userId,
      }),
      accountChange: change,
    }
  })
}

/** Met a jour adresse postale, telephone et email d'une fiche (critere 6). */
export const updateMemberProfileContactService = async (
  input: UpdateMemberProfileContactInput
): Promise<MemberProfileWriteResult> => {
  const parsed = updateMemberProfileContactServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, memberProfileId, confirmedAccountUserId, ...contact} =
    parsed.data
  const authUser = await requireMemberProfileManager(organizationId)
  const author = await authorOf(authUser)

  return withTenant(organizationId, async () => {
    const saved = await getMemberProfileByIdDao(memberProfileId)
    if (!saved) return {status: 'not_found'}

    const holder = await findEmailHolder(organizationId, contact.email, {
      memberProfileId,
      userId: saved.userId,
    })
    const shared = confirmedHolder(holder, confirmedAccountUserId)
    if (shared.kind === 'ask' && holder) {
      return {status: 'email_shared', holder}
    }

    const decision = decideMemberAccount({
      savedEmail: saved.email,
      nextEmail: contact.email,
      linkedRole: await getLinkedAccountRole(organizationId, saved.userId),
      otherLinkedProfiles: await otherLinkedProfilesOf(
        organizationId,
        saved.userId
      ),
      nextEmailAccountUserId:
        shared.kind === 'confirmed' ? shared.userId : null,
    })
    if (decision.kind === 'refuse_board_removal') {
      return {status: 'board_email_required'}
    }

    const result = await updateMemberProfileContactTxnDao(
      memberProfileId,
      contact
    )
    if (result.status === 'not_found') return {status: 'not_found'}
    const {change, userId} = await applyMemberAccountDecision({
      organizationId,
      author,
      profile: {...result.row, userId: saved.userId},
      decision,
    })
    return {
      status: 'saved',
      profile: await toProfileWithAccount(authUser, organizationId, {
        ...result.row,
        userId,
      }),
      accountChange: change,
    }
  })
}

/** Une fiche de l'association, ou rien. */
export const getMemberProfileService = async (
  organizationId: string,
  memberProfileId: string
): Promise<MemberProfileDTO | undefined> => {
  const parsed = memberProfileServiceSchema.safeParse({
    organizationId,
    memberProfileId,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const authUser = await requireMemberProfileManager(parsed.data.organizationId)

  return withTenant(parsed.data.organizationId, async () => {
    const row = await getMemberProfileByIdDao(parsed.data.memberProfileId)
    return row
      ? toProfileWithAccount(authUser, parsed.data.organizationId, row)
      : undefined
  })
}

/**
 * Une page de la liste, triee par nom, avec la recherche (nom ou numero de
 * parcelle actuelle) et les deux decomptes de l'association.
 */
export const getMemberProfilePageService = async (
  input: MemberProfilePageInput
): Promise<MemberProfilePageDTO> => {
  const parsed = memberProfilePageServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, page, search} = parsed.data
  const authUser = await requireMemberProfileManager(organizationId)

  const [{rows, total}, counts, boardRoles] = await withTenant(
    organizationId,
    async () =>
      [
        await getMemberProfilePageDao({
          organizationId,
          search,
          limit: MEMBER_PROFILES_PAGE_SIZE,
          offset: (page - 1) * MEMBER_PROFILES_PAGE_SIZE,
        }),
        await countMemberProfilesDao(organizationId),
        await readBoardRoles(authUser, organizationId),
      ] as const
  )

  return {
    items: rows.map((row) => ({
      ...toMemberProfileDto(row),
      currentParcelNumbers: sortParcelNumbers(row.currentParcelNumbers),
      boardRole: row.userId ? (boardRoles.get(row.userId) ?? null) : null,
      accountProfileCount: row.accountProfileCount,
    })),
    page,
    pageSize: MEMBER_PROFILES_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / MEMBER_PROFILES_PAGE_SIZE)),
    profileCount: counts.total,
    incompleteCount: counts.incomplete,
  }
}

/**
 * L'utilisateur connecte peut-il gerer les fiches des proprietaires de cette
 * association ? Pour les ecrans : un refus se lit, il ne se leve pas.
 */
export const canManageMemberProfilesService = async (
  organizationId: string
): Promise<boolean> => {
  const parsed = memberProfileOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) return false

  const authUser = await getAuthUser()
  return canPerformAction(
    authUser,
    parsed.data,
    ActionIdConst.MEMBER_PROFILE_MANAGE
  )
}

/**
 * L'identifiant de la fiche qui porte deja cet identifiant client Pennylane
 * (s13, ADR 048), ou rien : la cle d'idempotence de l'import.
 */
export const findMemberProfileIdByPennylaneIdService = async (
  organizationId: string,
  pennylaneCustomerId: string
): Promise<string | undefined> => {
  const parsed = findByPennylaneIdServiceSchema.safeParse({
    organizationId,
    pennylaneCustomerId,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireMemberProfileManager(parsed.data.organizationId)

  return withTenant(parsed.data.organizationId, async () => {
    const row = await getMemberProfileByPennylaneIdDao(
      parsed.data.organizationId,
      parsed.data.pennylaneCustomerId
    )
    return row?.id
  })
}
