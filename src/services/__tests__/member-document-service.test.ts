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
vi.mock('@/db/repositories/member-document-repository', () => ({
  createMemberDocumentDao: vi.fn(),
  getMemberDocumentByIdDao: vi.fn(),
  listMemberDocumentsByProfilesDao: vi.fn(),
  listMemberDocumentsByProfileDao: vi.fn(),
  listMemberDocumentsForBureauDao: vi.fn(),
  countMemberDocumentsByCategoryDao: vi.fn(),
  deleteMemberDocumentDao: vi.fn(),
  getMemberProfileIdsByPennylaneReferenceDao: vi.fn(),
  countMemberProfilesWithoutReferenceDao: vi.fn(),
}))
vi.mock('@/db/repositories/member-profile-repository', () => ({
  getMemberProfileByIdDao: vi.fn(),
  countMemberProfilesDao: vi.fn(),
  getCurrentParcelNumbersByProfileDao: vi.fn(),
}))
vi.mock('@/db/repositories/association-category-repository', () => ({
  listActiveCategoriesDao: vi.fn(),
}))
vi.mock('@/db/repositories/parcel-ownership-repository', () => ({
  listOwnershipPeriodsByProfilesDao: vi.fn(),
}))
vi.mock('../member-profile-access-service', () => ({
  getMyAccessibleProfiles: vi.fn(),
}))
vi.mock('@/lib/files/storage/storage-factory', () => ({
  createStorage: vi.fn(() => storage),
}))

import {listActiveCategoriesDao} from '@/db/repositories/association-category-repository'
import {
  countMemberDocumentsByCategoryDao,
  countMemberProfilesWithoutReferenceDao,
  createMemberDocumentDao,
  deleteMemberDocumentDao,
  getMemberDocumentByIdDao,
  getMemberProfileIdsByPennylaneReferenceDao,
  listMemberDocumentsByProfileDao,
  listMemberDocumentsByProfilesDao,
  listMemberDocumentsForBureauDao,
} from '@/db/repositories/member-document-repository'
import {
  countMemberProfilesDao,
  getCurrentParcelNumbersByProfileDao,
  getMemberProfileByIdDao,
} from '@/db/repositories/member-profile-repository'
import {listOwnershipPeriodsByProfilesDao} from '@/db/repositories/parcel-ownership-repository'
import {createStorage} from '@/lib/files/storage/storage-factory'
import {logger} from '@/lib/logger'

import {AuthorizationError} from '../errors/authorization-error'
import {NotFoundError} from '../errors/not-found-error'
import {UnauthenticatedError} from '../errors/unauthenticated-error'
import {ValidationParsedZodError} from '../errors/validation-error'
import {
  depositMemberDocumentBatchLineService,
  depositMemberDocumentService,
  getMemberDocumentBatchReachService,
  getMemberDocumentsForBureauService,
  getMemberDocumentsOfProfileForBureauService,
  getMyMemberDocumentsService,
  readMemberDocumentFileService,
  removeMemberDocumentService,
} from '../member-document-service'
import {getMyAccessibleProfiles} from '../member-profile-access-service'
import {CategoryDomainConst} from '../types/domain/association-category-types'
import {
  MEMBER_DOCUMENT_TITLE_MAX_LENGTH,
  MemberDocumentIssueConst,
} from '../types/domain/member-document-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const DOCUMENT_ID = '33333333-3333-4333-8333-333333333333'
const CATEGORY_ID = '44444444-4444-4444-8444-444444444444'
const PROFILE_ID = 'a1200000-0000-4000-8000-000000000001'
const OTHER_PROFILE_ID = 'a1200000-0000-4000-8000-000000000002'
const FOLDER = `${ORG_ID}/member-documents/${PROFILE_ID}`
const FILE_NAME = `${DOCUMENT_ID}-55555555-5555-4555-8555-555555555555.pdf`
const FILE_KEY = `${FOLDER}/${FILE_NAME}`

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
])
const PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25,
])
const TEN_MEGABYTES = 10 * 1024 * 1024

const pdfFile = (bytes: Uint8Array = PDF_BYTES) =>
  new File([bytes as BlobPart], 'facture.pdf', {type: 'application/pdf'})

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
  domain: CategoryDomainConst.MEMBER_DOCUMENT,
  name: 'Facture',
  routingEmail: null,
  createdAt: new Date('2026-11-01'),
  deletedAt: null,
  ...overrides,
})

const profileRow = (overrides: Record<string, unknown> = {}) =>
  ({
    id: PROFILE_ID,
    organizationId: ORG_ID,
    name: 'Bernard Lefèvre',
    email: null,
    mailOnly: false,
    pennylaneCustomerId: null,
    ...overrides,
  }) as never

const documentRow = (overrides: Record<string, unknown> = {}) => ({
  id: DOCUMENT_ID,
  organizationId: ORG_ID,
  memberProfileId: PROFILE_ID,
  title: 'Facture 2026',
  categoryId: CATEGORY_ID,
  documentDate: '2026-03-15',
  fileKey: FILE_KEY,
  fileBytes: 317_440,
  createdAt: new Date('2026-11-20T10:00:00Z'),
  ...overrides,
})

const depositInput = (overrides: Record<string, unknown> = {}) => ({
  organizationId: ORG_ID,
  memberProfileId: PROFILE_ID,
  title: '  Facture 2026  ',
  categoryId: CATEGORY_ID,
  documentDate: '2026-03-15',
  file: pdfFile(),
  ...overrides,
})

const storageBasePaths = (): string[] =>
  vi
    .mocked(createStorage)
    .mock.calls.map(([, config]) => (config as {basePath: string}).basePath)

