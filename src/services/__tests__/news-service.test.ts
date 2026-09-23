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
vi.mock('@/db/repositories/news-repository', () => ({
  createNewsDao: vi.fn(),
  getNewsByIdDao: vi.fn(),
  getNewsBySlugDao: vi.fn(),
  getNewsPageByOrganizationDao: vi.fn(),
  getPublishedNewsPageDao: vi.fn(),
  isNewsSlugTakenDao: vi.fn(),
  updateNewsDao: vi.fn(),
  updateNewsStatusDao: vi.fn(),
}))
vi.mock('@/lib/files/storage/storage-factory', () => ({
  createStorage: vi.fn(() => storage),
}))

import {
  createNewsDao,
  getNewsByIdDao,
  getNewsBySlugDao,
  getNewsPageByOrganizationDao,
  getPublishedNewsPageDao,
  isNewsSlugTakenDao,
  updateNewsDao,
  updateNewsStatusDao,
} from '@/db/repositories/news-repository'

import {AuthorizationError} from '../errors/authorization-error'
import {
  canManageNewsService,
  createNewsDraftService,
  getNewsBySlugService,
  getNewsForBureauService,
  getNewsItemForBureauService,
  getPublishedNewsPageService,
  publishNewsService,
  unpublishNewsService,
  updateNewsService,
  uploadNewsImageService,
} from '../news-service'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {News} from '../types/domain/news-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const NEWS_ID = '33333333-3333-4333-8333-333333333333'

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

const newsRow = (overrides: Partial<News> = {}): News => ({
  id: NEWS_ID,
  organizationId: ORG_ID,
  slug: null,
  title: '',
  publishedOn: '2026-09-02',
  imageKey: null,
  imageAlt: '',
  content: '',
  status: 'draft',
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-01'),
  ...overrides,
})

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
])
const PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37,
])
const fileFrom = (bytes: Uint8Array, name: string, type: string) =>
  new File([bytes as BlobPart], name, {type})

const updateInput = (overrides: Record<string, unknown> = {}) => ({
  organizationId: ORG_ID,
  newsId: NEWS_ID,
  title: "Fête de l'étang : merci !",
  publishedOn: '2026-09-02',
  content: 'Merci à tous.',
  imageAlt: '',
  imageKey: null,
  ...overrides,
})

/** Enregistre et rend la ligne : un refus fait echouer le test sur place. */
const savedNewsOf = async (overrides: Record<string, unknown> = {}) => {
  const result = await updateNewsService(updateInput(overrides))
  if (result.status !== 'saved') {
    throw new Error(`enregistrement refusé : ${result.issues.join(', ')}`)
  }
  return result.news
}

/** Les DAO qui ecrivent : un depot d'image n'en appelle aucun. */
const writeDaos = () => [createNewsDao, updateNewsDao, updateNewsStatusDao]

const allDaos = () => [
  createNewsDao,
  getNewsByIdDao,
  getNewsBySlugDao,
  getNewsPageByOrganizationDao,
  isNewsSlugTakenDao,
  updateNewsDao,
  updateNewsStatusDao,
]

beforeEach(() => {
  vi.clearAllMocks()
  setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))
  vi.mocked(getNewsByIdDao).mockResolvedValue(newsRow())
  vi.mocked(isNewsSlugTakenDao).mockResolvedValue(false)
  vi.mocked(createNewsDao).mockImplementation(async (input) => {
    expect(scope.current).toBe(ORG_ID)
    return newsRow({publishedOn: input.publishedOn})
  })
  vi.mocked(updateNewsDao).mockImplementation(async (newsId, input) => {
    expect(scope.current).toBe(ORG_ID)
    return newsRow({id: newsId, ...input})
  })
  vi.mocked(updateNewsStatusDao).mockImplementation(async (newsId, status) => {
    expect(scope.current).toBe(ORG_ID)
    return newsRow({id: newsId, title: 'Titre', slug: 'titre', status})
  })
  vi.mocked(getNewsPageByOrganizationDao).mockResolvedValue({
    rows: [newsRow()],
    total: 1,
  })
  vi.mocked(getPublishedNewsPageDao).mockResolvedValue({rows: [], total: 0})
  storage.upload.mockResolvedValue(undefined)
})

