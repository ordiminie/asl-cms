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
vi.mock('@/db/repositories/page-repository', () => ({
  getPageByIdDao: vi.fn(),
}))
vi.mock('@/db/repositories/organization-setting-repository', () => ({
  getOrganizationSettingsDao: vi.fn(),
  upsertOrganizationSettingsDao: vi.fn(),
  deleteOrganizationSettingsDao: vi.fn(),
  saveOrganizationSettingsTxnDao: vi.fn(),
}))

import {
  deleteOrganizationSettingsDao,
  getOrganizationSettingsDao,
  upsertOrganizationSettingsDao,
} from '@/db/repositories/organization-setting-repository'
import {getPageByIdDao} from '@/db/repositories/page-repository'

import {getAuthUser} from '../authentication/auth-service'
import {AuthorizationError} from '../errors/authorization-error'
import {NotFoundError} from '../errors/not-found-error'
import {ValidationParsedZodError} from '../errors/validation-error'
import {
  canManageHomePageService,
  getHomePageForBureauService,
  getPublicHomePageService,
  setHomePageService,
} from '../home-page-service'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {HOME_PAGE_SETTING_KEY} from '../types/domain/home-page-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const PAGE_ID = '33333333-3333-4333-8333-333333333333'
const FOREIGN_PAGE_ID = '44444444-4444-4444-8444-444444444444'

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

const pageRow = (overrides: Record<string, unknown> = {}) => ({
  id: PAGE_ID,
  organizationId: ORG_ID,
  slug: 'bienvenue',
  title: 'Bienvenue aux Amis de l’Étang',
  status: 'published' as const,
  seoTitle: null,
  seoDescription: null,
  shareImageKey: null,
  shareImageAlt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  blocks: [],
  ...overrides,
})

const settingRow = (value: string) => ({
  organizationId: ORG_ID,
  key: HOME_PAGE_SETTING_KEY,
  value,
  updatedBy: null,
  updatedAt: new Date('2026-01-01'),
})

const expectNoWrite = () => {
  expect(upsertOrganizationSettingsDao).not.toHaveBeenCalled()
  expect(deleteOrganizationSettingsDao).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.clearAllMocks()
  setupAuthUserMocked(withRole(UserOrganizationRoleConst.ADMIN))
  vi.mocked(getPageByIdDao).mockImplementation(async (pageId) => {
    expect(scope.current).toBe(ORG_ID)
    return pageId === PAGE_ID ? pageRow() : undefined
  })
  vi.mocked(getOrganizationSettingsDao).mockResolvedValue([])
  vi.mocked(upsertOrganizationSettingsDao).mockImplementation(async () => {
    expect(scope.current).toBe(ORG_ID)
  })
  vi.mocked(deleteOrganizationSettingsDao).mockImplementation(async () => {
    expect(scope.current).toBe(ORG_ID)
  })
})

describe('[BUREAU] setHomePageService', () => {
  it('désigne une page publiée : écrit la clé et l identifiant sous le scope de l association', async () => {
    const result = await setHomePageService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
    })

    expect(result).toEqual({status: 'saved'})
    expect(upsertOrganizationSettingsDao).toHaveBeenCalledWith([
      {
        organizationId: ORG_ID,
        key: HOME_PAGE_SETTING_KEY,
        value: PAGE_ID,
        updatedBy: userTest.id,
      },
    ])
    expect(deleteOrganizationSettingsDao).not.toHaveBeenCalled()
  })

  it('[ORGANIZATION OWNER] la présidente désigne la page', async () => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))

    const result = await setHomePageService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
    })

    expect(result).toEqual({status: 'saved'})
  })

  it('[SUPER_ADMIN] le SuperAdmin désigne la page', async () => {
    setupAuthUserMocked(userTestSuperAdmin)

    const result = await setHomePageService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
    })

    expect(result).toEqual({status: 'saved'})
  })

  it('revenir à l accueil automatique supprime la clé', async () => {
    const result = await setHomePageService({
      organizationId: ORG_ID,
      pageId: null,
    })

    expect(result).toEqual({status: 'saved'})
    expect(deleteOrganizationSettingsDao).toHaveBeenCalledWith(ORG_ID, [
      HOME_PAGE_SETTING_KEY,
    ])
    expect(upsertOrganizationSettingsDao).not.toHaveBeenCalled()
    expect(getPageByIdDao).not.toHaveBeenCalled()
  })

  it('refuse un brouillon sans rien écrire', async () => {
    vi.mocked(getPageByIdDao).mockResolvedValue(pageRow({status: 'draft'}))

    const result = await setHomePageService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
    })

    expect(result).toEqual({status: 'not_published'})
    expectNoWrite()
  })

  it('refuse une page dépubliée sans rien écrire', async () => {
    vi.mocked(getPageByIdDao).mockResolvedValue(
      pageRow({status: 'unpublished'})
    )

    const result = await setHomePageService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
    })

    expect(result).toEqual({status: 'not_published'})
    expectNoWrite()
  })

  it('[CROSS-TENANT] refuse la page d une autre association : la RLS ne la rend pas, rien ne s écrit', async () => {
    await expect(
      setHomePageService({organizationId: ORG_ID, pageId: FOREIGN_PAGE_ID})
    ).rejects.toThrow(NotFoundError)

    expect(getPageByIdDao).toHaveBeenCalledWith(FOREIGN_PAGE_ID)
    expectNoWrite()
  })

  it('rejette un identifiant de page qui n est pas un UUID', async () => {
    await expect(
      setHomePageService({organizationId: ORG_ID, pageId: 'bienvenue'})
    ).rejects.toThrow(ValidationParsedZodError)

    expect(getPageByIdDao).not.toHaveBeenCalled()
    expectNoWrite()
  })
})

