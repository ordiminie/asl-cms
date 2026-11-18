import 'server-only'

import {insertMemberProfileEmailDao} from '@/db/repositories/member-profile-email-repository'
import {
  countMemberProfilesDao,
  createMemberProfileTxnDao,
  getMemberProfileByIdDao,
  getMemberProfileByPennylaneIdDao,
  getMemberProfilePageDao,
  updateMemberProfileContactTxnDao,
} from '@/db/repositories/member-profile-repository'
import {getOrganizationMembersDao} from '@/db/repositories/organization-repository'
import {withTenant} from '@/db/tenant-scope'

import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {canReadMemberAccount} from './authorization/member-account-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {applyMemberAccountDecision} from './member-account-service'
import {
  authorOf,
  confirmedHolder,
  findEmailHolder,
  MANAGE_DENIED,
  readProfileView,
  requireMemberProfileManager,
  sortParcelNumbers,
} from './member-profile-support'
import {decideMemberAccount} from './rules/member-account-rules'
import {toMemberProfileDto} from './rules/member-profile-rules'
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  MemberEmailOriginConst,
  MemberEmailRoleConst,
  MemberEmailStatusConst,
} from './types/domain/member-email-types'
import {
  CreateMemberProfileInput,
  MEMBER_PROFILES_PAGE_SIZE,
  MemberProfileDTO,
  MemberProfilePageDTO,
  MemberProfilePageInput,
  MemberProfileWriteResult,
  UpdateMemberProfileContactInput,
} from './types/domain/member-profile-types'
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
 * Les adresses d'une fiche vivent dans `member_profile_email` (s54, ADR 056) :
 * l'email saisi a la creation devient sa titulaire ; les suivantes, et toute
 * modification, passent par `member-profile-email-service`. Chaque adresse
 * active a son compte, ecrit dans le meme `withTenant` par
 * `member-account-service`. Rien n'est envoye a l'ouverture. Une adresse deja
 * celle d'un compte de l'association n'y relie la fiche que sur confirmation
 * du bureau (s53, ADR 054 §4).
 */

/**
 * Le role au bureau du compte titulaire de chaque fiche de la liste (badge,
 * s14) : lecture d'appartenance de tiers, sous son `can*` (ADR 014).
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
 * Cree une fiche. Son identifiant est genere par la base : il ne depend ni de
 * l'email ni d'une parcelle (critere 1). L'email saisi devient l'adresse
 * **titulaire**, active d'office (s54, criteres 2 et 5), d'origine fichier
 * pour l'import (cle Pennylane), sinon saisie sur le site. Sans email, la
 * fiche est « courrier uniquement » (critere 7).
 */
export const createMemberProfileService = async (
  input: CreateMemberProfileInput
): Promise<MemberProfileWriteResult> => {
  const parsed = createMemberProfileServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {confirmedAccountUserId, email, ...fields} = parsed.data
  const {organizationId} = fields
  const authUser = await requireMemberProfileManager(organizationId)
  const author = await authorOf(authUser)
  const now = new Date()

  return withTenant(organizationId, async () => {
    const holder = await findEmailHolder(organizationId, email, {
      memberProfileId: null,
      userIds: [],
    })
    const shared = confirmedHolder(holder, confirmedAccountUserId)
    if (shared.kind === 'ask' && holder) {
      return {status: 'email_shared', holder}
    }

    const {row} = await createMemberProfileTxnDao(fields)
    if (email !== null) {
      await insertMemberProfileEmailDao({
        organizationId,
        memberProfileId: row.id,
        email,
        role: MemberEmailRoleConst.HOLDER,
        status: MemberEmailStatusConst.ACTIVE,
        origin: row.pennylaneCustomerId
          ? MemberEmailOriginConst.FILE
          : MemberEmailOriginConst.SITE,
      })
    }
    const {change} = await applyMemberAccountDecision({
      organizationId,
      author,
      profile: {id: row.id, name: row.name, email, userId: null},
      decision: decideMemberAccount({
        savedEmail: null,
        nextEmail: email,
        linkedRole: null,
        previousAccountLinked: false,
        otherLinkedProfiles: 0,
        nextEmailAccountUserId:
          shared.kind === 'confirmed' ? shared.userId : null,
      }),
    })
    return {
      status: 'saved',
      profile: await readProfileView(
        authUser,
        organizationId,
        {...row, email, mailOnly: email === null},
        now
      ),
      accountChange: change,
    }
  })
}

/**
 * Met a jour adresse postale et telephone d'une fiche (critere 6 de s12).
 * Depuis s54, l'email n'en fait plus partie : il a sa carte.
 */
export const updateMemberProfileContactService = async (
  input: UpdateMemberProfileContactInput
): Promise<MemberProfileWriteResult> => {
  const parsed = updateMemberProfileContactServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, memberProfileId, ...contact} = parsed.data
  const authUser = await requireMemberProfileManager(organizationId)
  const now = new Date()

  return withTenant(organizationId, async () => {
    const result = await updateMemberProfileContactTxnDao(
      memberProfileId,
      contact
    )
    if (result.status === 'not_found') return {status: 'not_found'}
    const row = await getMemberProfileByIdDao(memberProfileId)
    if (!row) return {status: 'not_found'}
    return {
      status: 'saved',
      profile: await readProfileView(authUser, organizationId, row, now),
      accountChange: null,
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
  const now = new Date()

  return withTenant(parsed.data.organizationId, async () => {
    const row = await getMemberProfileByIdDao(parsed.data.memberProfileId)
    return row
      ? readProfileView(authUser, parsed.data.organizationId, row, now)
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

  const {organizationId, page, search, groupId} = parsed.data
  const authUser = await requireMemberProfileManager(organizationId)

  const [{rows, total}, counts, boardRoles] = await withTenant(
    organizationId,
    async () =>
      [
        await getMemberProfilePageDao({
          organizationId,
          search,
          groupId,
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
      boardRole: row.holderUserId
        ? (boardRoles.get(row.holderUserId) ?? null)
        : null,
      accountProfileCount: row.accountProfileCount,
      otherEmailCount: row.otherEmailCount,
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
