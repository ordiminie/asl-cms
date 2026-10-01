import {beforeEach, describe, expect, it, vi} from 'vitest'

const scope = vi.hoisted(() => ({current: undefined as string | undefined}))
const storage = vi.hoisted(() => ({
  upload: vi.fn(),
  download: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
}))
const resize = vi.hoisted(() => ({
  resizeToSquareWebp: vi.fn(),
  resizeToFitWebp: vi.fn(),
}))

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
  createPageDao: vi.fn(),
  getPageByIdDao: vi.fn(),
  getPageBySlugDao: vi.fn(),
  getPagesByOrganizationDao: vi.fn(),
  reorderPageBlocksTxnDao: vi.fn(),
  updatePageDao: vi.fn(),
  updatePageStatusDao: vi.fn(),
}))
vi.mock('@/lib/files/storage/storage-factory', () => ({
  createStorage: vi.fn(() => storage),
}))
vi.mock('@/lib/files/resize-image', () => resize)

import {
  getPageByIdDao,
  getPageBySlugDao,
  reorderPageBlocksTxnDao,
  updatePageDao,
  updatePageStatusDao,
} from '@/db/repositories/page-repository'

import {AuthorizationError} from '../errors/authorization-error'
import {ValidationError} from '../errors/validation-error'
import {
  publishPageService,
  updatePageService,
  uploadPageShareImageService,
} from '../page-service'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const PAGE_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_PAGE_ID = '44444444-4444-4444-8444-444444444444'
const SHARE_KEY = `${ORG_ID}/pages/${PAGE_ID}/share-66666666-6666-4666-8666-666666666666.webp`

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
  slug: 'qualite-de-leau',
  title: "Qualité de l'eau",
  status: 'draft' as const,
  seoTitle: null,
  seoDescription: null,
  shareImageKey: null,
  shareImageAlt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  blocks: [],
  ...overrides,
})

const baseUpdate = {
  organizationId: ORG_ID,
  pageId: PAGE_ID,
  title: "Qualité de l'eau",
  slug: 'qualite-de-leau',
  blocks: [],
}

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
])
const WEBP_OUTPUT = new Uint8Array([0x52, 0x49, 0x46, 0x46])

const imageFile = () =>
  new File([PNG_BYTES as BlobPart], 'prelevement.png', {type: 'image/png'})

beforeEach(() => {
  vi.clearAllMocks()
  setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))
  vi.mocked(getPageBySlugDao).mockResolvedValue(undefined)
  vi.mocked(getPageByIdDao).mockImplementation(async (pageId) =>
    pageId === PAGE_ID ? pageRow() : undefined
  )
  vi.mocked(updatePageDao).mockImplementation(async (pageId, input) => {
    expect(scope.current).toBe(ORG_ID)
    return pageRow({id: pageId, ...input})
  })
  vi.mocked(updatePageStatusDao).mockImplementation(async (pageId, status) =>
    pageRow({id: pageId, status})
  )
  vi.mocked(reorderPageBlocksTxnDao).mockResolvedValue([])
  resize.resizeToFitWebp.mockResolvedValue(WEBP_OUTPUT)
})

describe('updatePageService — referencement et partage (s11)', () => {
  it('enregistre titre moteur, description, image et texte alternatif, et les rend', async () => {
    const result = await updatePageService({
      ...baseUpdate,
      seoTitle: 'Qualité de l’eau : analyses',
      seoDescription: 'Résultats des analyses du réseau.',
      shareImageKey: SHARE_KEY,
      shareImageAlt: 'Prélèvement au robinet',
    })

    expect(updatePageDao).toHaveBeenCalledWith(PAGE_ID, {
      slug: 'qualite-de-leau',
      title: "Qualité de l'eau",
      seoTitle: 'Qualité de l’eau : analyses',
      seoDescription: 'Résultats des analyses du réseau.',
      shareImageKey: SHARE_KEY,
      shareImageAlt: 'Prélèvement au robinet',
    })
    expect(result.status === 'saved' && result.page).toMatchObject({
      seoTitle: 'Qualité de l’eau : analyses',
      seoDescription: 'Résultats des analyses du réseau.',
      shareImageKey: SHARE_KEY,
      shareImageAlt: 'Prélèvement au robinet',
    })
  })

  it('un champ vide est stocke absent, jamais en chaine vide', async () => {
    await updatePageService({
      ...baseUpdate,
      seoTitle: '  ',
      seoDescription: '',
      shareImageKey: null,
      shareImageAlt: '',
    })

    expect(updatePageDao).toHaveBeenCalledWith(PAGE_ID, {
      slug: 'qualite-de-leau',
      title: "Qualité de l'eau",
      seoTitle: null,
      seoDescription: null,
      shareImageKey: null,
      shareImageAlt: null,
    })
  })

  it('sans champ de referencement envoye, ceux en base ne sont pas touches', async () => {
    await updatePageService(baseUpdate)

    expect(updatePageDao).toHaveBeenCalledWith(PAGE_ID, {
      slug: 'qualite-de-leau',
      title: "Qualité de l'eau",
    })
  })

  it('refuse un titre moteur de 61 caracteres, sans rien ecrire', async () => {
    await expect(
      updatePageService({...baseUpdate, seoTitle: 'a'.repeat(61)})
    ).rejects.toThrow()
    expect(updatePageDao).not.toHaveBeenCalled()
  })

  it('accepte un titre de 60 et une description de 160', async () => {
    const result = await updatePageService({
      ...baseUpdate,
      seoTitle: 'a'.repeat(60),
      seoDescription: 'b'.repeat(160),
    })
    expect(result.status).toBe('saved')
  })

  it('refuse une description de 161 caracteres, sans rien ecrire', async () => {
    await expect(
      updatePageService({...baseUpdate, seoDescription: 'a'.repeat(161)})
    ).rejects.toThrow()
    expect(updatePageDao).not.toHaveBeenCalled()
  })

  it.each([
    [
      'd une autre page',
      `${ORG_ID}/pages/${OTHER_PAGE_ID}/share-66666666-6666-4666-8666-666666666666.webp`,
    ],
    [
      'd une autre association',
      `${OTHER_ORG_ID}/pages/${PAGE_ID}/share-66666666-6666-4666-8666-666666666666.webp`,
    ],
    [
      'd une autre portee',
      `${ORG_ID}/news/${PAGE_ID}/share-66666666-6666-4666-8666-666666666666.webp`,
    ],
    ['remontant le chemin', `${ORG_ID}/pages/${PAGE_ID}/../x/share-1.webp`],
  ])('refuse une cle d image %s', async (_label, key) => {
    await expect(
      updatePageService({...baseUpdate, shareImageKey: key})
    ).rejects.toBeInstanceOf(ValidationError)
    expect(updatePageDao).not.toHaveBeenCalled()
  })
})