describe.each([
  ['[ORGANIZATION OWNER]', UserOrganizationRoleConst.OWNER],
  ['[ORGANIZATION ADMIN]', UserOrganizationRoleConst.ADMIN],
])('%s gère les actualités', (_label, role) => {
  beforeEach(() => {
    setupAuthUserMocked(withRole(role))
  })

  it('crée un brouillon daté, sans titre ni adresse', async () => {
    const result = await createNewsDraftService({
      organizationId: ORG_ID,
      publishedOn: '2026-09-22',
    })

    expect(result.status).toBe('saved')
    expect(result.news.slug).toBeNull()
    expect(createNewsDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      publishedOn: '2026-09-22',
    })
  })

  it('enregistre, publie et dépublie', async () => {
    await updateNewsService(updateInput())
    const published = await publishNewsService({
      organizationId: ORG_ID,
      newsId: NEWS_ID,
    })
    const unpublished = await unpublishNewsService({
      organizationId: ORG_ID,
      newsId: NEWS_ID,
    })

    expect(updateNewsDao).toHaveBeenCalledTimes(1)
    expect(published.status).toBe('rejected')
    expect(unpublished.status).toBe('unpublished')
  })

  it('lit la liste paginée et la fiche du bureau', async () => {
    const list = await getNewsForBureauService(ORG_ID, 1)
    const item = await getNewsItemForBureauService(ORG_ID, NEWS_ID)

    expect(list).toMatchObject({page: 1, pageSize: 25, total: 1, totalPages: 1})
    expect(getNewsPageByOrganizationDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      limit: 25,
      offset: 0,
    })
    expect(item.id).toBe(NEWS_ID)
  })
})

describe.each([
  ['[ORGANIZATION MEMBER]', withRole(UserOrganizationRoleConst.MEMBER)],
  [
    '[USER NOT IN ORGANIZATION]',
    withRole(UserOrganizationRoleConst.OWNER, OTHER_ORG_ID),
  ],
  ['[PUBLIC]', undefined],
])('%s ne gère pas les actualités', (_label, user) => {
  beforeEach(() => {
    setupAuthUserMocked(user)
  })

  it.each([
    [
      'createNewsDraftService',
      () =>
        createNewsDraftService({
          organizationId: ORG_ID,
          publishedOn: '2026-09-22',
        }),
    ],
    ['updateNewsService', () => updateNewsService(updateInput())],
    [
      'publishNewsService',
      () => publishNewsService({organizationId: ORG_ID, newsId: NEWS_ID}),
    ],
    [
      'unpublishNewsService',
      () => unpublishNewsService({organizationId: ORG_ID, newsId: NEWS_ID}),
    ],
    ['getNewsForBureauService', () => getNewsForBureauService(ORG_ID, 1)],
    [
      'getNewsItemForBureauService',
      () => getNewsItemForBureauService(ORG_ID, NEWS_ID),
    ],
    [
      'uploadNewsImageService',
      () =>
        uploadNewsImageService({
          organizationId: ORG_ID,
          newsId: NEWS_ID,
          file: fileFrom(PNG_BYTES, 'photo.png', 'image/png'),
        }),
    ],
  ])('%s : AuthorizationError, aucun DAO appelé', async (_name, call) => {
    await expect(call()).rejects.toThrow(AuthorizationError)
    for (const dao of allDaos()) {
      expect(dao).not.toHaveBeenCalled()
    }
    expect(storage.upload).not.toHaveBeenCalled()
  })

  it("canManageNewsService : l'interface ne propose rien", async () => {
    expect(await canManageNewsService(ORG_ID)).toBe(false)
  })
})

