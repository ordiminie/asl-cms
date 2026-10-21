import 'server-only'

import {MemberProfileModel} from '@/db/models/member-profile-model'
import {
  countMemberProfilesDao,
  createMemberProfileTxnDao,
  getMemberProfileByEmailDao,
  getMemberProfileByIdDao,
  getMemberProfilePageDao,
  updateMemberProfileContactTxnDao,
} from '@/db/repositories/member-profile-repository'
import {getMemberAccountDao} from '@/db/repositories/organization-repository'
import {withTenant} from '@/db/tenant-scope'

import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {canReadMemberAccount} from './authorization/member-account-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {
  applyMemberAccountDecision,
  getLinkedAccountRole,
} from './member-account-service'
import {decideMemberAccount} from './rules/member-account-rules'
import {toMemberProfileDto} from './rules/member-profile-rules'
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  CreateMemberProfileInput,
  MEMBER_PROFILES_PAGE_SIZE,
  MemberProfileAccountDTO,
  MemberProfileDTO,
  MemberProfilePageDTO,
  MemberProfilePageInput,
  MemberProfileWriteResult,
  UpdateMemberProfileContactInput,
} from './types/domain/member-profile-types'
import {User} from './types/domain/user-types'
import {
  createMemberProfileServiceSchema,
  memberProfileOrganizationIdSchema,
  memberProfilePageServiceSchema,
  memberProfileServiceSchema,
  updateMemberProfileContactServiceSchema,
} from './validation/member-profile-validation'

/**
 * Fiches des proprietaires (s12, ADR 029). Chaque fonction : validation, puis
 * `member.profile.manage`, puis le repository sous le scope du tenant.
 *
 * Le compte d'une fiche suit son adresse (s12d, ADR 037) : l'ecriture de la
 * fiche et celle du compte tiennent dans le meme `withTenant`, par
 * `member-account-service`. Rien n'est envoye a l'ouverture.
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

/**
 * L'etat du compte d'une fiche (carte « Acces a l'espace membre ») : lecture
 * de l'appartenance d'un tiers, sous son `can*` (ADR 014).
 */
const readAccount = async (
  authUser: User | undefined,
  organizationId: string,
  userId: string | null
): Promise<MemberProfileAccountDTO> => {
  if (!canReadMemberAccount(authUser, organizationId)) {
    throw new AuthorizationError(MANAGE_DENIED)
  }
  if (userId === null) return {status: 'mail_only'}

  const account = await getMemberAccountDao(userId, organizationId)
  if (!account) return {status: 'mail_only'}
  return {
    status: 'open',
    loginEmail: account.email,
    boardRole: account.role === 'member' ? null : account.role,
  }
}

/** La fiche et l'etat de son compte, pour l'ecran. */
const toProfileWithAccount = async (
  authUser: User | undefined,
  organizationId: string,
  row: MemberProfileModel
): Promise<MemberProfileDTO> => ({
  ...toMemberProfileDto(row),
  account: await readAccount(authUser, organizationId, row.userId),
})

/** La fiche qui detient deja cet email, pour que l'ecran y renvoie. */
const emailTaken = async (
  organizationId: string,
  email: string | null
): Promise<MemberProfileWriteResult> => {
  const holder = email
    ? await getMemberProfileByEmailDao(organizationId, email)
    : undefined
  if (!holder) {
    throw new Error(
      'Email refusé comme déjà pris, mais aucune fiche ne le porte'
    )
  }
  return {status: 'email_taken', memberProfileId: holder.id}
}

const sortParcelNumbers = (numbers: string[]): string[] =>
  [...numbers].sort((a, b) => a.localeCompare(b, 'fr', {numeric: true}))

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

  const {organizationId} = parsed.data
  const authUser = await requireMemberProfileManager(organizationId)

  return withTenant(organizationId, async () => {
    const result = await createMemberProfileTxnDao(parsed.data)
    if (result.status === 'email_taken') {
      return emailTaken(organizationId, parsed.data.email)
    }
    const {row} = result
    const {change, userId} = await applyMemberAccountDecision({
      organizationId,
      profile: row,
      decision: decideMemberAccount({
        savedEmail: null,
        nextEmail: row.email,
        linkedRole: null,
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

  const {organizationId, memberProfileId, ...contact} = parsed.data
  const authUser = await requireMemberProfileManager(organizationId)

  return withTenant(organizationId, async () => {
    const saved = await getMemberProfileByIdDao(memberProfileId)
    if (!saved) return {status: 'not_found'}

    const decision = decideMemberAccount({
      savedEmail: saved.email,
      nextEmail: contact.email,
      linkedRole: await getLinkedAccountRole(organizationId, saved.userId),
    })
    if (decision.kind === 'refuse_board_removal') {
      return {status: 'board_email_required'}
    }

    const result = await updateMemberProfileContactTxnDao(
      memberProfileId,
      contact
    )
    if (result.status === 'not_found') return {status: 'not_found'}
    if (result.status === 'email_taken') {
      return emailTaken(organizationId, contact.email)
    }
    const {change, userId} = await applyMemberAccountDecision({
      organizationId,
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
  await requireMemberProfileManager(organizationId)

  const [{rows, total}, counts] = await withTenant(
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
      ] as const
  )

  return {
    items: rows.map((row) => ({
      ...toMemberProfileDto(row),
      currentParcelNumbers: sortParcelNumbers(row.currentParcelNumbers),
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
