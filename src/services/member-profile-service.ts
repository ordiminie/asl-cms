import 'server-only'

import {
  countMemberProfilesDao,
  createMemberProfileTxnDao,
  getMemberProfileByEmailDao,
  getMemberProfileByIdDao,
  getMemberProfilePageDao,
  updateMemberProfileContactTxnDao,
} from '@/db/repositories/member-profile-repository'
import {withTenant} from '@/db/tenant-scope'

import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {toMemberProfileDto} from './rules/member-profile-rules'
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  CreateMemberProfileInput,
  MEMBER_PROFILES_PAGE_SIZE,
  MemberProfileDTO,
  MemberProfilePageDTO,
  MemberProfilePageInput,
  MemberProfileWriteResult,
  UpdateMemberProfileContactInput,
} from './types/domain/member-profile-types'
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
 * s12 n'ouvre ni ne ferme aucun compte : aucun appel a `user`, a `member` ni a
 * un service de compte (s12d).
 */

const MANAGE_DENIED =
  "Seul le bureau de l'association peut gérer les fiches des propriétaires"

const requireMemberProfileManager = async (
  organizationId: string
): Promise<void> => {
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
}

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
  await requireMemberProfileManager(organizationId)

  return withTenant(organizationId, async () => {
    const result = await createMemberProfileTxnDao(parsed.data)
    if (result.status === 'email_taken') {
      return emailTaken(organizationId, parsed.data.email)
    }
    return {status: 'saved', profile: toMemberProfileDto(result.row)}
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
  await requireMemberProfileManager(organizationId)

  return withTenant(organizationId, async () => {
    const result = await updateMemberProfileContactTxnDao(
      memberProfileId,
      contact
    )
    if (result.status === 'not_found') return {status: 'not_found'}
    if (result.status === 'email_taken') {
      return emailTaken(organizationId, contact.email)
    }
    return {status: 'saved', profile: toMemberProfileDto(result.row)}
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

  await requireMemberProfileManager(parsed.data.organizationId)

  const row = await withTenant(parsed.data.organizationId, () =>
    getMemberProfileByIdDao(parsed.data.memberProfileId)
  )
  return row ? toMemberProfileDto(row) : undefined
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
