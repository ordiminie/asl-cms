import {beforeEach, describe, expect, it, vi} from 'vitest'

const scope = vi.hoisted(() => ({current: undefined as string | undefined}))

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (organizationId: string, callback: () => unknown) => {
    scope.current = organizationId
    try {
      return await callback()
    } finally {
      scope.current = undefined
    }
  }),
}))
vi.mock('@/db/repositories/incident-report-repository', () => ({
  countIncidentReportsByCategoryDao: vi.fn(),
}))
vi.mock('@/db/repositories/association-category-repository', () => ({
  createCategoryWithinLimitTxnDao: vi.fn(),
  getCategoryByIdDao: vi.fn(),
  listActiveCategoriesDao: vi.fn(),
  softDeleteCategoryDao: vi.fn(),
  updateCategoryTxnDao: vi.fn(),
}))

import {
  createCategoryWithinLimitTxnDao,
  getCategoryByIdDao,
  listActiveCategoriesDao,
  softDeleteCategoryDao,
  updateCategoryTxnDao,
} from '@/db/repositories/association-category-repository'
import {countIncidentReportsByCategoryDao} from '@/db/repositories/incident-report-repository'

import {
  createAssociationCategoryService,
  deleteAssociationCategoryService,
  listActiveReportCategoriesPublicService,
  listAssociationCategoriesService,
  updateAssociationCategoryService,
} from '../association-category-service'
import {AuthorizationError} from '../errors/authorization-error'
import {
  CategoryLimitReachedError,
  DuplicateCategoryNameError,
} from '../errors/category-errors'
import {NotFoundError} from '../errors/not-found-error'
import {
  CategoryDomainConst,
  MAX_CATEGORIES_PER_DOMAIN,
} from '../types/domain/association-category-types'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const CATEGORY_ID = '33333333-3333-4333-8333-333333333333'
const REPORT = CategoryDomainConst.REPORT

const withRole = (role: OrganizationRole, organizationId = ORG_ID): User => ({
  ...userTest,
  organizations: [
    {
      id: 'membership',
      organizationId,
      userId: userTest.id,
      role,
      createdAt: new Date(),
    },
  ],
})

const categoryRow = (overrides: Record<string, unknown> = {}) => ({
  id: CATEGORY_ID,
  organizationId: ORG_ID,
  domain: REPORT,
  name: "Fuite d'eau",
  routingEmail: null,
  createdAt: new Date('2026-09-01T08:00:00Z'),
  deletedAt: null,
  ...overrides,
})

const writeDaos = () => [
  createCategoryWithinLimitTxnDao,
  updateCategoryTxnDao,
  softDeleteCategoryDao,
]

const allDaos = () => [
  ...writeDaos(),
  listActiveCategoriesDao,
  getCategoryByIdDao,
  countIncidentReportsByCategoryDao,
]

beforeEach(() => {
  vi.clearAllMocks()
  scope.current = undefined
  vi.mocked(listActiveCategoriesDao).mockResolvedValue([categoryRow()])
  vi.mocked(countIncidentReportsByCategoryDao).mockResolvedValue({})
  vi.mocked(getCategoryByIdDao).mockResolvedValue(categoryRow())
  vi.mocked(createCategoryWithinLimitTxnDao).mockResolvedValue({
    status: 'created',
    row: categoryRow(),
  })
  vi.mocked(updateCategoryTxnDao).mockResolvedValue({
    status: 'updated',
    row: categoryRow(),
  })
  vi.mocked(softDeleteCategoryDao).mockResolvedValue(
    categoryRow({deletedAt: new Date()})
  )
})

