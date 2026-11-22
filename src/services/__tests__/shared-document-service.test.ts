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
vi.mock('@/db/repositories/shared-document-repository', () => ({
  createSharedDocumentDao: vi.fn(),
  deleteSharedDocumentDao: vi.fn(),
  getSharedDocumentByIdDao: vi.fn(),
  listSharedDocumentsDao: vi.fn(),
  countSharedDocumentsByCategoryDao: vi.fn(),
}))
vi.mock('@/db/repositories/association-category-repository', () => ({
  listActiveCategoriesDao: vi.fn(),
}))
vi.mock('@/lib/files/storage/storage-factory', () => ({
  createStorage: vi.fn(() => storage),
}))

import {listActiveCategoriesDao} from '@/db/repositories/association-category-repository'
import {
  createSharedDocumentDao,
  deleteSharedDocumentDao,
  getSharedDocumentByIdDao,
  listSharedDocumentsDao,
} from '@/db/repositories/shared-document-repository'
import {logger} from '@/lib/logger'

import {AuthorizationError} from '../errors/authorization-error'
import {NotFoundError} from '../errors/not-found-error'
import {UnauthenticatedError} from '../errors/unauthenticated-error'
import {ValidationParsedZodError} from '../errors/validation-error'
import {
  canManageSharedDocumentsService,
  deleteSharedDocumentService,
  getSharedDocumentsForBureauService,
  getSharedDocumentsForMemberService,
  publishSharedDocumentService,
  readSharedDocumentFileService,
} from '../shared-document-service'
import {CategoryDomainConst} from '../types/domain/association-category-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {
  SHARED_DOCUMENT_TITLE_MAX_LENGTH,
  SharedDocumentIssueConst,
} from '../types/domain/shared-document-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const DOCUMENT_ID = '33333333-3333-4333-8333-333333333333'
const CATEGORY_ID = '44444444-4444-4444-8444-444444444444'
const FILE_KEY = `${ORG_ID}/shared-documents/${DOCUMENT_ID}/file-old.pdf`

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
])
const PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25,
])
const TEN_MEGABYTES = 10 * 1024 * 1024

const pdfFile = (bytes: Uint8Array = PDF_BYTES) =>
  new File([bytes as BlobPart], 'statuts.pdf', {type: 'application/pdf'})

const oversizedPdf = () => {
  const bytes = new Uint8Array(TEN_MEGABYTES + 1)
  bytes.set(PDF_BYTES)
  return pdfFile(bytes)
}

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
  domain: CategoryDomainConst.DOCUMENT,
  name: 'Statuts',
  routingEmail: null,
  createdAt: new Date('2026-11-01'),
  deletedAt: null,
  ...overrides,
})

const documentRow = (overrides: Record<string, unknown> = {}) => ({
  id: DOCUMENT_ID,
  organizationId: ORG_ID,
  title: "Statuts de l'ASL",
  categoryId: CATEGORY_ID,
  fileKey: FILE_KEY,
  fileBytes: 634_880,
  createdAt: new Date('2026-11-20T10:00:00Z'),
  ...overrides,
})

const publishInput = (overrides: Record<string, unknown> = {}) => ({
  organizationId: ORG_ID,
  title: "  Statuts de l'ASL  ",
  categoryId: CATEGORY_ID,
  file: pdfFile(),
  ...overrides,
})

const uploadedKeys = (): string[] =>
  storage.upload.mock.calls.map((call) => call[1] as string)

beforeEach(() => {
  vi.clearAllMocks()
  scope.current = undefined
  storage.upload.mockResolvedValue({path: 'ok'})
  storage.delete.mockResolvedValue(undefined)
  storage.download.mockResolvedValue(new Blob([PDF_BYTES as BlobPart]))
  vi.mocked(listActiveCategoriesDao).mockResolvedValue([categoryRow()])
  vi.mocked(createSharedDocumentDao).mockImplementation(async (input) =>
    documentRow(input)
  )
  vi.mocked(getSharedDocumentByIdDao).mockResolvedValue(documentRow())
  vi.mocked(deleteSharedDocumentDao).mockResolvedValue(documentRow())
  vi.mocked(listSharedDocumentsDao).mockResolvedValue([
    {...documentRow(), categoryName: 'Statuts'},
  ])
})