describe('validation avant autorisation', () => {
  it('refuse une date invalide sans rien écrire', async () => {
    await expect(
      updateNewsService(updateInput({publishedOn: '2026-02-30'}))
    ).rejects.toThrow()
    await expect(
      createNewsDraftService({
        organizationId: ORG_ID,
        publishedOn: '22/09/2026',
      })
    ).rejects.toThrow()
    expect(updateNewsDao).not.toHaveBeenCalled()
    expect(createNewsDao).not.toHaveBeenCalled()
  })

  it('refuse un titre de plus de 160 caractères', async () => {
    await expect(
      updateNewsService(updateInput({title: 'a'.repeat(161)}))
    ).rejects.toThrow()
    expect(updateNewsDao).not.toHaveBeenCalled()
  })
})

describe('adresse stable (critère 2)', () => {
  it('translittère le titre au premier enregistrement titré', async () => {
    const news = await savedNewsOf()

    expect(news.slug).toBe('fete-de-l-etang-merci')
    expect(updateNewsDao).toHaveBeenCalledWith(
      NEWS_ID,
      expect.objectContaining({slug: 'fete-de-l-etang-merci'})
    )
  })

  it('suffixe -2, -3… une adresse déjà prise dans l’association', async () => {
    vi.mocked(isNewsSlugTakenDao).mockImplementation(
      async (_org, slug) =>
        slug === 'fete-de-l-etang-merci' || slug === 'fete-de-l-etang-merci-2'
    )

    const news = await savedNewsOf()

    expect(news.slug).toBe('fete-de-l-etang-merci-3')
    expect(isNewsSlugTakenDao).toHaveBeenCalledWith(
      ORG_ID,
      'fete-de-l-etang-merci'
    )
  })

  it("ne touche plus l'adresse quand le titre change", async () => {
    const stored = newsRow({
      slug: 'fete-de-l-etang-merci',
      title: "Fête de l'étang",
    })
    vi.mocked(getNewsByIdDao).mockResolvedValue(stored)
    vi.mocked(updateNewsDao).mockImplementation(async (_id, input) => ({
      ...stored,
      ...input,
    }))

    const news = await savedNewsOf({title: 'Un tout autre titre'})

    expect(news.slug).toBe('fete-de-l-etang-merci')
    const [, written] = vi.mocked(updateNewsDao).mock.calls[0]
    expect(written).not.toHaveProperty('slug')
    expect(isNewsSlugTakenDao).not.toHaveBeenCalled()
  })

  it('laisse l’adresse vide tant que le titre est vide', async () => {
    const news = await savedNewsOf({title: '  '})

    expect(news.slug).toBeNull()
    const [, written] = vi.mocked(updateNewsDao).mock.calls[0]
    expect(written).not.toHaveProperty('slug')
  })
})

