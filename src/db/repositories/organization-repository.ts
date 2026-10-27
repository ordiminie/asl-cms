import {and, count, eq, inArray, ne, or, sql} from 'drizzle-orm'

import {
  invitation,
  member,
  organization as organizations,
  user,
} from '@/db/models/auth-model'
import {
  AddMemberModel,
  AddOrganizationModel,
  MemberModel,
  OrganizationIdentityKindModel,
  OrganizationModel,
  OrganizationModuleEnumModel,
  OrganizationRoleEnumModel,
  UpdateOrganizationModel,
} from '@/db/models/organization-model'
import {getDb} from '@/db/tenant-scope'
import {generateSlug} from '@/lib/helper/common-helper'
import {PaginatedResponse, Pagination} from '@/services/types/common-type'
import {
  Invitation,
  InvitationStatus,
  MemberData,
} from '@/services/types/domain/organization-types'

import {UserModel} from '../models/user-model'

/**
 * Génère un slug unique pour une organisation
 * @param name Le nom de l'organisation
 * @returns Un slug unique basé sur le nom
 */
export const generateUniqueSlug = async (name: string): Promise<string> => {
  // Fonction pour générer un slug à partir d'un nom

  // Générer le premier slug
  let slug = generateSlug(name)
  let attempts = 0
  const maxAttempts = 10 // Limite de tentatives pour éviter une boucle infinie

  // Vérifier si le slug existe déjà
  while (attempts < maxAttempts) {
    const existingOrg = await getOrganizationBySlugDao(slug)
    if (!existingOrg) {
      return slug
    }
    slug = generateSlug(name)
    attempts++
  }

  // Si on n'a pas trouvé de slug unique après maxAttempts, on ajoute un timestamp
  return `${generateSlug(name)}-${Date.now()}`
}

// ===== CRUD ORGANIZATIONS =====

export const createOrganizationDao = async (
  organization: AddOrganizationModel
): Promise<OrganizationModel> => {
  const row = await getDb()
    .insert(organizations)
    .values(organization)
    .returning()
  return row[0]
}

export const getOrganizationByIdDao = async (
  id: string
): Promise<OrganizationModel | undefined> => {
  const row = await getDb().query.organization.findFirst({
    where: (organization, {eq}) => eq(organization.id, id),
  })
  return row
}

export const getOrganizationBySlugDao = async (
  slug: string
): Promise<OrganizationModel | undefined> => {
  const row = await getDb().query.organization.findFirst({
    where: (organization, {eq}) => eq(organization.slug, slug),
  })
  return row
}

export const updateOrganizationDao = async (
  organization: UpdateOrganizationModel
): Promise<void> => {
  if (!organization.id) {
    throw new Error('Organization ID is required')
  }
  await getDb()
    .update(organizations)
    .set({...organization, updatedAt: new Date()})
    .where(eq(organizations.id, organization.id))
}

export const deleteOrganizationDao = async (id: string): Promise<void> => {
  await getDb().delete(organizations).where(eq(organizations.id, id))
}

export const getOrganizationsDao = async (
  pagination: Pagination
): Promise<PaginatedResponse<OrganizationModel>> => {
  const [rows, [{count}]] = await Promise.all([
    getDb()
      .select()
      .from(organizations)
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy(organizations.createdAt),
    getDb()
      .select({count: sql<number>`count(*)`})
      .from(organizations),
  ])

  const page = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = Math.ceil(count / pagination.limit)

  return {
    data: rows.length === 0 ? [] : rows,
    pagination: {
      total: count,
      page: page,
      limit: pagination.limit,
      totalPages: totalPages,
    },
  }
}