describe('publishPageService — image de partage sans texte alternatif (s11)', () => {
  it('refuse de publier une image deposee sans texte alternatif', async () => {
    vi.mocked(getPageByIdDao).mockResolvedValue(
      pageRow({shareImageKey: SHARE_KEY, shareImageAlt: null})
    )

    const result = await publishPageService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
    })

    expect(result).toEqual({
      status: 'rejected',
      issues: [{code: 'share_image_alt_missing'}],
    })
    expect(updatePageStatusDao).not.toHaveBeenCalled()
  })

  it('publie une image deposee avec son texte alternatif', async () => {
    vi.mocked(getPageByIdDao).mockResolvedValue(
      pageRow({shareImageKey: SHARE_KEY, shareImageAlt: 'Prélèvement'})
    )

    const result = await publishPageService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
    })

    expect(result.status).toBe('published')
  })

  it('publie une page sans image de partage', async () => {
    const result = await publishPageService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
    })

    expect(result.status).toBe('published')
  })
})

describe('uploadPageShareImageService (s11)', () => {
  it.each([
    ['la presidente', UserOrganizationRoleConst.OWNER],
    ['un membre du bureau', UserOrganizationRoleConst.ADMIN],
  ])(
    '%s depose une image, redimensionnee avant ecriture',
    async (_who, role) => {
      setupAuthUserMocked(withRole(role))

      const result = await uploadPageShareImageService({
        organizationId: ORG_ID,
        pageId: PAGE_ID,
        file: imageFile(),
      })

      expect(resize.resizeToFitWebp).toHaveBeenCalledWith(PNG_BYTES, 1200, 630)
      expect(resize.resizeToSquareWebp).not.toHaveBeenCalled()
      expect(result).toMatchObject({status: 'uploaded'})
      const key = result.status === 'uploaded' ? result.key : ''
      expect(key).toMatch(
        new RegExp(`^${ORG_ID}/pages/${PAGE_ID}/share-[0-9a-f-]{36}\\.webp$`)
      )
      expect(storage.upload).toHaveBeenCalledTimes(1)
      const [stored, storedKey] = storage.upload.mock.calls[0]
      expect(storedKey).toBe(key)
      expect(new Uint8Array(await (stored as File).arrayBuffer())).toEqual(
        WEBP_OUTPUT
      )
    }
  )

  it.each([
    ['un membre simple', withRole(UserOrganizationRoleConst.MEMBER)],
    [
      'la presidente d une autre association',
      withRole(UserOrganizationRoleConst.OWNER, OTHER_ORG_ID),
    ],
  ])('%s est refuse sans lecture ni ecriture', async (_who, user) => {
    setupAuthUserMocked(user)

    await expect(
      uploadPageShareImageService({
        organizationId: ORG_ID,
        pageId: PAGE_ID,
        file: imageFile(),
      })
    ).rejects.toBeInstanceOf(AuthorizationError)
    expect(getPageByIdDao).not.toHaveBeenCalled()
    expect(storage.upload).not.toHaveBeenCalled()
  })

  it('sans session, aucun depot', async () => {
    setupAuthUserMocked(undefined)

    await expect(
      uploadPageShareImageService({
        organizationId: ORG_ID,
        pageId: PAGE_ID,
        file: imageFile(),
      })
    ).rejects.toBeInstanceOf(AuthorizationError)
    expect(storage.upload).not.toHaveBeenCalled()
  })

  it('refuse un fichier qui n est pas une image, sans le decoder', async () => {
    const result = await uploadPageShareImageService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
      file: new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], 'a.pdf'),
    })

    expect(result).toEqual({status: 'rejected', reason: 'format'})
    expect(resize.resizeToFitWebp).not.toHaveBeenCalled()
    expect(storage.upload).not.toHaveBeenCalled()
  })

  it('refuse une page d une autre association', async () => {
    await expect(
      uploadPageShareImageService({
        organizationId: ORG_ID,
        pageId: OTHER_PAGE_ID,
        file: imageFile(),
      })
    ).rejects.toThrow('Page introuvable')
    expect(storage.upload).not.toHaveBeenCalled()
  })
})
