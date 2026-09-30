import 'server-only'

import {AssociationCategoryModel} from '@/db/models/association-category-model'
import {
  createCategoryWithinLimitTxnDao,
  listActiveCategoriesDao,
  softDeleteCategoryDao,
  updateCategoryTxnDao,
} from '@/db/repositories/association-category-repository'
import {countIncidentReportsByCategoryDao} from '@/db/repositories/incident-report-repository'
import {withTenant} from '@/db/tenant-scope'

import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {
  CategoryLimitReachedError,
  DuplicateCategoryNameError,
} from './errors/category-errors'
import {NotFoundError} from './errors/not-found-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  AssociationCategoryDTO,
  AssociationCategoryListDTO,
  CategoryDomain,
  CategoryDomainConst,
  CreateAssociationCategoryInput,
  DeleteAssociationCategoryInput,
  MAX_CATEGORIES_PER_DOMAIN,
  PublicCategoryDTO,
  UpdateAssociationCategoryInput,
} from './types/domain/association-category-types'
import {
  categoryOrganizationIdSchema,
  createCategoryServiceSchema,
  deleteCategoryServiceSchema,
  listCategoriesServiceSchema,
  updateCategoryServiceSchema,
} from './validation/association-category-validation'

/**
 * Categories administrables, generiques par domaine (s10, ADR 028). Chaque
 * domaine est gouverne par l'action de son usage : les categories de
 * signalement par `report.manage`. s23 et s35 ajouteront leur ligne ici.
 */
const MANAGE_ACTION_OF_DOMAIN: Record<CategoryDomain, string> = {
  [CategoryDomainConst.REPORT]: ActionIdConst.REPORT_MANAGE,
}

/**
 * Combien d'objets de chaque domaine portent une categorie : pour les
 * signalements, ceux qui seront conserves si elle est supprimee.
 */
const USAGE_COUNTS_OF_DOMAIN: Record<
  CategoryDomain,
  (organizationId: string) => Promise<Record<string, number>>
> = {
  [CategoryDomainConst.REPORT]: countIncidentReportsByCategoryDao,
}

const MANAGE_DENIED =
  "Seul le bureau de l'association peut administrer les catégories"
const CATEGORY_NOT_FOUND = 'Catégorie introuvable'

const toCategoryDto = (
  row: AssociationCategoryModel
): AssociationCategoryDTO => ({
  id: row.id,
  organizationId: row.organizationId,
  domain: row.domain as CategoryDomain,
  name: row.name,
  routingEmail: row.routingEmail,
  createdAt: row.createdAt,
})

const requireCategoryManager = async (
  organizationId: string,
  domain: CategoryDomain
): Promise<void> => {
  const authUser = await getAuthUser()
  if (
    !canPerformAction(authUser, organizationId, MANAGE_ACTION_OF_DOMAIN[domain])
  ) {
    throw new AuthorizationError(MANAGE_DENIED)
  }
}

/** Les categories actives d'un domaine, pour l'ecran du bureau. */
export const listAssociationCategoriesService = async (
  organizationId: string,
  domain: CategoryDomain
): Promise<AssociationCategoryListDTO> => {
  const parsed = listCategoriesServiceSchema.safeParse({organizationId, domain})
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireCategoryManager(parsed.data.organizationId, parsed.data.domain)

  const {organizationId: orgId, domain: categoryDomain} = parsed.data
  const [rows, usage] = await withTenant(orgId, () =>
    Promise.all([
      listActiveCategoriesDao(orgId, categoryDomain),
      USAGE_COUNTS_OF_DOMAIN[categoryDomain](orgId),
    ])
  )
  return {
    items: rows.map((row) => ({
      ...toCategoryDto(row),
      usageCount: usage[row.id] ?? 0,
    })),
    max: MAX_CATEGORIES_PER_DOMAIN,
  }
}

/**
 * Cree une categorie. La 11ᵉ d'un domaine leve `CategoryLimitReachedError`
 * (critere 4), un nom deja porte par une active `DuplicateCategoryNameError`.
 * Une adresse vide est ecrite `NULL` (critere 6).
 */
export const createAssociationCategoryService = async (
  input: CreateAssociationCategoryInput
): Promise<AssociationCategoryDTO> => {
  const parsed = createCategoryServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, domain, name, routingEmail} = parsed.data
  await requireCategoryManager(organizationId, domain)

  const result = await withTenant(organizationId, () =>
    createCategoryWithinLimitTxnDao(
      {organizationId, domain, name, routingEmail: routingEmail ?? null},
      MAX_CATEGORIES_PER_DOMAIN
    )
  )
  if (result.status === 'limit_reached') {
    throw new CategoryLimitReachedError(MAX_CATEGORIES_PER_DOMAIN)
  }
  if (result.status === 'duplicate_name') {
    throw new DuplicateCategoryNameError()
  }
  return toCategoryDto(result.row)
}

/** Renomme une categorie active ou change son adresse de routage. */
export const updateAssociationCategoryService = async (
  input: UpdateAssociationCategoryInput
): Promise<AssociationCategoryDTO> => {
  const parsed = updateCategoryServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, domain, categoryId, name, routingEmail} = parsed.data
  await requireCategoryManager(organizationId, domain)

  const result = await withTenant(organizationId, () =>
    updateCategoryTxnDao(categoryId, domain, {
      name,
      routingEmail: routingEmail ?? null,
    })
  )
  if (result.status === 'not_found') {
    throw new NotFoundError(CATEGORY_NOT_FOUND)
  }
  if (result.status === 'duplicate_name') {
    throw new DuplicateCategoryNameError()
  }
  return toCategoryDto(result.row)
}

/**
 * Supprime une categorie **logiquement** (critere 5) : elle disparait du
 * formulaire et de l'ecran, libere sa place sous le plafond, et les
 * signalements deja recus gardent son nom.
 */
export const deleteAssociationCategoryService = async (
  input: DeleteAssociationCategoryInput
): Promise<void> => {
  const parsed = deleteCategoryServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, domain, categoryId} = parsed.data
  await requireCategoryManager(organizationId, domain)

  const row = await withTenant(organizationId, () =>
    softDeleteCategoryDao(categoryId, domain)
  )
  if (!row) {
    throw new NotFoundError(CATEGORY_NOT_FOUND)
  }
}

/**
 * Les categories de signalement actives, pour le formulaire public
 * `/signaler`.
 *
 * **Sans controle d'autorisation, et c'est delibere** : le lecteur est un
 * visiteur anonyme. Seuls l'identifiant et le nom sortent — jamais l'adresse
 * de routage.
 */
export const listActiveReportCategoriesPublicService = async (
  organizationId: string
): Promise<PublicCategoryDTO[]> => {
  const parsed = categoryOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const rows = await withTenant(parsed.data, () =>
    listActiveCategoriesDao(parsed.data, CategoryDomainConst.REPORT)
  )
  return rows.map((row) => ({id: row.id, name: row.name}))
}
