import {
  createOrganizationDao,
  createOrganizationMemberDao,
  deleteInvitationByIdDao,
  deleteOrganizationDao,
  deleteUserInvitationsDao,
  deleteUserOrganizationDao,
  getAllOrganizationsWithPaginationDao,
  getInvitationMembersDao,
  getMembersDao,
  getOrganizationByIdDao,
  getOrganizationBySlugDao,
  getOrganizationMembersDao,
  getOrganizationsByUserIdDao,
  getOrganizationsDao,
  getUserInvitationsDao,
  getUserOrganizationDao,
  getUserRoleInOrganizationDao,
  searchOrganizationsWithMemberEmailsDao,
  updateOrganizationDao,
  updateUserOrganizationRoleDao,
} from '@/db/repositories/organization-repository'
import {getAuthUser} from '@/services/authentication/auth-service'

import {
  canChangeOrganizationMemberRole,
  canCreateOrganization,
  canDeleteInvitation,
  canDeleteOrganization,
  canInviteToOrganization,
  canReadOrganization,
  canReadOrganizationMember,
  canRemoveFromOrganization,
  canSearchOrganizationsForAdmin,
  canUpdateOrganization,
  canUpdateOrganizationLimitOverrides,
} from './authorization/organization-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {
  ValidationError,
  ValidationParsedZodError,
} from './errors/validation-error'
import {Pagination} from './types/common-type'
import {UserOrganizationRoleConst} from './types/domain/auth-types'
import {
  CreateMember,
  CreateOrganization,
  InvitationWithUser,
  MemberOrInvitationDTO,
  OrganizationRole,
  OrganizationSearchResult,
  UpdateOrganization,
} from './types/domain/organization-types'
import {uuidSchema} from './validation/common-validation'
import {
  createOrganizationServiceSchema,
  createUserOrganizationServiceSchema,
  organizationRoleSchema,
  organizationUuidSchema,
  updateOrganizationServiceSchema,
  userUuidSchema,
} from './validation/organization-validation'

// ===== CRUD ORGANIZATIONS =====

export const createOrganizationService = async (
  organizationParams: CreateOrganization
) => {
  const granted = await canCreateOrganization()
  if (!granted) {
    throw new AuthorizationError()
  }

  const parsed = createOrganizationServiceSchema.safeParse(organizationParams)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }
  const organizationParamsSanitized = parsed.data

  // Créer l'organisation
  const organization = await createOrganizationDao(organizationParamsSanitized)

  // Ajouter le créateur comme OWNER
  const authUser = await getAuthUser()
  if (authUser?.id) {
    await createOrganizationMemberDao({
      userId: authUser.id,
      organizationId: organization.id,
      role: UserOrganizationRoleConst.OWNER,
      createdAt: new Date(),
    })
  }

  return organization
}

export const getOrganizationByIdService = async (id: string) => {
  const parsed = organizationUuidSchema.safeParse(id)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const parsedUuid = parsed.data

  const granted = await canReadOrganization(parsedUuid)
  if (!granted) {
    throw new AuthorizationError()
  }

  return await getOrganizationByIdDao(parsedUuid)
}

export const getOrganizationBySlugService = async (slug: string) => {
  const parsed = createOrganizationServiceSchema
    .pick({slug: true})
    .safeParse({slug})
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const slugSanitized = parsed.data.slug

  const organization = await getOrganizationBySlugDao(slugSanitized)
  if (!organization) {
    return
  }

  const granted = await canReadOrganization(organization.id)
  if (!granted) {
    throw new AuthorizationError()
  }

  return organization
}

export const updateOrganizationService = async (
  organizationParams: UpdateOrganization
) => {
  const resourceId = organizationParams.id
  const granted = await canUpdateOrganization(resourceId)
  if (!granted) {
    throw new AuthorizationError()
  }

  if (organizationParams.limitOverrides !== undefined) {
    const canUpdateLimits = await canUpdateOrganizationLimitOverrides()
    if (!canUpdateLimits) {
      throw new AuthorizationError('Only admins can update limit overrides')
    }
  }

  organizationParams.updatedAt = new Date()
  const parsed = updateOrganizationServiceSchema.safeParse(organizationParams)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const organizationParamsSanitized = parsed.data
  await updateOrganizationDao(organizationParamsSanitized)
}

