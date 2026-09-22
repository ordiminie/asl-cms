import {beforeEach, describe, expect, it, vi} from 'vitest'

const scope = vi.hoisted(() => ({current: undefined as string | undefined}))
const storage = vi.hoisted(() => ({
  upload: vi.fn(),
  download: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
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

import {getPageByIdDao} from '@/db/repositories/page-repository'

import {AuthorizationError} from '../errors/authorization-error'
import {
  readPageBlockFileService,
  uploadPageBlockFileService,
} from '../page-service'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const PAGE_ID = '33333333-3333-4333-8333-333333333333'
const BLOCK_ID = '55555555-5555-4555-8555-555555555555'

const withRole = (role: OrganizationRole): User => ({
  ...userTest,
  organizations: [
    {
      id: 'membership',
      organizationId: ORG_ID,
      userId: userTest.id,
      role,
      createdAt: new Date(),
    },
  ],
})

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
])
const PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37,
])

const fileFrom = (bytes: Uint8Array, name: string, type: string) =>
  new File([bytes as BlobPart], name, {type})

beforeEach(() => {
  vi.clearAllMocks()
  setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))
  vi.mocked(getPageByIdDao).mockResolvedValue({
    id: PAGE_ID,
    organizationId: ORG_ID,
    slug: 'qualite-de-leau',
    title: "Qualité de l'eau",
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    blocks: [],
  })
  storage.upload.mockResolvedValue(undefined)
  storage.download.mockResolvedValue(new Blob([PNG_BYTES as BlobPart]))
})

describe('uploadPageBlockFileService', () => {
  it('accepte une image dont la signature correspond, sous une clé serveur', async () => {
    const result = await uploadPageBlockFileService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
      blockId: BLOCK_ID,
      kind: 'image',
      file: fileFrom(PNG_BYTES, 'photo.png', 'image/png'),
    })

    expect(result.status).toBe('uploaded')
    if (result.status !== 'uploaded') return
    expect(result.key).toMatch(
      new RegExp(`^${ORG_ID}/pages/${PAGE_ID}/${BLOCK_ID}-[0-9a-f-]+\\.png$`)
    )
    expect(storage.upload).toHaveBeenCalledTimes(1)
  })

  it('refuse un fichier dont la signature ne correspond pas au type déclaré', async () => {
    const result = await uploadPageBlockFileService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
      blockId: BLOCK_ID,
      kind: 'image',
      file: fileFrom(PDF_BYTES, 'photo.png', 'image/png'),
    })

    expect(result).toEqual({status: 'rejected', reason: 'format'})
    expect(storage.upload).not.toHaveBeenCalled()
  })

  it('accepte un PDF pour un bloc document', async () => {
    const result = await uploadPageBlockFileService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
      blockId: BLOCK_ID,
      kind: 'document',
      file: fileFrom(PDF_BYTES, 'compte-rendu.pdf', 'application/pdf'),
    })

    expect(result.status).toBe('uploaded')
    if (result.status !== 'uploaded') return
    expect(result.key.endsWith('.pdf')).toBe(true)
    expect(result.fileName).toBe('compte-rendu.pdf')
  })

  it('refuse une image déguisée en document', async () => {
    const result = await uploadPageBlockFileService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
      blockId: BLOCK_ID,
      kind: 'document',
      file: fileFrom(PNG_BYTES, 'compte-rendu.pdf', 'application/pdf'),
    })

    expect(result).toEqual({status: 'rejected', reason: 'format'})
  })

  it('refuse un membre non-bureau', async () => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.MEMBER))

    await expect(
      uploadPageBlockFileService({
        organizationId: ORG_ID,
        pageId: PAGE_ID,
        blockId: BLOCK_ID,
        kind: 'image',
        file: fileFrom(PNG_BYTES, 'photo.png', 'image/png'),
      })
    ).rejects.toThrow(AuthorizationError)
    expect(storage.upload).not.toHaveBeenCalled()
  })

  it("refuse une page qui n'appartient pas à l'association", async () => {
    vi.mocked(getPageByIdDao).mockResolvedValue(undefined)

    await expect(
      uploadPageBlockFileService({
        organizationId: ORG_ID,
        pageId: PAGE_ID,
        blockId: BLOCK_ID,
        kind: 'image',
        file: fileFrom(PNG_BYTES, 'photo.png', 'image/png'),
      })
    ).rejects.toThrow()
    expect(storage.upload).not.toHaveBeenCalled()
  })
})

describe('readPageBlockFileService', () => {
  it('sert une clé du préfixe de l’association résolue', async () => {
    const result = await readPageBlockFileService(
      ORG_ID,
      `${ORG_ID}/pages/${PAGE_ID}/${BLOCK_ID}-abc.png`
    )

    expect(result.contentType).toBe('image/png')
    expect(storage.download).toHaveBeenCalledWith(
      `${ORG_ID}/pages/${PAGE_ID}/${BLOCK_ID}-abc.png`
    )
  })

  it('refuse une clé appartenant à une autre association', async () => {
    await expect(
      readPageBlockFileService(
        ORG_ID,
        `${OTHER_ORG_ID}/pages/${PAGE_ID}/${BLOCK_ID}-abc.png`
      )
    ).rejects.toThrow()
    expect(storage.download).not.toHaveBeenCalled()
  })

  it('refuse une clé hors du dossier des pages', async () => {
    await expect(
      readPageBlockFileService(ORG_ID, `${ORG_ID}/identity/logo-abc.png`)
    ).rejects.toThrow()
    expect(storage.download).not.toHaveBeenCalled()
  })

  it('refuse une remontée de chemin', async () => {
    await expect(
      readPageBlockFileService(
        ORG_ID,
        `${ORG_ID}/pages/${PAGE_ID}/../../${OTHER_ORG_ID}/identity/logo.png`
      )
    ).rejects.toThrow()
    expect(storage.download).not.toHaveBeenCalled()
  })

  it('refuse une extension que le produit ne sert pas', async () => {
    await expect(
      readPageBlockFileService(
        ORG_ID,
        `${ORG_ID}/pages/${PAGE_ID}/${BLOCK_ID}-abc.svg`
      )
    ).rejects.toThrow()
    expect(storage.download).not.toHaveBeenCalled()
  })
})