describe('brouillon et publication', () => {
  it('un brouillon incomplet s’enregistre : image sans alt, titre vide', async () => {
    vi.mocked(getNewsByIdDao).mockResolvedValue(
      newsRow({imageKey: `${ORG_ID}/news/${NEWS_ID}/image-a.png`})
    )

    const result = await updateNewsService(
      updateInput({title: '', imageAlt: ''})
    )

    expect(result.status).toBe('saved')
  })

  it('refuse de vider le titre d’une actualité publiée', async () => {
    vi.mocked(getNewsByIdDao).mockResolvedValue(
      newsRow({title: 'AG', slug: 'ag', status: 'published'})
    )

    const result = await updateNewsService(updateInput({title: '  '}))

    expect(result).toEqual({status: 'rejected', issues: ['missing_title']})
    expect(updateNewsDao).not.toHaveBeenCalled()
  })

  it('refuse une image sans texte alternatif sur une actualité publiée', async () => {
    vi.mocked(getNewsByIdDao).mockResolvedValue(
      newsRow({title: 'AG', slug: 'ag', status: 'published'})
    )

    const result = await updateNewsService(
      updateInput({
        imageKey: `${ORG_ID}/news/${NEWS_ID}/image-a.png`,
        imageAlt: '  ',
      })
    )

    expect(result).toEqual({
      status: 'rejected',
      issues: ['missing_image_alt'],
    })
    expect(updateNewsDao).not.toHaveBeenCalled()
  })

  it('enregistre une actualité publiée dès qu’elle reste complète', async () => {
    vi.mocked(getNewsByIdDao).mockResolvedValue(
      newsRow({title: 'AG', slug: 'ag', status: 'published'})
    )

    const result = await updateNewsService(
      updateInput({
        imageKey: `${ORG_ID}/news/${NEWS_ID}/image-a.png`,
        imageAlt: 'La mare au printemps',
      })
    )

    expect(result.status).toBe('saved')
    expect(updateNewsDao).toHaveBeenCalledTimes(1)
  })

  it('un brouillon garde le droit au titre vide et à l’image sans alt', async () => {
    vi.mocked(getNewsByIdDao).mockResolvedValue(
      newsRow({status: 'draft', slug: 'ag'})
    )

    const result = await updateNewsService(
      updateInput({
        title: '',
        imageKey: `${ORG_ID}/news/${NEWS_ID}/image-a.png`,
        imageAlt: '',
      })
    )

    expect(result.status).toBe('saved')
  })

  it('refuse de publier sans titre', async () => {
    const result = await publishNewsService({
      organizationId: ORG_ID,
      newsId: NEWS_ID,
    })

    expect(result).toEqual({status: 'rejected', issues: ['missing_title']})
    expect(updateNewsStatusDao).not.toHaveBeenCalled()
  })

  it('refuse de publier une image sans texte alternatif', async () => {
    vi.mocked(getNewsByIdDao).mockResolvedValue(
      newsRow({
        title: 'AG',
        slug: 'ag',
        imageKey: `${ORG_ID}/news/${NEWS_ID}/image-a.png`,
        imageAlt: '  ',
      })
    )

    const result = await publishNewsService({
      organizationId: ORG_ID,
      newsId: NEWS_ID,
    })

    expect(result).toEqual({status: 'rejected', issues: ['missing_image_alt']})
    expect(updateNewsStatusDao).not.toHaveBeenCalled()
  })

  it('publie une actualité titrée sans image', async () => {
    vi.mocked(getNewsByIdDao).mockResolvedValue(
      newsRow({title: 'AG', slug: 'ag'})
    )

    const result = await publishNewsService({
      organizationId: ORG_ID,
      newsId: NEWS_ID,
    })

    expect(result.status).toBe('published')
    expect(updateNewsStatusDao).toHaveBeenCalledWith(NEWS_ID, 'published')
  })

  it('écrit la clé déposée que le formulaire lui rend', async () => {
    const key = `${ORG_ID}/news/${NEWS_ID}/image-a.png`

    await updateNewsService(
      updateInput({imageKey: key, imageAlt: 'La mare au printemps'})
    )

    expect(vi.mocked(updateNewsDao).mock.calls[0][1]).toMatchObject({
      imageKey: key,
      imageAlt: 'La mare au printemps',
    })
  })

  it('retire l’image quand le formulaire ne rend plus de clé', async () => {
    const key = `${ORG_ID}/news/${NEWS_ID}/image-a.png`
    vi.mocked(getNewsByIdDao).mockResolvedValue(newsRow({imageKey: key}))

    await updateNewsService(updateInput({imageKey: null, imageAlt: 'La mare'}))

    expect(vi.mocked(updateNewsDao).mock.calls[0][1]).toMatchObject({
      imageKey: null,
      imageAlt: '',
    })
  })

  it.each([
    ['une autre association', `${OTHER_ORG_ID}/news/${NEWS_ID}/image-a.png`],
    ['une autre actualité', `${ORG_ID}/news/${OTHER_ORG_ID}/image-a.png`],
    ['une autre portée', `${ORG_ID}/pages/${NEWS_ID}/image-a.png`],
    ['une remontée de chemin', `${ORG_ID}/news/${NEWS_ID}/../x.png`],
  ])('refuse une clé d’image venue de %s, sans rien écrire', async (_, key) => {
    await expect(
      updateNewsService(updateInput({imageKey: key}))
    ).rejects.toThrow()
    expect(updateNewsDao).not.toHaveBeenCalled()
  })
})