beforeEach(() => {
  vi.clearAllMocks()
  scope.current = undefined
  storage.upload.mockResolvedValue({path: 'ok'})
  storage.delete.mockResolvedValue(undefined)
  storage.download.mockResolvedValue(new Blob([PDF_BYTES as BlobPart]))
  vi.mocked(listActiveCategoriesDao).mockResolvedValue([categoryRow()])
  vi.mocked(getMemberProfileByIdDao).mockResolvedValue(profileRow())
  vi.mocked(createMemberDocumentDao).mockImplementation(async (input) =>
    documentRow(input)
  )
  vi.mocked(deleteMemberDocumentDao).mockResolvedValue(documentRow())
  vi.mocked(listMemberDocumentsByProfileDao).mockResolvedValue([
    {...documentRow(), categoryName: 'Facture'},
  ])
  vi.mocked(listMemberDocumentsForBureauDao).mockResolvedValue({
    rows: [
      {
        ...documentRow(),
        categoryName: 'Facture',
        memberProfileName: 'Bernard Lefèvre',
      },
    ],
    total: 1,
  })
  vi.mocked(countMemberDocumentsByCategoryDao).mockResolvedValue({
    [CATEGORY_ID]: 1,
  })
  vi.mocked(getCurrentParcelNumbersByProfileDao).mockResolvedValue({
    [PROFILE_ID]: ['61', '62'],
  })
})