export const deleteOrganizationService = async (id: string) => {
  const parsed = organizationUuidSchema.safeParse(id)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const parsedUuid = parsed.data

  const granted = await canDeleteOrganization(parsedUuid)
  if (!granted) {
    throw new AuthorizationError()
  }

  await deleteOrganizationDao(parsedUuid)
}

export const getOrganizationsService = async (pagination: Pagination) => {
  return await getOrganizationsDao(pagination)
}

export const getAllOrganizationsWithPaginationService = async (
  pagination: Pagination,
  search?: string
) => {
  // Pour l'administration, on utilise directement le DAO avec recherche
  // TODO: Ajouter une vérification d'autorisation admin si nécessaire
  return await getAllOrganizationsWithPaginationDao(pagination, search)
}

// ===== USER ORGANIZATIONS MANAGEMENT =====

export const getUserOrganizationsService = async (userId?: string) => {
  const authUser = await getAuthUser()
  const targetUserId = userId || authUser?.id

  if (!targetUserId) {
    throw new AuthorizationError()
  }

  const parsed = userUuidSchema.safeParse(targetUserId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const parsedUuid = parsed.data

  return await getMembersDao(parsedUuid)
}

export const getOrganizationsByUserIdService = async (userId?: string) => {
  const authUser = await getAuthUser()
  const targetUserId = userId || authUser?.id

  if (!targetUserId) {
    throw new AuthorizationError()
  }

  const parsed = userUuidSchema.safeParse(targetUserId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const parsedUuid = parsed.data

  return await getOrganizationsByUserIdDao(parsedUuid)
}

export const getOrganizationMembersService = async (organizationId: string) => {
  const parsed = organizationUuidSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const parsedUuid = parsed.data

  const granted = await canReadOrganizationMember(parsedUuid)
  if (!granted) {
    throw new AuthorizationError()
  }

  return await getOrganizationMembersDao(parsedUuid)
}

export const createOrganizationMemberService = async (
  userOrganizationParams: CreateMember
) => {
  const parsed = createUserOrganizationServiceSchema.safeParse(
    userOrganizationParams
  )
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }
  const params = parsed.data

  const granted = await canInviteToOrganization(params.organizationId)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Vérifier si l'utilisateur n'est pas déjà membre
  const existingMembership = await getUserOrganizationDao(
    params.userId,
    params.organizationId
  )
  if (existingMembership) {
    throw new ValidationError(
      "L'utilisateur est déjà membre de cette organisation"
    )
  }

  return await createOrganizationMemberDao(params)
}

export const removeUserFromOrganizationService = async (
  userId: string,
  organizationId: string
) => {
  const userParsed = userUuidSchema.safeParse(userId)
  const orgParsed = organizationUuidSchema.safeParse(organizationId)

  if (!userParsed.success) {
    throw new ValidationError(userParsed.error.message)
  }
  if (!orgParsed.success) {
    throw new ValidationError(orgParsed.error.message)
  }

  const userIdSanitized = userParsed.data
  const organizationIdSanitized = orgParsed.data

  const granted = await canRemoveFromOrganization(
    organizationIdSanitized,
    userIdSanitized
  )
  if (!granted) {
    throw new AuthorizationError()
  }

  // Empêcher la suppression du OWNER
  const membership = await getUserOrganizationDao(
    userIdSanitized,
    organizationIdSanitized
  )
  if (membership?.role === UserOrganizationRoleConst.OWNER) {
    throw new AuthorizationError(
      "Le propriétaire (OWNER) ne peut pas se retirer lui-même de l'organisation."
    )
  }

  await deleteUserOrganizationDao(userIdSanitized, organizationIdSanitized)
}

export const changeUserOrganizationRoleService = async (
  userId: string,
  organizationId: string,
  role: OrganizationRole
) => {
  const userParsed = userUuidSchema.safeParse(userId)
  const orgParsed = organizationUuidSchema.safeParse(organizationId)
  const roleParsed = organizationRoleSchema.safeParse(role)

  if (!userParsed.success) {
    throw new ValidationError(userParsed.error.message)
  }
  if (!orgParsed.success) {
    throw new ValidationError(orgParsed.error.message)
  }
  if (!roleParsed.success) {
    throw new ValidationError(roleParsed.error.message)
  }

  const userIdSanitized = userParsed.data
  const organizationIdSanitized = orgParsed.data
  const roleSanitized = roleParsed.data

  const granted = await canChangeOrganizationMemberRole(
    organizationIdSanitized,
    userIdSanitized
  )
  if (!granted) {
    throw new AuthorizationError()
  }

  await updateUserOrganizationRoleDao(
    userIdSanitized,
    organizationIdSanitized,
    roleSanitized
  )
}

export const getUserRoleInOrganizationService = async (
  userId: string,
  organizationId: string
) => {
  const userParsed = userUuidSchema.safeParse(userId)
  const orgParsed = organizationUuidSchema.safeParse(organizationId)

  if (!userParsed.success) {
    throw new ValidationError(userParsed.error.message)
  }
  if (!orgParsed.success) {
    throw new ValidationError(orgParsed.error.message)
  }

  const userIdSanitized = userParsed.data
  const organizationIdSanitized = orgParsed.data

  const granted = await canReadOrganization(organizationIdSanitized)
  if (!granted) {
    throw new AuthorizationError()
  }

  return await getUserRoleInOrganizationDao(
    userIdSanitized,
    organizationIdSanitized
  )
}

export const getInvitationMembersService = async (
  organizationId: string
): Promise<InvitationWithUser[]> => {
  const parsed = organizationUuidSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const organizationIdSanitized = parsed.data

  const granted = await canReadOrganizationMember(organizationIdSanitized)
  if (!granted) {
    throw new AuthorizationError()
  }

  return await getInvitationMembersDao(organizationIdSanitized)
}

export async function getMembersAndInvitationsService(
  organizationId: string
): Promise<MemberOrInvitationDTO[]> {
  const [members, invitations] = await Promise.all([
    getOrganizationMembersService(organizationId),
    getInvitationMembersService(organizationId),
  ])

  const memberDTOs = members.map((m) => {
    if (!m.user) {
      throw new Error('User data missing from organization member')
    }
    return {
      memberId: m.id,
      userId: m.user.id,
      invitationId: null,
      organizationId: m.organizationId,
      name: m.user.name,
      email: m.user.email,
      image: m.user.image ?? null,
      role: m.role,
      joinedAt: m.createdAt,
      status: 'member' as const,
    }
  })

  const invitationDTOs = invitations.map((i) => ({
    memberId: null,
    userId: i.user?.id ?? '',
    invitationId: i.id,
    organizationId: i.organizationId,
    name: i.user?.name ?? null,
    email: i.email,
    image: i.user?.image ?? null,
    role: i.role,
    joinedAt: i.expiresAt,
    status: 'invited' as const,
  }))

  return [...memberDTOs, ...invitationDTOs]
}

export const getUserInvitationsService = async (): Promise<
  InvitationWithUser[]
> => {
  const authUser = await getAuthUser()
  if (!authUser?.email) {
    throw new AuthorizationError()
  }

  const invitations = await getUserInvitationsDao(authUser.email)

  // Transformer pour correspondre au type InvitationWithUser
  return invitations.map((invitation) => ({
    ...invitation,
    user: authUser, // L'utilisateur connecté est celui qui a reçu l'invitation
  }))
}

export const deleteUserInvitationsService = async (userId: string) => {
  const parsed = userUuidSchema.safeParse(userId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const userIdSanitized = parsed.data

  await deleteUserInvitationsDao(userIdSanitized)
}

export const deleteInvitationByIdService = async (invitationId: string) => {
  const granted = await canDeleteInvitation()
  if (!granted) {
    throw new AuthorizationError()
  }

  const parsed = uuidSchema.safeParse(invitationId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const invitationIdSanitized = parsed.data

  await deleteInvitationByIdDao(invitationIdSanitized)
}

// ========================================
// USAGE FUNCTIONS
// ========================================

import {
  AdminUsageStats,
  getAdminUsageStatsDao,
  PlanLimits,
} from '@/db/repositories/subscription-repository'

import {canManageUsers} from './authorization/user-authorization'

export interface AdminUserOrganizationWithUsage {
  id: string
  name: string
  slug: string | null
  logo: string | null
  role: string
  usage: AdminUsageStats
}

export const getOrganizationUsageService = async (
  organizationId: string
): Promise<AdminUsageStats> => {
  const parsed = organizationUuidSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const parsedUuid = parsed.data

  const granted = await canReadOrganization(parsedUuid)
  if (!granted) {
    throw new AuthorizationError()
  }

  return await getAdminUsageStatsDao(parsedUuid)
}

export const getUserOrganizationsWithUsageService = async (): Promise<
  AdminUserOrganizationWithUsage[]
> => {
  const authUser = await getAuthUser()
  if (!authUser?.id) {
    throw new AuthorizationError()
  }

  const organizations = await getOrganizationsByUserIdDao(authUser.id)

  const orgsWithUsage = await Promise.all(
    organizations.map(async (org) => {
      const usage = await getAdminUsageStatsDao(org.id)
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo: org.logo,
        role: org.role,
        usage,
      }
    })
  )

  return orgsWithUsage
}

export const getAdminUserOrganizationsWithUsageService = async (
  userId: string
): Promise<AdminUserOrganizationWithUsage[]> => {
  const canManage = await canManageUsers()
  if (!canManage) {
    throw new AuthorizationError()
  }

  const parsed = userUuidSchema.safeParse(userId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const userIdSanitized = parsed.data

  const organizations = await getOrganizationsByUserIdDao(userIdSanitized)

  const orgsWithUsage = await Promise.all(
    organizations.map(async (org) => {
      const usage = await getAdminUsageStatsDao(org.id)
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo: org.logo,
        role: org.role,
        usage,
      }
    })
  )

  return orgsWithUsage
}

export type {AdminUsageStats, PlanLimits}

/**
 * Search organizations by name or member email (admin only)
 * Returns organizations with their member emails for display
 */
export const searchOrganizationsForAdminService = async (
  searchTerm: string
): Promise<OrganizationSearchResult[]> => {
  if (!searchTerm || searchTerm.trim().length < 2) {
    return []
  }

  const canSearch = await canSearchOrganizationsForAdmin()
  if (!canSearch) {
    return []
  }

  return await searchOrganizationsWithMemberEmailsDao(searchTerm.trim(), 10)
}

// ========================================
// PROVISIONING (s01)
// ========================================

import {
  getOrganizationByDomainDao,
  updateOrganizationModulesDao,
} from '@/db/repositories/organization-repository'
import {upsertOrganizationSettingsDao} from '@/db/repositories/organization-setting-repository'
import {
  createUserDao,
  getUserByEmailDao,
} from '@/db/repositories/user-repository'
import {withTenant} from '@/db/tenant-scope'

import {canProvisionOrganization} from './authorization/organization-authorization'
import {CONTACT_EMAIL_SETTING_KEY} from './types/domain/association-settings-types'
import {
  Organization,
  OrganizationModule,
} from './types/domain/organization-types'
import {
  organizationDomainSchema,
  provisionOrganizationServiceSchema,
  updateOrganizationModulesServiceSchema,
} from './validation/organization-validation'

export type ProvisionOrganization = {
  name: string
  slug: string
  domain: string
  adminEmail: string
  /** Adresse de contact de l'association : obligatoire (s02, critere 5). */
  contactEmail: string
  enabledModules: OrganizationModule[]
}

export type ProvisionedOrganization = {
  organization: Organization
  adminUserId: string
  /** Vrai quand s01 a du creer le compte ; faux quand il existait deja. */
  adminAccountCreated: boolean
}

/**
 * Resout l'association servie par un domaine (ADR 003).
 *
 * **Sans controle d'autorisation, et c'est deliberé** : cette lecture repond a
 * « quel site sert ce domaine », question posee a chaque requete **avant**
 * toute session — c'est elle qui determine le tenant. Le nom et l'identifiant
 * d'une association sont publics par construction, puisque son site l'est.
 */
export const getOrganizationByDomainService = async (
  domain: string
): Promise<Organization | undefined> => {
  const parsed = organizationDomainSchema.safeParse(domain)
  if (!parsed.success) {
    return undefined
  }

  return await getOrganizationByDomainDao(parsed.data)
}

/**
 * Provisionne une association : le tenant, ses modules, son administrateur
 * initial designe **par email**, et son adresse de contact (s02).
 *
 * Modele canonique de la couche service (`docs/architecture.md`) : l'ordre est
 * `safeParse` -> `can*` -> repository. Les fonctions plus anciennes de ce
 * fichier font l'inverse ; ne pas les recopier.
 *
 * s01 **n'envoie aucun email** : le lien de connexion appartient a s03, seule
 * story a connaitre l'adaptateur Brevo. Un second chemin d'envoi ici devrait
 * etre remplace par s03.
 */
export const provisionOrganizationService = async (
  params: ProvisionOrganization
): Promise<ProvisionedOrganization> => {
  const parsed = provisionOrganizationServiceSchema.safeParse(params)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const granted = await canProvisionOrganization()
  if (!granted) {
    throw new AuthorizationError(
      'Seul le SuperAdmin Zourite Studio peut provisionner une association'
    )
  }

  const {name, slug, domain, adminEmail, contactEmail, enabledModules} =
    parsed.data

  const occupant = await getOrganizationByDomainDao(domain)
  if (occupant) {
    throw new ValidationError(
      `Ce domaine sert déjà l'association « ${occupant.name} ». Un domaine ne peut servir qu'une association.`
    )
  }

  const organization = await createOrganizationDao({
    name,
    slug,
    domain,
    enabledModules,
  })

  const existingAdmin = await getUserByEmailDao(adminEmail)
  const admin =
    existingAdmin ??
    (await createUserDao({
      email: adminEmail,
      // Le nom est obligatoire en base et s01 ne le demande pas : l'adresse en
      // tient lieu jusqu'a ce que l'administrateur complete son profil.
      name: adminEmail,
    }))

  await createOrganizationMemberDao({
    userId: admin.id,
    organizationId: organization.id,
    role: UserOrganizationRoleConst.OWNER,
    createdAt: new Date(),
  })

  // Parametre obligatoire sans defaut neutre (ADR 016) : saisi a la creation,
  // ecrit sous le scope du nouveau tenant.
  await withTenant(organization.id, () =>
    upsertOrganizationSettingsDao([
      {
        organizationId: organization.id,
        key: CONTACT_EMAIL_SETTING_KEY,
        value: contactEmail,
      },
    ])
  )

  return {
    organization,
    adminUserId: admin.id,
    adminAccountCreated: !existingAdmin,
  }
}

/**
 * Active ou desactive les modules d'une association (ADR 010). Les cles sont
 * validees contre l'enumere : une cle inconnue est refusee, jamais persistee.
 */
export const updateOrganizationModulesService = async (
  organizationId: string,
  enabledModules: OrganizationModule[]
): Promise<void> => {
  const parsed = updateOrganizationModulesServiceSchema.safeParse({
    organizationId,
    enabledModules,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const granted = await canProvisionOrganization()
  if (!granted) {
    throw new AuthorizationError(
      'Seul le SuperAdmin Zourite Studio peut activer un module'
    )
  }

  await updateOrganizationModulesDao(
    parsed.data.organizationId,
    parsed.data.enabledModules
  )
}