export const getAllOrganizationsWithPaginationDao = async (
  pagination: Pagination,
  search?: string
): Promise<PaginatedResponse<OrganizationModel>> => {
  // Construire la clause WHERE pour la recherche
  let searchCondition
  if (search && search.trim()) {
    const searchTerm = search.trim()
    searchCondition = or(
      sql`${organizations.name} ILIKE ${`%${searchTerm}%`}`,
      sql`${organizations.slug} ILIKE ${`%${searchTerm}%`}`,
      sql`${organizations.description} ILIKE ${`%${searchTerm}%`}`
    )
  }

  // Récupérer les organisations avec recherche
  const [rows, [{count}]] = await Promise.all([
    getDb()
      .select()
      .from(organizations)
      .where(searchCondition)
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy(sql`${organizations.createdAt} DESC`),
    getDb()
      .select({count: sql<number>`count(*)`})
      .from(organizations)
      .where(searchCondition),
  ])

  const page = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = Math.ceil(count / pagination.limit)

  return {
    data: rows.length === 0 ? [] : rows,
    pagination: {
      total: count,
      page: page,
      limit: pagination.limit,
      totalPages: totalPages,
    },
  }
}

// ===== CRUD USER-ORGANIZATIONS =====

export const createOrganizationMemberDao = async (
  userOrganization: AddMemberModel
): Promise<MemberModel> => {
  const row = await getDb().insert(member).values(userOrganization).returning()
  return row[0]
}

export const getUserOrganizationDao = async (
  userId: string,
  organizationId: string
): Promise<MemberModel | undefined> => {
  const row = await getDb().query.member.findFirst({
    where: (userOrg, {eq, and}) =>
      and(
        eq(userOrg.userId, userId),
        eq(userOrg.organizationId, organizationId)
      ),
  })
  return row
}

export const updateUserOrganizationRoleDao = async (
  userId: string,
  organizationId: string,
  role: OrganizationRoleEnumModel
): Promise<void> => {
  await getDb()
    .update(member)
    .set({role})
    .where(
      and(eq(member.userId, userId), eq(member.organizationId, organizationId))
    )
}

export const deleteUserOrganizationDao = async (
  userId: string,
  organizationId: string
): Promise<void> => {
  await getDb()
    .delete(member)
    .where(
      and(eq(member.userId, userId), eq(member.organizationId, organizationId))
    )
}

// ===== REQUÊTES SPÉCIALISÉES =====

export const getMembersDao = async (userId: string): Promise<MemberModel[]> => {
  const rows = await getDb().query.member.findMany({
    where: (member, {eq}) => eq(member.userId, userId),
    with: {
      organization: true,
    },
  })
  return rows
}

export const getOrganizationMembersDao = async (
  organizationId: string
): Promise<MemberData[]> => {
  const rows = await getDb().query.member.findMany({
    where: (userOrg, {eq}) => eq(userOrg.organizationId, organizationId),
    with: {
      user: true,
    },
  })
  return rows
}

export const getOrganizationsByUserIdDao = async (
  userId: string
): Promise<(OrganizationModel & {role: OrganizationRoleEnumModel})[]> => {
  const rows = await getDb()
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      description: organizations.description,
      logo: organizations.logo,
      metadata: organizations.metadata,
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,
      limitOverrides: organizations.limitOverrides,
      domain: organizations.domain,
      enabledModules: organizations.enabledModules,
      identityLogoKey: organizations.identityLogoKey,
      identityFaviconKey: organizations.identityFaviconKey,
      role: member.role,
    })
    .from(organizations)
    .innerJoin(member, eq(organizations.id, member.organizationId))
    .where(eq(member.userId, userId))
    .orderBy(organizations.name)

  return rows
}

export const getInvitationMembersDao = async (
  organizationId: string
): Promise<(Invitation & {user: UserModel | null})[]> => {
  const rows = await getDb().query.invitation.findMany({
    where: (invitation, {eq, and}) =>
      and(
        eq(invitation.organizationId, organizationId),
        eq(invitation.status, 'pending')
      ),
    with: {
      inviter: true,
    },
  })

  const invitationsWithUsers = await Promise.all(
    rows.map(async (invitation) => {
      const user = await getDb().query.user.findFirst({
        where: (user, {eq}) => eq(user.email, invitation.email),
      })
      return {
        ...invitation,
        user: user ?? null,
      }
    })
  )

  return invitationsWithUsers
}

export const getUserRoleInOrganizationDao = async (
  userId: string,
  organizationId: string
): Promise<OrganizationRoleEnumModel | null> => {
  const row = await getDb().query.member.findFirst({
    where: (userOrg, {eq, and}) =>
      and(
        eq(userOrg.userId, userId),
        eq(userOrg.organizationId, organizationId)
      ),
    columns: {
      role: true,
    },
  })
  return row?.role || null
}