describe.each([
  ['[ORGANIZATION OWNER]', UserOrganizationRoleConst.OWNER],
  ['[ORGANIZATION ADMIN]', UserOrganizationRoleConst.ADMIN],
])('%s administre les catégories (critères 4, 5, 6)', (_label, role) => {
  beforeEach(() => {
    setupAuthUserMocked(withRole(role))
  })

  it('should list the active categories of the domain under the tenant scope', async () => {
    let readUnder: string | undefined
    vi.mocked(listActiveCategoriesDao).mockImplementation(async () => {
      readUnder = scope.current
      return [categoryRow()]
    })

    const list = await listAssociationCategoriesService(ORG_ID, REPORT)

    expect(list.max).toBe(MAX_CATEGORIES_PER_DOMAIN)
    expect(list.items).toEqual([
      expect.objectContaining({name: "Fuite d'eau", routingEmail: null}),
    ])
    expect(listActiveCategoriesDao).toHaveBeenCalledWith(ORG_ID, REPORT)
    expect(readUnder).toBe(ORG_ID)
  })

  it('should tell, for each report category, how many reports it keeps (critère 5)', async () => {
    const other = '99999999-9999-4999-8999-999999999999'
    vi.mocked(listActiveCategoriesDao).mockResolvedValue([
      categoryRow(),
      categoryRow({id: other, name: 'Nuisance'}),
    ])
    let countedUnder: string | undefined
    vi.mocked(countIncidentReportsByCategoryDao).mockImplementation(
      async () => {
        countedUnder = scope.current
        return {[CATEGORY_ID]: 3}
      }
    )

    const list = await listAssociationCategoriesService(ORG_ID, REPORT)

    expect(list.items.map((item) => item.usageCount)).toEqual([3, 0])
    expect(countIncidentReportsByCategoryDao).toHaveBeenCalledWith(ORG_ID)
    expect(countedUnder).toBe(ORG_ID)
  })

  it('should create a category within the limit, under the tenant scope', async () => {
    let writtenUnder: string | undefined
    vi.mocked(createCategoryWithinLimitTxnDao).mockImplementation(async () => {
      writtenUnder = scope.current
      return {status: 'created', row: categoryRow()}
    })

    await createAssociationCategoryService({
      organizationId: ORG_ID,
      domain: REPORT,
      name: "  Fuite d'eau ",
    })

    expect(createCategoryWithinLimitTxnDao).toHaveBeenCalledWith(
      {
        organizationId: ORG_ID,
        domain: REPORT,
        name: "Fuite d'eau",
        routingEmail: null,
      },
      MAX_CATEGORIES_PER_DOMAIN
    )
    expect(writtenUnder).toBe(ORG_ID)
  })

  it.each([
    ['vide', ''],
    ['faite d espaces', '   '],
  ])(
    'should store an address left %s as absent (critère 6)',
    async (_label, routingEmail) => {
      await createAssociationCategoryService({
        organizationId: ORG_ID,
        domain: REPORT,
        name: 'Voirie',
        routingEmail,
      })

      expect(createCategoryWithinLimitTxnDao).toHaveBeenCalledWith(
        expect.objectContaining({routingEmail: null}),
        MAX_CATEGORIES_PER_DOMAIN
      )
    }
  )

  it('should store a filled address unchanged (critère 6)', async () => {
    await createAssociationCategoryService({
      organizationId: ORG_ID,
      domain: REPORT,
      name: 'Voirie',
      routingEmail: 'voirie@amis-etang.test',
    })

    expect(createCategoryWithinLimitTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({routingEmail: 'voirie@amis-etang.test'}),
      MAX_CATEGORIES_PER_DOMAIN
    )
  })

  it('should refuse the 11th category with a dedicated error (critère 4)', async () => {
    vi.mocked(createCategoryWithinLimitTxnDao).mockResolvedValue({
      status: 'limit_reached',
    })

    await expect(
      createAssociationCategoryService({
        organizationId: ORG_ID,
        domain: REPORT,
        name: 'Onzième',
      })
    ).rejects.toThrow(CategoryLimitReachedError)
  })

  it('should refuse a duplicate name with a dedicated error', async () => {
    vi.mocked(createCategoryWithinLimitTxnDao).mockResolvedValue({
      status: 'duplicate_name',
    })

    await expect(
      createAssociationCategoryService({
        organizationId: ORG_ID,
        domain: REPORT,
        name: 'Nuisance',
      })
    ).rejects.toThrow(DuplicateCategoryNameError)
  })

  it('should update a category, empty address stored as absent', async () => {
    await updateAssociationCategoryService({
      organizationId: ORG_ID,
      domain: REPORT,
      categoryId: CATEGORY_ID,
      name: 'Voirie et chemins',
      routingEmail: ' ',
    })

    expect(updateCategoryTxnDao).toHaveBeenCalledWith(CATEGORY_ID, REPORT, {
      name: 'Voirie et chemins',
      routingEmail: null,
    })
  })

  it('should refuse a duplicate name on update', async () => {
    vi.mocked(updateCategoryTxnDao).mockResolvedValue({
      status: 'duplicate_name',
    })

    await expect(
      updateAssociationCategoryService({
        organizationId: ORG_ID,
        domain: REPORT,
        categoryId: CATEGORY_ID,
        name: 'Nuisance',
      })
    ).rejects.toThrow(DuplicateCategoryNameError)
  })

  it('should say not found when updating a missing or deleted category', async () => {
    vi.mocked(updateCategoryTxnDao).mockResolvedValue({status: 'not_found'})

    await expect(
      updateAssociationCategoryService({
        organizationId: ORG_ID,
        domain: REPORT,
        categoryId: CATEGORY_ID,
        name: 'Nuisance',
      })
    ).rejects.toThrow(NotFoundError)
  })

  it('should delete logically, never physically (critère 5)', async () => {
    let deletedUnder: string | undefined
    vi.mocked(softDeleteCategoryDao).mockImplementation(async () => {
      deletedUnder = scope.current
      return categoryRow({deletedAt: new Date()})
    })

    await deleteAssociationCategoryService({
      organizationId: ORG_ID,
      domain: REPORT,
      categoryId: CATEGORY_ID,
    })

    expect(softDeleteCategoryDao).toHaveBeenCalledWith(CATEGORY_ID, REPORT)
    expect(deletedUnder).toBe(ORG_ID)
  })

  it('should say not found when deleting a missing category', async () => {
    vi.mocked(softDeleteCategoryDao).mockResolvedValue(undefined)

    await expect(
      deleteAssociationCategoryService({
        organizationId: ORG_ID,
        domain: REPORT,
        categoryId: CATEGORY_ID,
      })
    ).rejects.toThrow(NotFoundError)
  })
})