describe('[PUBLIC] lectures du site, sans autorisation', () => {
  beforeEach(() => {
    setupAuthUserMocked(undefined)
  })

  it('la liste publique ne demande que les publiées, par page de 10', async () => {
    vi.mocked(getPublishedNewsPageDao).mockResolvedValue({
      rows: [newsRow({status: 'published', title: 'AG', slug: 'ag'})],
      total: 11,
    })

    const result = await getPublishedNewsPageService(ORG_ID, 2)

    expect(getPublishedNewsPageDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      limit: 10,
      offset: 10,
    })
    expect(getNewsPageByOrganizationDao).not.toHaveBeenCalled()
    expect(result).toMatchObject({page: 2, total: 11, totalPages: 2})
  })

  it('une liste vide a quand même sa page 1', async () => {
    const result = await getPublishedNewsPageService(ORG_ID, 1)

    expect(result).toMatchObject({items: [], total: 0, totalPages: 1})
  })

  it("lit une actualité par son adresse dans le scope de l'association", async () => {
    vi.mocked(getNewsBySlugDao).mockImplementation(async (organizationId) => {
      expect(scope.current).toBe(organizationId)
      return newsRow({slug: 'ag', title: 'AG', status: 'draft'})
    })

    const result = await getNewsBySlugService(ORG_ID, 'ag')

    expect(result?.status).toBe('draft')
    expect(getNewsBySlugDao).toHaveBeenCalledWith(ORG_ID, 'ag')
  })

  it('une adresse mal formée ne lit rien', async () => {
    expect(await getNewsBySlugService(ORG_ID, '../x')).toBeUndefined()
    expect(getNewsBySlugDao).not.toHaveBeenCalled()
  })
})

describe('uploadNewsImageService', () => {
  it('accepte une image par sa signature, sous une clé de portée news', async () => {
    const result = await uploadNewsImageService({
      organizationId: ORG_ID,
      newsId: NEWS_ID,
      file: fileFrom(PNG_BYTES, 'photo.png', 'image/png'),
    })

    expect(result.status).toBe('uploaded')
    if (result.status !== 'uploaded') return
    expect(result.key).toMatch(
      new RegExp(`^${ORG_ID}/news/${NEWS_ID}/image-[0-9a-f-]+\\.png$`)
    )
    expect(storage.upload).toHaveBeenCalledTimes(1)
  })

  it("ne touche pas la ligne : la clé n'est écrite qu'à l'enregistrement", async () => {
    vi.mocked(getNewsByIdDao).mockResolvedValue(
      newsRow({slug: 'assemblee-generale', title: 'AG', status: 'published'})
    )

    const result = await uploadNewsImageService({
      organizationId: ORG_ID,
      newsId: NEWS_ID,
      file: fileFrom(PNG_BYTES, 'photo.png', 'image/png'),
    })

    expect(result).toEqual({
      status: 'uploaded',
      key: expect.stringContaining(`${ORG_ID}/news/${NEWS_ID}/image-`),
      fileName: 'photo.png',
      fileSize: PNG_BYTES.length,
    })
    for (const dao of writeDaos()) {
      expect(dao).not.toHaveBeenCalled()
    }
  })

  it('refuse un fichier dont la signature ne correspond pas, sans écriture', async () => {
    const result = await uploadNewsImageService({
      organizationId: ORG_ID,
      newsId: NEWS_ID,
      file: fileFrom(PDF_BYTES, 'photo.png', 'image/png'),
    })

    expect(result).toEqual({status: 'rejected', reason: 'format'})
    expect(storage.upload).not.toHaveBeenCalled()
  })

  it("refuse une actualité qui n'appartient pas à l'association", async () => {
    vi.mocked(getNewsByIdDao).mockResolvedValue(undefined)

    await expect(
      uploadNewsImageService({
        organizationId: ORG_ID,
        newsId: NEWS_ID,
        file: fileFrom(PNG_BYTES, 'photo.png', 'image/png'),
      })
    ).rejects.toThrow()
    expect(storage.upload).not.toHaveBeenCalled()
  })
})

describe('canManageNewsService', () => {
  it('répond oui pour le bureau', async () => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.ADMIN))

    expect(await canManageNewsService(ORG_ID)).toBe(true)
  })
})