describe('[REFUS] setHomePageService', () => {
  it('[ORGANIZATION MEMBER] refuse un membre simple sans rien écrire', async () => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.MEMBER))

    await expect(
      setHomePageService({organizationId: ORG_ID, pageId: PAGE_ID})
    ).rejects.toThrow(AuthorizationError)

    expect(getPageByIdDao).not.toHaveBeenCalled()
    expectNoWrite()
  })

  it('[OTHER ORGANIZATION BOARD] refuse le bureau d une autre association', async () => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.ADMIN, OTHER_ORG_ID))

    await expect(
      setHomePageService({organizationId: ORG_ID, pageId: null})
    ).rejects.toThrow(AuthorizationError)

    expectNoWrite()
  })

  it('[USER NOT IN ORGANIZATION] refuse un compte sans rôle dans l association', async () => {
    setupAuthUserMocked(userTest)

    await expect(
      setHomePageService({organizationId: ORG_ID, pageId: PAGE_ID})
    ).rejects.toThrow(AuthorizationError)

    expectNoWrite()
  })

  it('[PUBLIC] refuse un visiteur non connecté', async () => {
    setupAuthUserMocked(undefined)

    await expect(
      setHomePageService({organizationId: ORG_ID, pageId: PAGE_ID})
    ).rejects.toThrow(AuthorizationError)

    expectNoWrite()
  })
})

describe('getHomePageForBureauService', () => {
  it('rend la page désignée avec son statut, même dépubliée', async () => {
    vi.mocked(getOrganizationSettingsDao).mockResolvedValue([
      settingRow(PAGE_ID),
    ])
    vi.mocked(getPageByIdDao).mockResolvedValue(
      pageRow({status: 'unpublished'})
    )

    const result = await getHomePageForBureauService(ORG_ID)

    expect(result).toEqual({
      page: {
        id: PAGE_ID,
        title: 'Bienvenue aux Amis de l’Étang',
        status: 'unpublished',
      },
    })
  })

  it('sans ligne : aucune page', async () => {
    const result = await getHomePageForBureauService(ORG_ID)

    expect(result).toEqual({page: null})
    expect(getPageByIdDao).not.toHaveBeenCalled()
  })

  it('une référence pendante se lit comme aucune page', async () => {
    vi.mocked(getOrganizationSettingsDao).mockResolvedValue([
      settingRow(FOREIGN_PAGE_ID),
    ])

    const result = await getHomePageForBureauService(ORG_ID)

    expect(result).toEqual({page: null})
  })

  it('[ORGANIZATION MEMBER] refuse un membre simple sans rien lire', async () => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.MEMBER))

    await expect(getHomePageForBureauService(ORG_ID)).rejects.toThrow(
      AuthorizationError
    )
    expect(getOrganizationSettingsDao).not.toHaveBeenCalled()
  })
})

describe('[PUBLIC] getPublicHomePageService', () => {
  beforeEach(() => {
    setupAuthUserMocked(undefined)
  })

  it('rend la page désignée sans session, blocs compris', async () => {
    vi.mocked(getOrganizationSettingsDao).mockResolvedValue([
      settingRow(PAGE_ID),
    ])

    const result = await getPublicHomePageService(ORG_ID)

    expect(result?.id).toBe(PAGE_ID)
    expect(result?.slug).toBe('bienvenue')
    expect(result?.blocks).toEqual([])
    expect(getAuthUser).not.toHaveBeenCalled()
  })

  it('rend la page quel que soit son statut : le filtre est au DAL', async () => {
    vi.mocked(getOrganizationSettingsDao).mockResolvedValue([
      settingRow(PAGE_ID),
    ])
    vi.mocked(getPageByIdDao).mockResolvedValue(pageRow({status: 'draft'}))

    const result = await getPublicHomePageService(ORG_ID)

    expect(result?.status).toBe('draft')
  })

  it('sans ligne : undefined', async () => {
    expect(await getPublicHomePageService(ORG_ID)).toBeUndefined()
    expect(getPageByIdDao).not.toHaveBeenCalled()
  })

  it('une référence pendante : undefined', async () => {
    vi.mocked(getOrganizationSettingsDao).mockResolvedValue([
      settingRow(FOREIGN_PAGE_ID),
    ])

    expect(await getPublicHomePageService(ORG_ID)).toBeUndefined()
  })

  it('une valeur qui n est pas un UUID : undefined, sans lecture de page', async () => {
    vi.mocked(getOrganizationSettingsDao).mockResolvedValue([
      settingRow('bienvenue'),
    ])

    expect(await getPublicHomePageService(ORG_ID)).toBeUndefined()
    expect(getPageByIdDao).not.toHaveBeenCalled()
  })

  it('un identifiant d association invalide : undefined', async () => {
    expect(await getPublicHomePageService('pas-un-uuid')).toBeUndefined()
    expect(getOrganizationSettingsDao).not.toHaveBeenCalled()
  })
})

describe('canManageHomePageService', () => {
  it('[ORGANIZATION BOARD] vrai pour le bureau', async () => {
    expect(await canManageHomePageService(ORG_ID)).toBe(true)
  })

  it('[ORGANIZATION MEMBER] faux pour un membre simple', async () => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.MEMBER))
    expect(await canManageHomePageService(ORG_ID)).toBe(false)
  })

  it('[PUBLIC] faux sans session', async () => {
    setupAuthUserMocked(undefined)
    expect(await canManageHomePageService(ORG_ID)).toBe(false)
  })

  it('faux pour un identifiant d association invalide', async () => {
    expect(await canManageHomePageService('pas-un-uuid')).toBe(false)
  })
})