describe('publishSharedDocumentService — dépôt (critère 1)', () => {
  it.each([
    ['[SUPER_ADMIN]', userTestSuperAdmin],
    ['[ORGANIZATION OWNER]', withRole('owner')],
    ['[ORGANIZATION BOARD]', withRole('board')],
  ])(
    '%s dépose un PDF : fichier écrit, puis ligne insérée',
    async (_, user) => {
      setupAuthUserMocked(user)
      const order: string[] = []
      storage.upload.mockImplementation(async () => {
        order.push('upload')
        return {path: 'ok'}
      })
      vi.mocked(createSharedDocumentDao).mockImplementation(async (input) => {
        order.push(`insert:${scope.current}`)
        return documentRow(input)
      })

      const result = await publishSharedDocumentService(publishInput())

      expect(result.status).toBe('published')
      expect(order).toEqual(['upload', `insert:${ORG_ID}`])
      const [key] = uploadedKeys()
      expect(key).toMatch(
        new RegExp(
          `^${ORG_ID}/shared-documents/[0-9a-f-]{36}/file-[0-9a-f-]{36}\\.pdf$`
        )
      )
      expect(createSharedDocumentDao).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_ID,
          title: "Statuts de l'ASL",
          categoryId: CATEGORY_ID,
          fileKey: key,
          fileBytes: PDF_BYTES.length,
        })
      )
      const insertedId = vi.mocked(createSharedDocumentDao).mock.calls[0][0].id
      expect(key).toContain(`/shared-documents/${insertedId}/`)
    }
  )

  it('ne rend jamais la clé de stockage dans le résultat', async () => {
    setupAuthUserMocked(withRole('owner'))

    const result = await publishSharedDocumentService(publishInput())

    expect(JSON.stringify(result)).not.toContain('shared-documents/')
  })

  it.each([
    ['[ORGANIZATION MEMBER]', withRole('member')],
    ["[OWNER D'UNE AUTRE ASSOCIATION]", withRole('owner', OTHER_ORG_ID)],
    ['[SANS SESSION]', undefined],
  ])('%s ne dépose rien', async (_, user) => {
    setupAuthUserMocked(user)

    await expect(publishSharedDocumentService(publishInput())).rejects.toThrow(
      AuthorizationError
    )
    expect(storage.upload).not.toHaveBeenCalled()
    expect(createSharedDocumentDao).not.toHaveBeenCalled()
    expect(listActiveCategoriesDao).not.toHaveBeenCalled()
  })

  it("refuse un identifiant d'association invalide", async () => {
    setupAuthUserMocked(withRole('owner'))

    await expect(
      publishSharedDocumentService(publishInput({organizationId: 'x'}))
    ).rejects.toThrow(ValidationParsedZodError)
  })

  it.each([
    ['titre vide', {title: '   '}, SharedDocumentIssueConst.TITLE_MISSING],
    [
      'titre trop long',
      {title: 'a'.repeat(SHARED_DOCUMENT_TITLE_MAX_LENGTH + 1)},
      SharedDocumentIssueConst.TITLE_TOO_LONG,
    ],
    [
      'catégorie absente',
      {categoryId: ''},
      SharedDocumentIssueConst.CATEGORY_MISSING,
    ],
    [
      'catégorie inconnue, supprimée ou d un autre domaine',
      {categoryId: '55555555-5555-4555-8555-555555555555'},
      SharedDocumentIssueConst.CATEGORY_UNAVAILABLE,
    ],
    ['fichier absent', {file: null}, SharedDocumentIssueConst.FILE_MISSING],
    [
      'fichier vide',
      {file: pdfFile(new Uint8Array())},
      SharedDocumentIssueConst.FILE_MISSING,
    ],
    [
      'non-PDF',
      {file: pdfFile(PNG_BYTES)},
      SharedDocumentIssueConst.FILE_FORMAT,
    ],
    [
      'plus de 10 Mo',
      {file: oversizedPdf()},
      SharedDocumentIssueConst.FILE_SIZE,
    ],
  ])('refuse %s sans rien écrire', async (_, overrides, issue) => {
    setupAuthUserMocked(withRole('owner'))

    const result = await publishSharedDocumentService(publishInput(overrides))

    expect(result).toEqual({status: 'rejected', issues: [issue]})
    expect(storage.upload).not.toHaveBeenCalled()
    expect(createSharedDocumentDao).not.toHaveBeenCalled()
  })

  it('accepte un titre de 120 caractères pile', async () => {
    setupAuthUserMocked(withRole('owner'))

    const result = await publishSharedDocumentService(
      publishInput({title: 'a'.repeat(SHARED_DOCUMENT_TITLE_MAX_LENGTH)})
    )

    expect(result.status).toBe('published')
  })

  it('ne propose que les catégories actives du domaine document de cette association', async () => {
    setupAuthUserMocked(withRole('owner'))
    let readUnder: string | undefined
    vi.mocked(listActiveCategoriesDao).mockImplementation(async () => {
      readUnder = scope.current
      return [categoryRow()]
    })

    await publishSharedDocumentService(publishInput())

    expect(listActiveCategoriesDao).toHaveBeenCalledWith(
      ORG_ID,
      CategoryDomainConst.DOCUMENT
    )
    expect(readUnder).toBe(ORG_ID)
  })

  it('cumule les refus pour une correction en une fois', async () => {
    setupAuthUserMocked(withRole('owner'))

    const result = await publishSharedDocumentService(
      publishInput({title: '', categoryId: '', file: null})
    )

    expect(result).toEqual({
      status: 'rejected',
      issues: [
        SharedDocumentIssueConst.TITLE_MISSING,
        SharedDocumentIssueConst.CATEGORY_MISSING,
        SharedDocumentIssueConst.FILE_MISSING,
      ],
    })
  })

  it("efface le fichier écrit si l'insertion échoue, et propage l'erreur", async () => {
    setupAuthUserMocked(withRole('owner'))
    vi.mocked(createSharedDocumentDao).mockRejectedValue(new Error('db down'))

    await expect(publishSharedDocumentService(publishInput())).rejects.toThrow(
      'db down'
    )
    expect(storage.delete).toHaveBeenCalledWith(uploadedKeys()[0])
  })

  it("n'insère aucune ligne si l'écriture du fichier échoue", async () => {
    setupAuthUserMocked(withRole('owner'))
    storage.upload.mockRejectedValue(new Error('disk full'))

    await expect(publishSharedDocumentService(publishInput())).rejects.toThrow(
      'disk full'
    )
    expect(createSharedDocumentDao).not.toHaveBeenCalled()
  })
})