export const getUserInvitationsDao = async (
  userEmail: string,
  status?: InvitationStatus
): Promise<
  (Invitation & {organization: OrganizationModel; inviter: UserModel})[]
> => {
  const rows = await getDb().query.invitation.findMany({
    where: (invitation, {eq, and}) => {
      const conditions = [eq(invitation.email, userEmail)]
      if (status) {
        conditions.push(eq(invitation.status, status))
      }
      return and(...conditions)
    },
    with: {
      organization: true,
      inviter: true,
    },
  })

  return rows
}

export const deleteUserInvitationsDao = async (
  userId: string
): Promise<void> => {
  await getDb().delete(invitation).where(eq(invitation.inviterId, userId))
}

export const deleteInvitationByIdDao = async (
  invitationId: string
): Promise<void> => {
  await getDb().delete(invitation).where(eq(invitation.id, invitationId))
}

// ===== ADMIN SEARCH =====

export type OrganizationWithMembersSearchResult = {
  id: string
  name: string
  slug: string | null
  logo: string | null
  memberEmails: string[]
}

export const searchOrganizationsWithMemberEmailsDao = async (
  searchTerm: string,
  limit: number = 10
): Promise<OrganizationWithMembersSearchResult[]> => {
  const searchPattern = `%${searchTerm}%`

  const rows = await getDb()
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      logo: organizations.logo,
      memberEmails: sql<
        string[]
      >`COALESCE(ARRAY_AGG(DISTINCT ${user.email}) FILTER (WHERE ${user.email} IS NOT NULL), ARRAY[]::text[])`,
    })
    .from(organizations)
    .leftJoin(member, eq(organizations.id, member.organizationId))
    .leftJoin(user, eq(member.userId, user.id))
    .where(
      or(
        sql`${organizations.name} ILIKE ${searchPattern}`,
        sql`${user.email} ILIKE ${searchPattern}`
      )
    )
    .groupBy(
      organizations.id,
      organizations.name,
      organizations.slug,
      organizations.logo
    )
    .limit(limit)

  return rows
}

/**
 * Resout l'association servie par un domaine (ADR 003). La colonne est unique,
 * donc au plus une ligne. Le domaine est attendu **normalise** (minuscules,
 * sans port) : c'est `normalizeTenantHost` qui s'en charge, en amont.
 */
export const getOrganizationByDomainDao = async (
  domain: string
): Promise<OrganizationModel | undefined> => {
  const row = await getDb().query.organization.findFirst({
    where: (organization, {eq}) => eq(organization.domain, domain),
  })
  return row
}

/** Remplace les drapeaux de modules d'une association (ADR 010). */
export const updateOrganizationModulesDao = async (
  organizationId: string,
  enabledModules: OrganizationModuleEnumModel[]
): Promise<void> => {
  await getDb()
    .update(organizations)
    .set({enabledModules, updatedAt: new Date()})
    .where(eq(organizations.id, organizationId))
}

/**
 * Remplace la cle de stockage du logo ou du favicon d'une association
 * (ADR 015). `null` retire la reference.
 */
export const updateOrganizationIdentityKeyDao = async (
  organizationId: string,
  kind: OrganizationIdentityKindModel,
  key: string | null
): Promise<void> => {
  const reference =
    kind === 'logo' ? {identityLogoKey: key} : {identityFaviconKey: key}
  await getDb()
    .update(organizations)
    .set({...reference, updatedAt: new Date()})
    .where(eq(organizations.id, organizationId))
}

/**
 * Identifiants de toutes les associations. `organization` est exemptee de RLS
 * (ADR 002) : elle se lit hors de tout scope, sans `withRlsBypass()`.
 */
export const getAllOrganizationIdsDao = async (): Promise<string[]> => {
  const rows = await getDb()
    .select({id: organizations.id})
    .from(organizations)
    .orderBy(organizations.createdAt)
  return rows.map(({id}) => id)
}

/** Violation d'unicite, sur l'erreur de Drizzle ou sur sa cause. */
const isUniqueViolation = (error: unknown): boolean =>
  [error, (error as {cause?: unknown})?.cause].some(
    (candidate) => (candidate as {code?: string})?.code === '23505'
  )