describe('depositMemberDocumentService — dépôt pour une fiche (critère 1)', () => {
  it.each([
    ['[SUPER_ADMIN]', userTestSuperAdmin],
    ['[ORGANIZATION OWNER]', withRole('owner')],
    ['[ORGANIZATION BOARD]', withRole('board')],
  ])(
    '%s dépose un PDF : fichier écrit dans le dossier de la fiche, puis ligne insérée',
    async (_, user) => {
      setupAuthUserMocked(user)
      const order: string[] = []
      storage.upload.mockImplementation(async () => {
        order.push('upload')
        return {path: 'ok'}
      })
      vi.mocked(createMemberDocumentDao).mockImplementation(async (input) => {
        order.push(`insert:${scope.current}`)
        return documentRow(input)
      })

      const result = await depositMemberDocumentService(depositInput())

      expect(result.status).toBe('deposited')
      expect(order).toEqual(['upload', `insert:${ORG_ID}`])
      const inserted = vi.mocked(createMemberDocumentDao).mock.calls[0][0]
      expect(inserted).toEqual(
        expect.objectContaining({
          organizationId: ORG_ID,
          memberProfileId: PROFILE_ID,
          title: 'Facture 2026',
          categoryId: CATEGORY_ID,
          documentDate: '2026-03-15',
          fileBytes: PDF_BYTES.length,
        })
      )
      expect(inserted.fileKey).toMatch(
        new RegExp(`^${FOLDER}/${inserted.id}-[0-9a-f-]{36}\\.pdf$`)
      )
    }
  )

  it('ouvre le stockage sur le dossier de la fiche et ne lui passe que le nom du fichier (ADR 073 §3)', async () => {
    setupAuthUserMocked(withRole('owner'))

    await depositMemberDocumentService(depositInput())

    expect(storageBasePaths()).toEqual([FOLDER])
    const [, name] = storage.upload.mock.calls[0]
    expect(name).not.toContain('/')
    const inserted = vi.mocked(createMemberDocumentDao).mock.calls[0][0]
    expect(inserted.fileKey).toBe(`${FOLDER}/${name}`)
  })

  it('le dossier suit la fiche visée : deux fiches, deux dossiers distincts', async () => {
    setupAuthUserMocked(withRole('owner'))
    vi.mocked(getMemberProfileByIdDao).mockImplementation(async (id) =>
      profileRow({id})
    )

    await depositMemberDocumentService(depositInput())
    await depositMemberDocumentService(
      depositInput({memberProfileId: OTHER_PROFILE_ID})
    )

    expect(storageBasePaths()).toEqual([
      FOLDER,
      `${ORG_ID}/member-documents/${OTHER_PROFILE_ID}`,
    ])
  })

  it('ne rend jamais la clé de stockage dans le résultat', async () => {
    setupAuthUserMocked(withRole('owner'))

    const result = await depositMemberDocumentService(depositInput())

    expect(JSON.stringify(result)).not.toContain('member-documents/')
  })

  it('date du document absente : le jour du dépôt', async () => {
    setupAuthUserMocked(withRole('owner'))

    await depositMemberDocumentService(depositInput({documentDate: ''}))

    const inserted = vi.mocked(createMemberDocumentDao).mock.calls[0][0]
    expect(inserted.documentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it.each([
    ['[ORGANIZATION MEMBER]', withRole('member')],
    ["[OWNER D'UNE AUTRE ASSOCIATION]", withRole('owner', OTHER_ORG_ID)],
    ['[SANS SESSION]', undefined],
  ])('%s ne dépose rien', async (_, user) => {
    setupAuthUserMocked(user)

    await expect(depositMemberDocumentService(depositInput())).rejects.toThrow(
      AuthorizationError
    )
    expect(storage.upload).not.toHaveBeenCalled()
    expect(createMemberDocumentDao).not.toHaveBeenCalled()
    expect(getMemberProfileByIdDao).not.toHaveBeenCalled()
  })

  it('refuse une fiche invisible sous le tenant (autre association) sans rien écrire', async () => {
    setupAuthUserMocked(withRole('owner'))
    let readUnder: string | undefined
    vi.mocked(getMemberProfileByIdDao).mockImplementation(async () => {
      readUnder = scope.current
      return undefined
    })

    await expect(depositMemberDocumentService(depositInput())).rejects.toThrow(
      NotFoundError
    )
    expect(readUnder).toBe(ORG_ID)
    expect(storage.upload).not.toHaveBeenCalled()
    expect(createMemberDocumentDao).not.toHaveBeenCalled()
  })

  it.each([
    ["l'association", {organizationId: 'x'}],
    ['la fiche', {memberProfileId: '../x'}],
  ])('refuse un identifiant invalide de %s', async (_, overrides) => {
    setupAuthUserMocked(withRole('owner'))

    await expect(
      depositMemberDocumentService(depositInput(overrides))
    ).rejects.toThrow(ValidationParsedZodError)
    expect(storage.upload).not.toHaveBeenCalled()
  })

  it.each([
    ['titre vide', {title: '   '}, MemberDocumentIssueConst.TITLE_MISSING],
    [
      'titre trop long',
      {title: 'a'.repeat(MEMBER_DOCUMENT_TITLE_MAX_LENGTH + 1)},
      MemberDocumentIssueConst.TITLE_TOO_LONG,
    ],
    [
      'catégorie absente',
      {categoryId: ''},
      MemberDocumentIssueConst.CATEGORY_MISSING,
    ],
    [
      'catégorie inconnue, supprimée ou d un autre domaine',
      {categoryId: '66666666-6666-4666-8666-666666666666'},
      MemberDocumentIssueConst.CATEGORY_UNAVAILABLE,
    ],
    [
      'date invalide',
      {documentDate: '2026-02-30'},
      MemberDocumentIssueConst.DATE_INVALID,
    ],
    ['fichier absent', {file: null}, MemberDocumentIssueConst.FILE_MISSING],
    [
      'non-PDF',
      {file: pdfFile(PNG_BYTES)},
      MemberDocumentIssueConst.FILE_FORMAT,
    ],
    [
      'plus de 10 Mo',
      {file: oversizedPdf()},
      MemberDocumentIssueConst.FILE_SIZE,
    ],
  ])('refuse %s sans rien écrire', async (_, overrides, issue) => {
    setupAuthUserMocked(withRole('owner'))

    const result = await depositMemberDocumentService(depositInput(overrides))

    expect(result).toEqual({status: 'rejected', issues: [issue]})
    expect(storage.upload).not.toHaveBeenCalled()
    expect(createMemberDocumentDao).not.toHaveBeenCalled()
  })

  it('lit les catégories actives du domaine member_document, sous le tenant', async () => {
    setupAuthUserMocked(withRole('owner'))

    await depositMemberDocumentService(depositInput())

    expect(listActiveCategoriesDao).toHaveBeenCalledWith(
      ORG_ID,
      CategoryDomainConst.MEMBER_DOCUMENT
    )
  })

  it("efface le fichier si l'insertion échoue, et propage l'erreur", async () => {
    setupAuthUserMocked(withRole('owner'))
    vi.mocked(createMemberDocumentDao).mockRejectedValue(new Error('db down'))

    await expect(depositMemberDocumentService(depositInput())).rejects.toThrow(
      'db down'
    )
    const [, uploaded] = storage.upload.mock.calls[0]
    expect(storage.delete).toHaveBeenCalledWith(uploaded)
    expect(storageBasePaths().every((base) => base === FOLDER)).toBe(true)
  })
})

describe('removeMemberDocumentService — retrait par le bureau', () => {
  it.each([
    ['[ORGANIZATION OWNER]', withRole('owner')],
    ['[ORGANIZATION BOARD]', withRole('board')],
    ['[SUPER_ADMIN]', userTestSuperAdmin],
  ])(
    '%s retire : la ligne puis le fichier, dans le dossier de sa fiche',
    async (_, user) => {
      setupAuthUserMocked(user)
      const order: string[] = []
      vi.mocked(deleteMemberDocumentDao).mockImplementation(async () => {
        order.push(`delete-row:${scope.current}`)
        return documentRow()
      })
      storage.delete.mockImplementation(async () => {
        order.push('delete-file')
      })

      const result = await removeMemberDocumentService({
        organizationId: ORG_ID,
        documentId: DOCUMENT_ID,
      })

      expect(result).toEqual({
        status: 'removed',
        title: 'Facture 2026',
        memberProfileId: PROFILE_ID,
      })
      expect(order).toEqual([`delete-row:${ORG_ID}`, 'delete-file'])
      expect(storageBasePaths()).toEqual([FOLDER])
      expect(storage.delete).toHaveBeenCalledWith(FILE_NAME)
    }
  )

  it('un échec disque laisse un orphelin journalisé, pas une erreur', async () => {
    setupAuthUserMocked(withRole('owner'))
    storage.delete.mockRejectedValue(new Error('disk'))

    const result = await removeMemberDocumentService({
      organizationId: ORG_ID,
      documentId: DOCUMENT_ID,
    })

    expect(result.status).toBe('removed')
    expect(logger.warn).toHaveBeenCalled()
  })

  it("une clé incohérente avec la fiche n'efface aucun fichier, et se journalise", async () => {
    setupAuthUserMocked(withRole('owner'))
    vi.mocked(deleteMemberDocumentDao).mockResolvedValue(
      documentRow({
        fileKey: `${ORG_ID}/member-documents/${OTHER_PROFILE_ID}/${FILE_NAME}`,
      })
    )

    const result = await removeMemberDocumentService({
      organizationId: ORG_ID,
      documentId: DOCUMENT_ID,
    })

    expect(result.status).toBe('removed')
    expect(storage.delete).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalled()
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain(
      'Lefèvre'
    )
  })

  it('document absent sous le tenant : NotFoundError', async () => {
    setupAuthUserMocked(withRole('owner'))
    vi.mocked(deleteMemberDocumentDao).mockResolvedValue(undefined)

    await expect(
      removeMemberDocumentService({
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
      removeMemberDocumentService({
        organizationId: ORG_ID,
        documentId: DOCUMENT_ID,
      })
    ).rejects.toThrow(AuthorizationError)
    expect(deleteMemberDocumentDao).not.toHaveBeenCalled()
    expect(storage.delete).not.toHaveBeenCalled()
  })
})

describe('getMemberDocumentsOfProfileForBureauService — section de la fiche', () => {
  it('[ORGANIZATION BOARD] lit les documents de la fiche sous le tenant, sans clé', async () => {
    setupAuthUserMocked(withRole('board'))
    let readUnder: string | undefined
    vi.mocked(listMemberDocumentsByProfileDao).mockImplementation(async () => {
      readUnder = scope.current
      return [{...documentRow(), categoryName: 'Facture'}]
    })

    const documents = await getMemberDocumentsOfProfileForBureauService(
      ORG_ID,
      PROFILE_ID
    )

    expect(readUnder).toBe(ORG_ID)
    expect(listMemberDocumentsByProfileDao).toHaveBeenCalledWith(PROFILE_ID)
    expect(documents).toEqual([
      expect.objectContaining({
        id: DOCUMENT_ID,
        title: 'Facture 2026',
        categoryName: 'Facture',
        documentDate: '2026-03-15',
        memberProfileId: PROFILE_ID,
        memberProfileName: 'Bernard Lefèvre',
      }),
    ])
    expect(JSON.stringify(documents)).not.toContain('member-documents/')
  })

  it.each([
    ['[ORGANIZATION MEMBER]', withRole('member')],
    ['[SANS SESSION]', undefined],
  ])('%s ne lit rien', async (_, user) => {
    setupAuthUserMocked(user)

    await expect(
      getMemberDocumentsOfProfileForBureauService(ORG_ID, PROFILE_ID)
    ).rejects.toThrow(AuthorizationError)
    expect(listMemberDocumentsByProfileDao).not.toHaveBeenCalled()
  })
})

describe('getMemberDocumentsForBureauService — vue d’ensemble (critère 6)', () => {
  it('[ORGANIZATION OWNER] lit une page de son association, avec le décompte par catégorie', async () => {
    setupAuthUserMocked(withRole('owner'))
    let readUnder: string | undefined
    vi.mocked(listMemberDocumentsForBureauDao).mockImplementation(async () => {
      readUnder = scope.current
      return {
        rows: [
          {
            ...documentRow(),
            categoryName: 'Facture',
            memberProfileName: 'Bernard Lefèvre',
          },
        ],
        total: 1,
      }
    })

    const page = await getMemberDocumentsForBureauService({
      organizationId: ORG_ID,
      search: ' Lef ',
      categoryId: CATEGORY_ID,
      page: 1,
    })

    expect(readUnder).toBe(ORG_ID)
    expect(listMemberDocumentsForBureauDao).toHaveBeenCalledWith(ORG_ID, {
      search: 'Lef',
      categoryId: CATEGORY_ID,
      page: 1,
      pageSize: 25,
    })
    expect(page).toEqual(
      expect.objectContaining({
        total: 1,
        page: 1,
        pageSize: 25,
        countsByCategory: {[CATEGORY_ID]: 1},
      })
    )
    expect(page.documents[0]).toEqual(
      expect.objectContaining({memberProfileName: 'Bernard Lefèvre'})
    )
    expect(getCurrentParcelNumbersByProfileDao).toHaveBeenCalledWith([
      PROFILE_ID,
    ])
    expect(page.parcelNumbersByProfile).toEqual({[PROFILE_ID]: ['61', '62']})
    expect(JSON.stringify(page)).not.toContain('member-documents/')
  })

  it.each([
    ['[ORGANIZATION MEMBER]', withRole('member')],
    ["[OWNER D'UNE AUTRE ASSOCIATION]", withRole('owner', OTHER_ORG_ID)],
  ])('%s ne lit rien', async (_, user) => {
    setupAuthUserMocked(user)

    await expect(
      getMemberDocumentsForBureauService({organizationId: ORG_ID, page: 1})
    ).rejects.toThrow(AuthorizationError)
    expect(listMemberDocumentsForBureauDao).not.toHaveBeenCalled()
  })
})

const THIRD_PROFILE_ID = 'a1200000-0000-4000-8000-000000000003'

const myProfile = (
  id: string,
  name: string,
  access: Record<string, string> = {status: 'owner'}
) => ({id, name, currentParcelNumbers: [], access}) as never

const period = (
  memberProfileId: string,
  number: string,
  startsOn: string,
  endsOn: string | null,
  meterNumber: string | null = null
) => ({memberProfileId, number, meterNumber, startsOn, endsOn})

describe('getMyMemberDocumentsService — « Mes documents » (critères 1, 3, 5)', () => {
  it('[USER] lit les documents de toutes ses fiches, chacun avec son terrain à sa date, date décroissante', async () => {
    setupAuthUserMocked({...withRole('member'), name: 'Bernard Lefèvre'})
    vi.mocked(getMyAccessibleProfiles).mockResolvedValue([
      myProfile(PROFILE_ID, 'Bernard Lefèvre'),
      myProfile(OTHER_PROFILE_ID, 'SCI Les Pins'),
    ])
    vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([
      period(PROFILE_ID, '13', '2010-01-01', null, '0045821'),
      period(PROFILE_ID, '12', '2010-01-01', null, '0045821'),
      period(OTHER_PROFILE_ID, '31', '2020-01-01', null),
    ])
    let readUnder: string | undefined
    vi.mocked(listMemberDocumentsByProfilesDao).mockImplementation(async () => {
      readUnder = scope.current
      return [
        {
          ...documentRow({id: 'doc-old', documentDate: '2025-01-10'}),
          categoryName: 'Convocation',
        },
        {
          ...documentRow({
            id: 'doc-new',
            memberProfileId: OTHER_PROFILE_ID,
            documentDate: '2026-03-15',
          }),
          categoryName: 'Facture',
        },
      ]
    })

    const documents = await getMyMemberDocumentsService(ORG_ID)

    expect(readUnder).toBe(ORG_ID)
    expect(getMyAccessibleProfiles).toHaveBeenCalledWith(ORG_ID, userTest.id)
    expect(listMemberDocumentsByProfilesDao).toHaveBeenCalledWith([
      PROFILE_ID,
      OTHER_PROFILE_ID,
    ])
    expect(documents).toEqual([
      expect.objectContaining({
        id: 'doc-new',
        categoryName: 'Facture',
        parcelNumbers: ['31'],
        meterNumber: null,
        holderName: 'SCI Les Pins',
      }),
      expect.objectContaining({
        id: 'doc-old',
        categoryName: 'Convocation',
        parcelNumbers: ['12', '13'],
        meterNumber: '0045821',
        holderName: null,
      }),
    ])
    expect(JSON.stringify(documents)).not.toContain('member-documents/')
  })

  it('vente : le terrain est celui de la fiche à la date du document (critère 5)', async () => {
    setupAuthUserMocked(withRole('member'))
    vi.mocked(getMyAccessibleProfiles).mockResolvedValue([
      myProfile(PROFILE_ID, userTest.name),
    ])
    vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([
      period(PROFILE_ID, '9', '2010-01-01', '2019-10-01'),
    ])
    vi.mocked(listMemberDocumentsByProfilesDao).mockResolvedValue([
      {...documentRow({documentDate: '2019-06-01'}), categoryName: 'Facture'},
    ])

    const [document] = await getMyMemberDocumentsService(ORG_ID)

    expect(document.parcelNumbers).toEqual(['9'])
  })

  it("ne demande que les documents des fiches reliées au compte : jamais ceux d'une autre", async () => {
    setupAuthUserMocked(withRole('member'))
    vi.mocked(getMyAccessibleProfiles).mockResolvedValue([
      myProfile(PROFILE_ID, userTest.name),
    ])
    vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([])
    vi.mocked(listMemberDocumentsByProfilesDao).mockResolvedValue([])

    await getMyMemberDocumentsService(ORG_ID)

    expect(listMemberDocumentsByProfilesDao).toHaveBeenCalledWith([PROFILE_ID])
  })

  it('compte sans fiche : aucun document, aucune lecture', async () => {
    setupAuthUserMocked(withRole('member'))
    vi.mocked(getMyAccessibleProfiles).mockResolvedValue([])

    expect(await getMyMemberDocumentsService(ORG_ID)).toEqual([])
    expect(listMemberDocumentsByProfilesDao).not.toHaveBeenCalled()
  })

  it('[SANS SESSION] ne lit rien', async () => {
    setupAuthUserMocked(undefined)

    await expect(getMyMemberDocumentsService(ORG_ID)).rejects.toThrow(
      AuthorizationError
    )
    expect(getMyAccessibleProfiles).not.toHaveBeenCalled()
  })

  it('[SUPER_ADMIN] suit lui aussi ses propres fiches, pas celles des autres', async () => {
    setupAuthUserMocked(userTestSuperAdmin)
    vi.mocked(getMyAccessibleProfiles).mockResolvedValue([])

    expect(await getMyMemberDocumentsService(ORG_ID)).toEqual([])
    expect(listMemberDocumentsByProfilesDao).not.toHaveBeenCalled()
  })
})

describe('readMemberDocumentFileService — trois contrôles indépendants (ADR 073 §4)', () => {
  beforeEach(() => {
    vi.mocked(getMemberDocumentByIdDao).mockResolvedValue(documentRow())
    vi.mocked(getMyAccessibleProfiles).mockResolvedValue([
      myProfile(PROFILE_ID, userTest.name),
    ])
  })

  it('[USER propriétaire] lit le fichier dans le dossier de sa fiche, ligne relue sous le tenant', async () => {
    setupAuthUserMocked(withRole('member'))
    let readUnder: string | undefined
    vi.mocked(getMemberDocumentByIdDao).mockImplementation(async () => {
      readUnder = scope.current
      return documentRow()
    })

    const file = await readMemberDocumentFileService(ORG_ID, DOCUMENT_ID)

    expect(readUnder).toBe(ORG_ID)
    expect(file.title).toBe('Facture 2026')
    expect(storageBasePaths()).toEqual([FOLDER])
    expect(storage.download).toHaveBeenCalledWith(FILE_NAME)
  })

  it('[USER] compte multi-fiches : lit le document de chacune de ses fiches', async () => {
    setupAuthUserMocked(withRole('member'))
    vi.mocked(getMyAccessibleProfiles).mockResolvedValue([
      myProfile(PROFILE_ID, userTest.name),
      myProfile(THIRD_PROFILE_ID, 'SCI Les Pins'),
    ])
    const thirdKey = `${ORG_ID}/member-documents/${THIRD_PROFILE_ID}/${FILE_NAME}`
    vi.mocked(getMemberDocumentByIdDao).mockResolvedValue(
      documentRow({memberProfileId: THIRD_PROFILE_ID, fileKey: thirdKey})
    )

    await readMemberDocumentFileService(ORG_ID, DOCUMENT_ID)

    expect(storageBasePaths()).toEqual([
      `${ORG_ID}/member-documents/${THIRD_PROFILE_ID}`,
    ])
  })

  it('contrôle 1 — ligne absente sous le tenant (autre association, retirée) : NotFoundError', async () => {
    setupAuthUserMocked(withRole('member'))
    vi.mocked(getMemberDocumentByIdDao).mockResolvedValue(undefined)

    await expect(
      readMemberDocumentFileService(ORG_ID, DOCUMENT_ID)
    ).rejects.toThrow(NotFoundError)
    expect(storage.download).not.toHaveBeenCalled()
  })

  it("contrôle 2 — fiche non possédée : NotFoundError, l'existence n'est pas révélée", async () => {
    setupAuthUserMocked(withRole('member'))
    vi.mocked(getMyAccessibleProfiles).mockResolvedValue([
      myProfile(OTHER_PROFILE_ID, userTest.name),
    ])

    await expect(
      readMemberDocumentFileService(ORG_ID, DOCUMENT_ID)
    ).rejects.toThrow(NotFoundError)
    expect(createStorage).not.toHaveBeenCalled()
    expect(storage.download).not.toHaveBeenCalled()
  })

  it.each([
    ['[ORGANIZATION OWNER]', withRole('owner')],
    ['[ORGANIZATION BOARD]', withRole('board')],
    ['[SUPER_ADMIN]', userTestSuperAdmin],
  ])(
    'contrôle 2 — %s lit tout document de son association sans posséder la fiche',
    async (_, user) => {
      setupAuthUserMocked(user)
      vi.mocked(getMyAccessibleProfiles).mockResolvedValue([])

      await readMemberDocumentFileService(ORG_ID, DOCUMENT_ID)

      expect(storage.download).toHaveBeenCalledWith(FILE_NAME)
    }
  )

  it("contrôle 2 — owner d'une autre association, sans fiche ici : NotFoundError", async () => {
    setupAuthUserMocked(withRole('owner', OTHER_ORG_ID))
    vi.mocked(getMyAccessibleProfiles).mockResolvedValue([])

    await expect(
      readMemberDocumentFileService(ORG_ID, DOCUMENT_ID)
    ).rejects.toThrow(NotFoundError)
    expect(storage.download).not.toHaveBeenCalled()
  })

  it.each([
    [
      "clé d'une autre fiche",
      `${ORG_ID}/member-documents/${OTHER_PROFILE_ID}/${FILE_NAME}`,
    ],
    [
      "clé d'une autre association",
      `${OTHER_ORG_ID}/member-documents/${PROFILE_ID}/${FILE_NAME}`,
    ],
    ['clé avec remontée', `${FOLDER}/../${OTHER_PROFILE_ID}/${FILE_NAME}`],
    [
      'clé avec séparateur encodé',
      `${FOLDER}/..%2F${OTHER_PROFILE_ID}%2F${FILE_NAME}`,
    ],
    ['clé partagée', `${ORG_ID}/shared-documents/${DOCUMENT_ID}/file-x.pdf`],
  ])(
    'contrôle 3 — %s : refus journalisé même si la possession passe',
    async (_, fileKey) => {
      setupAuthUserMocked(withRole('member'))
      vi.mocked(getMemberDocumentByIdDao).mockResolvedValue(
        documentRow({fileKey})
      )

      await expect(
        readMemberDocumentFileService(ORG_ID, DOCUMENT_ID)
      ).rejects.toThrow(NotFoundError)
      expect(storage.download).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalled()
      expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain(
        userTest.name
      )
    }
  )

  it('[SANS SESSION] UnauthenticatedError, sans rien lire', async () => {
    setupAuthUserMocked(undefined)

    await expect(
      readMemberDocumentFileService(ORG_ID, DOCUMENT_ID)
    ).rejects.toThrow(UnauthenticatedError)
    expect(getMemberDocumentByIdDao).not.toHaveBeenCalled()
  })

  it.each([
    ['non uuid', 'abc'],
    ['traversée', '..%2F..%2Fetc'],
    ['vide', ''],
  ])(
    '[SANS SESSION] identifiant %s : UnauthenticatedError avant toute validation (ADR 073 §5)',
    async (_, id) => {
      setupAuthUserMocked(undefined)

      await expect(readMemberDocumentFileService(ORG_ID, id)).rejects.toThrow(
        UnauthenticatedError
      )
      expect(getMemberDocumentByIdDao).not.toHaveBeenCalled()
    }
  )

  it.each([
    ['non uuid', 'abc'],
    ['traversée', '..%2F..%2Fetc'],
  ])(
    'identifiant %s : ValidationParsedZodError, sans rien lire',
    async (_, id) => {
      setupAuthUserMocked(withRole('member'))

      await expect(readMemberDocumentFileService(ORG_ID, id)).rejects.toThrow(
        ValidationParsedZodError
      )
      expect(getMemberDocumentByIdDao).not.toHaveBeenCalled()
    }
  )
})

const REFERENCE_A = '3f2a9c10-1b2c-4d3e-8f40-5a6b7c8d9e0f'
const REFERENCE_B = '7c1d2e3f-4a5b-4c6d-8e7f-901a2b3c4d5e'

const batchInput = (overrides: Record<string, unknown> = {}) => ({
  organizationId: ORG_ID,
  fileName: `${REFERENCE_A}_facture-2026.pdf`,
  title: 'Facture 2026',
  categoryId: CATEGORY_ID,
  documentDate: '2026-03-15',
  file: pdfFile(),
  ...overrides,
})

describe('depositMemberDocumentBatchLineService — dépôt en lot (critère 7)', () => {
  beforeEach(() => {
    vi.mocked(getMemberProfileIdsByPennylaneReferenceDao).mockImplementation(
      async (_org, reference) =>
        ({[REFERENCE_A]: [PROFILE_ID], [REFERENCE_B]: [OTHER_PROFILE_ID]})[
          reference
        ] ?? []
    )
    vi.mocked(getMemberProfileByIdDao).mockImplementation(async (id) =>
      profileRow({
        id,
        name: id === PROFILE_ID ? 'Bernard Lefèvre' : 'SCI Les Pins',
      })
    )
    vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([
      period(PROFILE_ID, '12', '2010-01-01', null, '0045821'),
      period(OTHER_PROFILE_ID, '31', '2010-01-01', null),
    ])
  })

  it.each([
    ['[ORGANIZATION OWNER]', withRole('owner')],
    ['[ORGANIZATION BOARD]', withRole('board')],
    ['[SUPER_ADMIN]', userTestSuperAdmin],
  ])(
    '%s dépose le fichier sur la fiche dont la référence ouvre le nom',
    async (_, user) => {
      setupAuthUserMocked(user)
      let lookedUpUnder: string | undefined
      vi.mocked(
        getMemberProfileIdsByPennylaneReferenceDao
      ).mockImplementationOnce(async () => {
        lookedUpUnder = scope.current
        return [PROFILE_ID]
      })

      const result = await depositMemberDocumentBatchLineService(batchInput())

      expect(lookedUpUnder).toBe(ORG_ID)
      expect(getMemberProfileIdsByPennylaneReferenceDao).toHaveBeenCalledWith(
        ORG_ID,
        REFERENCE_A
      )
      expect(result).toEqual({
        status: 'deposited',
        fileName: `${REFERENCE_A}_facture-2026.pdf`,
        memberProfileId: PROFILE_ID,
        memberProfileName: 'Bernard Lefèvre',
        parcelNumbers: ['12'],
        meterNumber: '0045821',
      })
      expect(storageBasePaths()).toEqual([FOLDER])
      expect(createMemberDocumentDao).toHaveBeenCalledWith(
        expect.objectContaining({
          memberProfileId: PROFILE_ID,
          title: 'Facture 2026',
          documentDate: '2026-03-15',
        })
      )
    }
  )

  it('deux fichiers pour deux fiches : chacun la sienne, chacun dans son dossier', async () => {
    setupAuthUserMocked(withRole('owner'))

    const first = await depositMemberDocumentBatchLineService(batchInput())
    const second = await depositMemberDocumentBatchLineService(
      batchInput({fileName: `${REFERENCE_B}_facture-2026.pdf`})
    )

    expect(first).toEqual(
      expect.objectContaining({
        status: 'deposited',
        memberProfileId: PROFILE_ID,
      })
    )
    expect(second).toEqual(
      expect.objectContaining({
        status: 'deposited',
        memberProfileId: OTHER_PROFILE_ID,
      })
    )
    const inserted = vi
      .mocked(createMemberDocumentDao)
      .mock.calls.map(([input]) => [input.memberProfileId, input.fileKey])
    expect(inserted[0][0]).toBe(PROFILE_ID)
    expect(inserted[0][1].startsWith(`${FOLDER}/`)).toBe(true)
    expect(inserted[1][0]).toBe(OTHER_PROFILE_ID)
    expect(
      inserted[1][1].startsWith(
        `${ORG_ID}/member-documents/${OTHER_PROFILE_ID}/`
      )
    ).toBe(true)
  })

  it.each([
    ['sans « _ »', `${REFERENCE_A}.pdf`],
    ['commençant par « _ »', '_facture.pdf'],
    ['vide', ''],
  ])(
    'nom %s : écarté (no_reference_in_name), rien lu ni écrit',
    async (_, fileName) => {
      setupAuthUserMocked(withRole('owner'))

      const result = await depositMemberDocumentBatchLineService(
        batchInput({fileName})
      )

      expect(result).toEqual({
        status: 'rejected',
        fileName,
        reason: 'no_reference_in_name',
      })
      expect(getMemberProfileIdsByPennylaneReferenceDao).not.toHaveBeenCalled()
      expect(storage.upload).not.toHaveBeenCalled()
      expect(createMemberDocumentDao).not.toHaveBeenCalled()
    }
  )

  it("référence d'une fiche de l'autre association : invisible sous le tenant, écartée (unknown_reference)", async () => {
    setupAuthUserMocked(withRole('owner'))
    vi.mocked(getMemberProfileIdsByPennylaneReferenceDao).mockResolvedValue([])

    const result = await depositMemberDocumentBatchLineService(
      batchInput({fileName: 'c9999_facture.pdf'})
    )

    expect(result).toEqual({
      status: 'rejected',
      fileName: 'c9999_facture.pdf',
      reason: 'unknown_reference',
      reference: 'c9999',
    })
    expect(getMemberProfileByIdDao).not.toHaveBeenCalled()
    expect(storage.upload).not.toHaveBeenCalled()
    expect(createMemberDocumentDao).not.toHaveBeenCalled()
  })

  it('deux fiches portent la référence à la casse près : écartée (ambiguous_reference), rattachée à aucune', async () => {
    setupAuthUserMocked(withRole('owner'))
    vi.mocked(getMemberProfileIdsByPennylaneReferenceDao).mockResolvedValue([
      PROFILE_ID,
      OTHER_PROFILE_ID,
    ])

    const result = await depositMemberDocumentBatchLineService(batchInput())

    expect(result).toEqual({
      status: 'rejected',
      fileName: `${REFERENCE_A}_facture-2026.pdf`,
      reason: 'ambiguous_reference',
      reference: REFERENCE_A,
    })
    expect(getMemberProfileByIdDao).not.toHaveBeenCalled()
    expect(storage.upload).not.toHaveBeenCalled()
    expect(createMemberDocumentDao).not.toHaveBeenCalled()
  })

  it('aucun dépôt sans correspondance exacte : un préfixe de référence ne suffit pas', async () => {
    setupAuthUserMocked(withRole('owner'))

    const result = await depositMemberDocumentBatchLineService(
      batchInput({fileName: `${REFERENCE_A.slice(0, 8)}_facture.pdf`})
    )

    expect(result.status).toBe('rejected')
    expect(getMemberProfileIdsByPennylaneReferenceDao).toHaveBeenCalledWith(
      ORG_ID,
      REFERENCE_A.slice(0, 8)
    )
    expect(createMemberDocumentDao).not.toHaveBeenCalled()
  })

  it.each([
    ['non-PDF', {file: pdfFile(PNG_BYTES)}, 'invalid_file'],
    ['fichier absent', {file: null}, 'invalid_file'],
    ['plus de 10 Mo', {file: oversizedPdf()}, 'too_large'],
    ['titre vide', {title: ' '}, 'invalid_input'],
    ['catégorie indisponible', {categoryId: ''}, 'invalid_input'],
    ['date invalide', {documentDate: '31/02/2026'}, 'invalid_input'],
  ])('%s : écarté (%s), rien écrit', async (_, overrides, reason) => {
    setupAuthUserMocked(withRole('owner'))

    const result = await depositMemberDocumentBatchLineService(
      batchInput(overrides)
    )

    expect(result).toEqual(
      expect.objectContaining({status: 'rejected', reason})
    )
    expect(storage.upload).not.toHaveBeenCalled()
    expect(createMemberDocumentDao).not.toHaveBeenCalled()
  })

  it.each([
    ['[ORGANIZATION MEMBER]', withRole('member')],
    ["[OWNER D'UNE AUTRE ASSOCIATION]", withRole('owner', OTHER_ORG_ID)],
    ['[SANS SESSION]', undefined],
  ])('%s ne dépose rien et ne cherche aucune fiche', async (_, user) => {
    setupAuthUserMocked(user)

    await expect(
      depositMemberDocumentBatchLineService(batchInput())
    ).rejects.toThrow(AuthorizationError)
    expect(getMemberProfileIdsByPennylaneReferenceDao).not.toHaveBeenCalled()
    expect(storage.upload).not.toHaveBeenCalled()
  })

  it('ne journalise ni le nom du fichier ni celui du membre', async () => {
    setupAuthUserMocked(withRole('owner'))

    await depositMemberDocumentBatchLineService(batchInput())

    const logged = JSON.stringify([
      vi.mocked(logger.info).mock.calls,
      vi.mocked(logger.warn).mock.calls,
      vi.mocked(logger.debug).mock.calls,
    ])
    expect(logged).not.toContain('Lefèvre')
    expect(logged).not.toContain('facture-2026')
  })
})

describe('getMemberDocumentBatchReachService — fiches atteignables par un lot', () => {
  it('[ORGANIZATION BOARD] compte, sous le tenant, les fiches avec et sans référence', async () => {
    setupAuthUserMocked(withRole('board'))
    let countedUnder: string | undefined
    vi.mocked(countMemberProfilesWithoutReferenceDao).mockImplementation(
      async () => {
        countedUnder = scope.current
        return 3
      }
    )
    vi.mocked(countMemberProfilesDao).mockResolvedValue({
      total: 10,
      incomplete: 0,
    })

    const reach = await getMemberDocumentBatchReachService(ORG_ID)

    expect(countedUnder).toBe(ORG_ID)
    expect(countMemberProfilesWithoutReferenceDao).toHaveBeenCalledWith(ORG_ID)
    expect(reach).toEqual({
      profilesWithReference: 7,
      profilesWithoutReference: 3,
    })
  })

  it.each([
    ['[ORGANIZATION MEMBER]', withRole('member')],
    ['[SANS SESSION]', undefined],
  ])('%s ne compte rien', async (_, user) => {
    setupAuthUserMocked(user)

    await expect(getMemberDocumentBatchReachService(ORG_ID)).rejects.toThrow(
      AuthorizationError
    )
    expect(countMemberProfilesWithoutReferenceDao).not.toHaveBeenCalled()
  })
})

describe('accès après la vente — documents d’avant la vente seulement (s57, critère 6)', () => {
  const SOLD_ON = '2026-03-15'
  const grace = {status: 'grace', soldOn: SOLD_ON, closesOn: '2026-09-15'}

  it('[USER] en délai : le document daté de la veille de la vente reste, celui du jour est masqué', async () => {
    setupAuthUserMocked(withRole('member'))
    vi.mocked(getMyAccessibleProfiles).mockResolvedValue([
      myProfile(PROFILE_ID, userTest.name, grace),
      myProfile(OTHER_PROFILE_ID, 'SCI Les Pins'),
    ])
    vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([])
    vi.mocked(listMemberDocumentsByProfilesDao).mockResolvedValue([
      {
        ...documentRow({id: 'veille', documentDate: '2026-03-14'}),
        categoryName: 'Facture',
      },
      {
        ...documentRow({id: 'jour', documentDate: SOLD_ON}),
        categoryName: 'Facture',
      },
      {
        ...documentRow({
          id: 'autre-fiche',
          memberProfileId: OTHER_PROFILE_ID,
          documentDate: '2026-06-01',
        }),
        categoryName: 'Facture',
      },
    ])

    const documents = await getMyMemberDocumentsService(ORG_ID)

    expect(documents.map(({id}) => id)).toEqual(['autre-fiche', 'veille'])
  })

  it('[USER] identifiant forgé d’un document d’après la vente : NotFoundError, rien n’est lu', async () => {
    setupAuthUserMocked(withRole('member'))
    vi.mocked(getMyAccessibleProfiles).mockResolvedValue([
      myProfile(PROFILE_ID, userTest.name, grace),
    ])
    vi.mocked(getMemberDocumentByIdDao).mockResolvedValue(
      documentRow({documentDate: SOLD_ON})
    )

    await expect(
      readMemberDocumentFileService(ORG_ID, DOCUMENT_ID)
    ).rejects.toThrow(NotFoundError)
    expect(storage.download).not.toHaveBeenCalled()
  })

  it('[USER] document d’avant la vente : lu', async () => {
    setupAuthUserMocked(withRole('member'))
    vi.mocked(getMyAccessibleProfiles).mockResolvedValue([
      myProfile(PROFILE_ID, userTest.name, grace),
    ])
    vi.mocked(getMemberDocumentByIdDao).mockResolvedValue(
      documentRow({documentDate: '2026-03-14'})
    )

    await readMemberDocumentFileService(ORG_ID, DOCUMENT_ID)

    expect(storage.download).toHaveBeenCalledWith(FILE_NAME)
  })

  it('[USER] document d’une fiche fermée (absente des fiches accessibles) : NotFoundError', async () => {
    setupAuthUserMocked(withRole('member'))
    vi.mocked(getMyAccessibleProfiles).mockResolvedValue([
      myProfile(OTHER_PROFILE_ID, 'SCI Les Pins'),
    ])
    vi.mocked(getMemberDocumentByIdDao).mockResolvedValue(documentRow())

    await expect(
      readMemberDocumentFileService(ORG_ID, DOCUMENT_ID)
    ).rejects.toThrow(NotFoundError)
    expect(storage.download).not.toHaveBeenCalled()
  })

  it('[ORGANIZATION BOARD] member.document.manage lit tout, même d’après la vente', async () => {
    setupAuthUserMocked(withRole('board'))
    vi.mocked(getMyAccessibleProfiles).mockResolvedValue([])
    vi.mocked(getMemberDocumentByIdDao).mockResolvedValue(
      documentRow({documentDate: '2026-06-01'})
    )

    await readMemberDocumentFileService(ORG_ID, DOCUMENT_ID)

    expect(storage.download).toHaveBeenCalledWith(FILE_NAME)
    expect(getMyAccessibleProfiles).not.toHaveBeenCalled()
  })
})