describe('deleteSharedDocumentService — retrait (critère 5)', () => {
  it('supprime la ligne sous le tenant, puis efface le fichier', async () => {
    setupAuthUserMocked(withRole('board'))
    const order: string[] = []
    vi.mocked(deleteSharedDocumentDao).mockImplementation(async () => {
      order.push(`delete-row:${scope.current}`)
      return documentRow()
    })
    storage.delete.mockImplementation(async () => {
      order.push('delete-file')
    })

    const result = await deleteSharedDocumentService({
      organizationId: ORG_ID,
      documentId: DOCUMENT_ID,
    })

    expect(result).toEqual({status: 'deleted', title: "Statuts de l'ASL"})
    expect(order).toEqual([`delete-row:${ORG_ID}`, 'delete-file'])
    expect(storage.delete).toHaveBeenCalledWith(FILE_KEY)
  })

  it('un échec disque laisse un orphelin journalisé, pas une erreur', async () => {
    setupAuthUserMocked(withRole('owner'))
    storage.delete.mockRejectedValue(new Error('EIO'))

    const result = await deleteSharedDocumentService({
      organizationId: ORG_ID,
      documentId: DOCUMENT_ID,
    })

    expect(result.status).toBe('deleted')
    expect(logger.warn).toHaveBeenCalled()
  })

  it('rend NotFoundError pour un document inconnu ou d une autre association', async () => {
    setupAuthUserMocked(withRole('owner'))
    vi.mocked(deleteSharedDocumentDao).mockResolvedValue(undefined)

    await expect(
      deleteSharedDocumentService({
        organizationId: ORG_ID,
        documentId: DOCUMENT_ID,
      })
    ).rejects.toThrow(NotFoundError)
    expect(storage.delete).not.toHaveBeenCalled()
  })

  it.each([
    ['[ORGANIZATION MEMBER]', withRole('member')],
    ["[OWNER D'UNE AUTRE ASSOCIATION]", withRole('owner', OTHER_ORG_ID)],
    ['[SANS SESSION]', undefined],
  ])('%s ne retire rien', async (_, user) => {
    setupAuthUserMocked(user)

    await expect(
      deleteSharedDocumentService({
        organizationId: ORG_ID,
        documentId: DOCUMENT_ID,
      })
    ).rejects.toThrow(AuthorizationError)
    expect(deleteSharedDocumentDao).not.toHaveBeenCalled()
    expect(storage.delete).not.toHaveBeenCalled()
  })
})