/**
 * Pose la ligne `member` d'un compte s'il n'en a pas dans l'association, et
 * rend la ligne en place (s12d, ADR 037). Un role existant n'est jamais
 * touche. Point de sauvegarde : une insertion concurrente relit l'existant.
 */
export const createMemberIfAbsentTxnDao = async (
  row: AddMemberModel
): Promise<MemberModel> => {
  const existing = await getUserOrganizationDao(row.userId, row.organizationId)
  if (existing) return existing

  try {
    return await getDb().transaction(async (tx) => {
      const [created] = await tx.insert(member).values(row).returning()
      return created
    })
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    const raced = await getUserOrganizationDao(row.userId, row.organizationId)
    if (!raced) throw error
    return raced
  }
}

/**
 * Retire la ligne `member` d'un compte dans l'association **seulement si son
 * role est celui attendu** : la condition est portee par la requete, pour
 * qu'une fermeture ne retire jamais un role du bureau change entre-temps.
 */
export const deleteMemberWithRoleDao = async (
  userId: string,
  organizationId: string,
  role: OrganizationRoleEnumModel
): Promise<void> => {
  await getDb()
    .delete(member)
    .where(
      and(
        eq(member.userId, userId),
        eq(member.organizationId, organizationId),
        eq(member.role, role)
      )
    )
}

/**
 * Change le role d'une ligne `member` seulement s'il vaut encore `from`, et
 * rend le nombre de lignes touchees (s14) : zero dit qu'un changement
 * concurrent est passe avant.
 */
export const updateMemberRoleFromDao = async (
  userId: string,
  organizationId: string,
  from: OrganizationRoleEnumModel,
  to: OrganizationRoleEnumModel
): Promise<number> => {
  const rows = await getDb()
    .update(member)
    .set({role: to})
    .where(
      and(
        eq(member.userId, userId),
        eq(member.organizationId, organizationId),
        eq(member.role, from)
      )
    )
    .returning({id: member.id})
  return rows.length
}

/**
 * L'adresse de connexion et le role d'un compte dans une association, ou
 * rien s'il n'y a plus de ligne `member` (s12d). Lecture d'appartenance d'un
 * tiers : l'appelant porte son `can*` (ADR 014).
 */
export const getMemberAccountDao = async (
  userId: string,
  organizationId: string
): Promise<{email: string; role: OrganizationRoleEnumModel} | undefined> => {
  const [row] = await getDb()
    .select({email: user.email, role: member.role})
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(eq(member.userId, userId), eq(member.organizationId, organizationId))
    )
  return row
}

const CAPABLE_ROLES: OrganizationRoleEnumModel[] = ['owner', 'board']

/**
 * Serialise les changements de role d'une association (s14, ADR 039) : verrou
 * consultatif transactionnel, tenu jusqu'a la fin de la transaction de
 * `withTenant`. A prendre avant le decompte des comptes capables.
 */
export const lockOrganizationRolesDao = async (
  organizationId: string
): Promise<void> => {
  const lockKey = `member-roles:${organizationId}`
  await getDb().execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`
  )
}

/**
 * Comptes capables d'attribuer les roles (D3) : lignes `owner` ou `board` de
 * l'association dont le compte n'est pas SuperAdmin.
 */
export const countCapableMembersDao = async (
  organizationId: string
): Promise<number> => {
  const [row] = await getDb()
    .select({total: count()})
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(
        eq(member.organizationId, organizationId),
        inArray(member.role, CAPABLE_ROLES),
        ne(user.role, 'super_admin')
      )
    )
  return Number(row?.total ?? 0)
}

/**
 * Le compte President(e) de l'association, hors SuperAdmin (la ligne `owner`
 * de l'amorcage n'en fait pas une President(e)), ou rien.
 */
export const getOrganizationOwnerDao = async (
  organizationId: string
): Promise<{userId: string; name: string} | undefined> => {
  const [row] = await getDb()
    .select({userId: member.userId, name: user.name})
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(
        eq(member.organizationId, organizationId),
        eq(member.role, 'owner'),
        ne(user.role, 'super_admin')
      )
    )
    .limit(1)
  return row
}