describe('validation des catégories', () => {
  beforeEach(() => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))
  })

  it.each([
    ['un nom vide', {name: ''}],
    ['un nom fait d espaces', {name: '   '}],
    ['un nom de plus de 40 caractères', {name: 'a'.repeat(41)}],
    ['une adresse mal formée', {name: 'Voirie', routingEmail: 'voirie@'}],
    ['un domaine inconnu', {name: 'Voirie', domain: 'annonce'}],
    ['une association invalide', {name: 'Voirie', organizationId: 'x'}],
  ])('should reject %s without writing', async (_label, overrides) => {
    await expect(
      createAssociationCategoryService({
        organizationId: ORG_ID,
        domain: REPORT,
        ...overrides,
      } as never)
    ).rejects.toThrow()

    expect(createCategoryWithinLimitTxnDao).not.toHaveBeenCalled()
  })

  it('should accept a 40 characters name', async () => {
    await expect(
      createAssociationCategoryService({
        organizationId: ORG_ID,
        domain: REPORT,
        name: 'a'.repeat(40),
      })
    ).resolves.toMatchObject({id: CATEGORY_ID})
  })
})

describe.each([
  ['[ORGANIZATION MEMBER]', () => withRole(UserOrganizationRoleConst.MEMBER)],
  [
    '[USER NOT IN ORGANIZATION]',
    () => withRole(UserOrganizationRoleConst.OWNER, OTHER_ORG_ID),
  ],
  ['[USER] sans association', () => userTest as User],
  ['[ADMIN] global sans association', () => userTestAdmin as User],
  ['[PUBLIC]', () => undefined],
])('%s n’administre rien', (_label, userOf) => {
  beforeEach(() => {
    setupAuthUserMocked(userOf())
  })

  it('should NOT list the categories', async () => {
    await expect(
      listAssociationCategoriesService(ORG_ID, REPORT)
    ).rejects.toThrow(AuthorizationError)
    allDaos().forEach((dao) => expect(dao).not.toHaveBeenCalled())
  })

  it('should NOT create a category', async () => {
    await expect(
      createAssociationCategoryService({
        organizationId: ORG_ID,
        domain: REPORT,
        name: 'Voirie',
      })
    ).rejects.toThrow(AuthorizationError)
    allDaos().forEach((dao) => expect(dao).not.toHaveBeenCalled())
  })

  it('should NOT update a category', async () => {
    await expect(
      updateAssociationCategoryService({
        organizationId: ORG_ID,
        domain: REPORT,
        categoryId: CATEGORY_ID,
        name: 'Voirie',
      })
    ).rejects.toThrow(AuthorizationError)
    allDaos().forEach((dao) => expect(dao).not.toHaveBeenCalled())
  })

  it('should NOT delete a category', async () => {
    await expect(
      deleteAssociationCategoryService({
        organizationId: ORG_ID,
        domain: REPORT,
        categoryId: CATEGORY_ID,
      })
    ).rejects.toThrow(AuthorizationError)
    allDaos().forEach((dao) => expect(dao).not.toHaveBeenCalled())
  })
})

describe('[PUBLIC] listActiveReportCategoriesPublicService — le formulaire du site', () => {
  beforeEach(() => {
    setupAuthUserMocked(undefined)
  })

  it('should read the active report categories without any session, id and name only', async () => {
    let readUnder: string | undefined
    vi.mocked(listActiveCategoriesDao).mockImplementation(async () => {
      readUnder = scope.current
      return [categoryRow({routingEmail: 'forage@amis-etang.test'})]
    })

    const categories = await listActiveReportCategoriesPublicService(ORG_ID)

    expect(categories).toEqual([{id: CATEGORY_ID, name: "Fuite d'eau"}])
    expect(listActiveCategoriesDao).toHaveBeenCalledWith(ORG_ID, REPORT)
    expect(readUnder).toBe(ORG_ID)
  })

  it('should refuse an invalid association id without reading', async () => {
    await expect(
      listActiveReportCategoriesPublicService('pas-un-uuid')
    ).rejects.toThrow()
    expect(listActiveCategoriesDao).not.toHaveBeenCalled()
  })
})