describe('getSharedDocumentsForMemberService — espace membre (critère 2)', () => {
  it.each([
    ['[SUPER_ADMIN]', userTestSuperAdmin],
    ['[ORGANIZATION OWNER]', withRole('owner')],
    ['[ORGANIZATION BOARD]', withRole('board')],
    ['[ORGANIZATION MEMBER]', withRole('member')],
  ])(
    '%s lit les documents, rangés par catégorie, sans clé',
    async (_, user) => {
      setupAuthUserMocked(user)
      let readUnder: string | undefined
      vi.mocked(listSharedDocumentsDao).mockImplementation(async () => {
        readUnder = scope.current
        return [{...documentRow(), categoryName: 'Statuts'}]
      })

      const documents = await getSharedDocumentsForMemberService(ORG_ID)

      expect(listSharedDocumentsDao).toHaveBeenCalledWith(ORG_ID, 'category')
      expect(readUnder).toBe(ORG_ID)
      expect(documents).toEqual([
        {
          id: DOCUMENT_ID,
          title: "Statuts de l'ASL",
          categoryName: 'Statuts',
          fileBytes: 634_880,
          createdAt: new Date('2026-11-20T10:00:00Z'),
        },
      ])
    }
  )

  it.each([
    ["[MEMBRE D'UNE AUTRE ASSOCIATION]", withRole('member', OTHER_ORG_ID)],
    ['[SANS SESSION]', undefined],
  ])('%s ne lit rien', async (_, user) => {
    setupAuthUserMocked(user)

    await expect(getSharedDocumentsForMemberService(ORG_ID)).rejects.toThrow(
      AuthorizationError
    )
    expect(listSharedDocumentsDao).not.toHaveBeenCalled()
  })
})

describe('getSharedDocumentsForBureauService — liste du bureau', () => {
  it('[ORGANIZATION OWNER] lit les documents du plus récent au plus ancien', async () => {
    setupAuthUserMocked(withRole('owner'))

    const documents = await getSharedDocumentsForBureauService(ORG_ID)

    expect(listSharedDocumentsDao).toHaveBeenCalledWith(ORG_ID, 'recent')
    expect(documents).toEqual([
      expect.objectContaining({id: DOCUMENT_ID, categoryId: CATEGORY_ID}),
    ])
    expect(JSON.stringify(documents)).not.toContain('shared-documents/')
  })

  it('[ORGANIZATION MEMBER] ne lit pas la liste du bureau', async () => {
    setupAuthUserMocked(withRole('member'))

    await expect(getSharedDocumentsForBureauService(ORG_ID)).rejects.toThrow(
      AuthorizationError
    )
    expect(listSharedDocumentsDao).not.toHaveBeenCalled()
  })
})

describe('readSharedDocumentFileService — lecture du fichier (critères 2 à 5)', () => {
  it.each([
    ['[SUPER_ADMIN]', userTestSuperAdmin],
    ['[ORGANIZATION OWNER]', withRole('owner')],
    ['[ORGANIZATION MEMBER]', withRole('member')],
  ])('%s lit le fichier, clé relue en base sous le tenant', async (_, user) => {
    setupAuthUserMocked(user)
    let readUnder: string | undefined
    vi.mocked(getSharedDocumentByIdDao).mockImplementation(async () => {
      readUnder = scope.current
      return documentRow()
    })

    const file = await readSharedDocumentFileService(ORG_ID, DOCUMENT_ID)

    expect(getSharedDocumentByIdDao).toHaveBeenCalledWith(DOCUMENT_ID)
    expect(readUnder).toBe(ORG_ID)
    expect(storage.download).toHaveBeenCalledWith(FILE_KEY)
    expect(file.title).toBe("Statuts de l'ASL")
    expect(new Uint8Array(await file.content.arrayBuffer())).toEqual(PDF_BYTES)
  })

  it('[SANS SESSION] lève UnauthenticatedError sans rien lire', async () => {
    setupAuthUserMocked(undefined)

    await expect(
      readSharedDocumentFileService(ORG_ID, DOCUMENT_ID)
    ).rejects.toThrow(UnauthenticatedError)
    expect(getSharedDocumentByIdDao).not.toHaveBeenCalled()
    expect(storage.download).not.toHaveBeenCalled()
  })

  it("[MEMBRE D'UNE AUTRE ASSOCIATION] lève AuthorizationError sans rien lire", async () => {
    setupAuthUserMocked(withRole('member', OTHER_ORG_ID))

    await expect(
      readSharedDocumentFileService(ORG_ID, DOCUMENT_ID)
    ).rejects.toThrow(AuthorizationError)
    expect(getSharedDocumentByIdDao).not.toHaveBeenCalled()
  })

  it('lève NotFoundError pour un document inconnu, retiré ou d une autre association', async () => {
    setupAuthUserMocked(withRole('member'))
    vi.mocked(getSharedDocumentByIdDao).mockResolvedValue(undefined)

    await expect(
      readSharedDocumentFileService(ORG_ID, DOCUMENT_ID)
    ).rejects.toThrow(NotFoundError)
    expect(storage.download).not.toHaveBeenCalled()
  })

  it('refuse un identifiant qui n est pas un uuid', async () => {
    setupAuthUserMocked(withRole('member'))

    await expect(
      readSharedDocumentFileService(ORG_ID, '../etc/passwd')
    ).rejects.toThrow(ValidationParsedZodError)
    expect(getSharedDocumentByIdDao).not.toHaveBeenCalled()
  })
})

describe('canManageSharedDocumentsService', () => {
  it.each([
    ['owner', withRole('owner'), true],
    ['board', withRole('board'), true],
    ['member', withRole('member'), false],
    ['autre association', withRole('owner', OTHER_ORG_ID), false],
    ['sans session', undefined, false],
  ])('%s → %s', async (_, user, expected) => {
    setupAuthUserMocked(user)

    expect(await canManageSharedDocumentsService(ORG_ID)).toBe(expected)
  })

  it('rend false pour un identifiant invalide', async () => {
    setupAuthUserMocked(withRole('owner'))

    expect(await canManageSharedDocumentsService('x')).toBe(false)
  })
})
