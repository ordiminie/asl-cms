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
  createPageDao: vi.fn(),
  getPageByIdDao: vi.fn(),
  getPageBySlugDao: vi.fn(),
  getPagesByOrganizationDao: vi.fn(),
  reorderPageBlocksTxnDao: vi.fn(),
  updatePageDao: vi.fn(),
  updatePageStatusDao: vi.fn(),
}))

import {
  createPageDao,
  getPageByIdDao,
  getPageBySlugDao,
  reorderPageBlocksTxnDao,
  updatePageDao,
  updatePageStatusDao,
} from '@/db/repositories/page-repository'

import {AuthorizationError} from '../errors/authorization-error'
import {
  createPageService,
  publishPageService,
  unpublishPageService,
  updatePageService,
} from '../page-service'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {PageBlockTypeConst} from '../types/domain/page-block-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const PAGE_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_PAGE_ID = '44444444-4444-4444-8444-444444444444'
const UNKNOWN_BLOCK_ID = '55555555-5555-4555-8555-555555555555'

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
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  ...overrides,
})

const textBlock = (markdown: string) => ({
  data: {type: PageBlockTypeConst.TEXT, markdown},
})

beforeEach(() => {
  vi.clearAllMocks()
  setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))
  vi.mocked(getPageBySlugDao).mockResolvedValue(undefined)
  vi.mocked(createPageDao).mockImplementation(async (input) => {
    expect(scope.current).toBe(ORG_ID)
    return pageRow({slug: input.slug, title: input.title})
  })
  vi.mocked(updatePageDao).mockImplementation(async (pageId, input) => {
    expect(scope.current).toBe(ORG_ID)
    return pageRow({id: pageId, slug: input.slug, title: input.title})
  })
  vi.mocked(updatePageStatusDao).mockImplementation(async (pageId, status) => {
    expect(scope.current).toBe(ORG_ID)
    return pageRow({id: pageId, status})
  })
  vi.mocked(getPageByIdDao).mockImplementation(async () => ({
    ...pageRow(),
    blocks: [],
  }))
  vi.mocked(reorderPageBlocksTxnDao).mockImplementation(
    async (pageId, blocks) => {
      expect(scope.current).toBe(ORG_ID)
      return blocks.map((block, index) => ({
        id: block.id ?? `generated-${index}`,
        type: block.type,
        rank: block.rank,
        data: block.data,
      }))
    }
  )
})

describe('[BUREAU] createPageService', () => {
  it('enregistre une page en brouillon pour la présidente (owner)', async () => {
    const result = await createPageService({
      organizationId: ORG_ID,
      title: "Qualité de l'eau",
      slug: 'qualite-de-leau',
      blocks: [textBlock('Bonjour')],
    })

    expect(result.status).toBe('saved')
    expect(createPageDao).toHaveBeenCalledTimes(1)
  })

  it('enregistre une page pour un membre du bureau (board)', async () => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.ADMIN))

    const result = await createPageService({
      organizationId: ORG_ID,
      title: 'Adhérer',
      slug: 'adherer',
      blocks: [],
    })

    expect(result.status).toBe('saved')
  })

  it('refuse un slug déjà utilisé dans la même association', async () => {
    vi.mocked(getPageBySlugDao).mockResolvedValue({
      ...pageRow({id: OTHER_PAGE_ID}),
      blocks: [],
    })

    const result = await createPageService({
      organizationId: ORG_ID,
      title: 'Doublon',
      slug: 'qualite-de-leau',
      blocks: [],
    })

    expect(result).toEqual({status: 'rejected', error: 'slug_unavailable'})
    expect(createPageDao).not.toHaveBeenCalled()
  })

  it('accepte le même slug dans une autre association', async () => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER, OTHER_ORG_ID))
    vi.mocked(getPageBySlugDao).mockImplementation(async (organizationId) =>
      organizationId === ORG_ID ? {...pageRow(), blocks: []} : undefined
    )
    vi.mocked(createPageDao).mockResolvedValue(
      pageRow({organizationId: OTHER_ORG_ID})
    )
    vi.mocked(reorderPageBlocksTxnDao).mockResolvedValue([])

    const result = await createPageService({
      organizationId: OTHER_ORG_ID,
      title: "Qualité de l'eau",
      slug: 'qualite-de-leau',
      blocks: [],
    })

    expect(result.status).toBe('saved')
  })

  it('refuse un slug réservé par une route du socle (ADR 020)', async () => {
    const result = await createPageService({
      organizationId: ORG_ID,
      title: 'Bureau',
      slug: 'bureau',
      blocks: [],
    })

    expect(result).toEqual({status: 'rejected', error: 'slug_unavailable'})
    expect(createPageDao).not.toHaveBeenCalled()
  })
})

describe('[MEMBRE SIMPLE] pages du site', () => {
  beforeEach(() => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.MEMBER))
  })

  it('ne peut pas créer de page', async () => {
    await expect(
      createPageService({
        organizationId: ORG_ID,
        title: 'Titre',
        slug: 'titre',
        blocks: [],
      })
    ).rejects.toThrow(AuthorizationError)
    expect(createPageDao).not.toHaveBeenCalled()
  })

  it('ne peut pas modifier de page', async () => {
    await expect(
      updatePageService({
        organizationId: ORG_ID,
        pageId: PAGE_ID,
        title: 'Titre',
        slug: 'titre',
        blocks: [],
      })
    ).rejects.toThrow(AuthorizationError)
    expect(updatePageDao).not.toHaveBeenCalled()
  })

  it('ne peut ni publier ni dépublier', async () => {
    await expect(
      publishPageService({organizationId: ORG_ID, pageId: PAGE_ID})
    ).rejects.toThrow(AuthorizationError)
    await expect(
      unpublishPageService({organizationId: ORG_ID, pageId: PAGE_ID})
    ).rejects.toThrow(AuthorizationError)
    expect(updatePageStatusDao).not.toHaveBeenCalled()
  })
})

describe('[PUBLIC] pages du site', () => {
  it('sans session, aucune écriture', async () => {
    setupAuthUserMocked(undefined)

    await expect(
      createPageService({
        organizationId: ORG_ID,
        title: 'Titre',
        slug: 'titre',
        blocks: [],
      })
    ).rejects.toThrow(AuthorizationError)
  })
})

describe('updatePageService — ordre des blocs', () => {
  it('numérote les rangs dans l’ordre du tableau reçu', async () => {
    const result = await updatePageService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
      title: "Qualité de l'eau",
      slug: 'qualite-de-leau',
      blocks: [textBlock('A'), textBlock('B'), textBlock('C')],
    })

    expect(result.status).toBe('saved')
    if (result.status !== 'saved') return
    expect(result.page.blocks.map((block) => block.rank)).toEqual([0, 1, 2])
    expect(
      result.page.blocks.map(
        (block) => (block.data as {markdown: string}).markdown
      )
    ).toEqual(['A', 'B', 'C'])
  })

  it('rend le même ordre que le tableau vienne du clavier ou de la souris', async () => {
    const reordered = [textBlock('B'), textBlock('A'), textBlock('C')]

    const fromKeyboard = await updatePageService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
      title: 'Titre',
      slug: 'titre',
      blocks: reordered,
    })
    const fromMouse = await updatePageService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
      title: 'Titre',
      slug: 'titre',
      blocks: reordered,
    })

    expect(fromKeyboard).toEqual(fromMouse)
    if (fromKeyboard.status !== 'saved') return
    expect(
      fromKeyboard.page.blocks.map(
        (block) => (block.data as {markdown: string}).markdown
      )
    ).toEqual(['B', 'A', 'C'])
  })

  it('accepte un brouillon incomplet : image sans texte alternatif', async () => {
    const result = await updatePageService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
      title: 'Titre',
      slug: 'titre',
      blocks: [
        {
          data: {
            type: PageBlockTypeConst.IMAGE,
            fileKey: 'org/pages/p/a.webp',
            alt: '',
            caption: '',
          },
        },
      ],
    })

    expect(result.status).toBe('saved')
  })

  it('conserve un bloc de type inconnu déjà enregistré, sans refuser l’enregistrement', async () => {
    vi.mocked(getPageByIdDao).mockResolvedValue({
      ...pageRow(),
      blocks: [
        {
          id: UNKNOWN_BLOCK_ID,
          type: 'carrousel-2019',
          rank: 0,
          data: {slides: ['a']},
        },
      ],
    })

    const result = await updatePageService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
      title: 'Titre',
      slug: 'titre',
      blocks: [
        {id: UNKNOWN_BLOCK_ID, type: 'carrousel-2019', data: {slides: ['a']}},
        textBlock('Suite'),
      ],
    })

    expect(result.status).toBe('saved')
    if (result.status !== 'saved') return
    expect(result.page.blocks[0]).toMatchObject({
      id: UNKNOWN_BLOCK_ID,
      type: 'carrousel-2019',
      rank: 0,
      data: {slides: ['a']},
    })
  })

  it('refuse un type de bloc inédit que rien ne justifie (ADR 019)', async () => {
    await expect(
      updatePageService({
        organizationId: ORG_ID,
        pageId: PAGE_ID,
        title: 'Titre',
        slug: 'titre',
        blocks: [{type: 'carrousel-2019', data: {slides: []}}],
      })
    ).rejects.toThrow()
    expect(reorderPageBlocksTxnDao).not.toHaveBeenCalled()
  })
})

describe('publishPageService — obligatoire pour publier', () => {
  it('publie une page dont les blocs sont complets', async () => {
    vi.mocked(getPageByIdDao).mockResolvedValue({
      ...pageRow(),
      blocks: [
        {
          id: 'bloc-1',
          type: PageBlockTypeConst.IMAGE,
          rank: 0,
          data: {
            type: PageBlockTypeConst.IMAGE,
            fileKey: 'org/pages/p/a.webp',
            alt: "L'étang",
            caption: '',
          },
        },
      ],
    })

    const result = await publishPageService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
    })

    expect(result.status).toBe('published')
    expect(updatePageStatusDao).toHaveBeenCalledWith(PAGE_ID, 'published')
  })

  it('refuse de publier une image sans texte alternatif', async () => {
    vi.mocked(getPageByIdDao).mockResolvedValue({
      ...pageRow(),
      blocks: [
        {
          id: 'bloc-1',
          type: PageBlockTypeConst.IMAGE,
          rank: 0,
          data: {
            type: PageBlockTypeConst.IMAGE,
            fileKey: 'org/pages/p/a.webp',
            alt: '',
            caption: '',
          },
        },
      ],
    })

    const result = await publishPageService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
    })

    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') return
    expect(result.issues).toEqual([{rank: 0, code: 'missing_image_alt'}])
    expect(updatePageStatusDao).not.toHaveBeenCalled()
  })

  it('refuse de publier un PDF sans titre', async () => {
    vi.mocked(getPageByIdDao).mockResolvedValue({
      ...pageRow(),
      blocks: [
        {
          id: 'bloc-1',
          type: PageBlockTypeConst.PDF,
          rank: 0,
          data: {
            type: PageBlockTypeConst.PDF,
            fileKey: 'org/pages/p/a.pdf',
            title: '   ',
          },
        },
      ],
    })

    const result = await publishPageService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
    })

    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') return
    expect(result.issues).toEqual([{rank: 0, code: 'missing_pdf_title'}])
  })

  it('refuse de publier une vignette de galerie sans texte alternatif', async () => {
    vi.mocked(getPageByIdDao).mockResolvedValue({
      ...pageRow(),
      blocks: [
        {
          id: 'bloc-1',
          type: PageBlockTypeConst.GALLERY,
          rank: 0,
          data: {
            type: PageBlockTypeConst.GALLERY,
            images: [
              {fileKey: 'org/pages/p/a.webp', alt: 'Une photo'},
              {fileKey: 'org/pages/p/b.webp', alt: ''},
            ],
          },
        },
      ],
    })

    const result = await publishPageService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
    })

    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') return
    expect(result.issues).toEqual([{rank: 0, code: 'missing_gallery_alt'}])
  })

  it('ignore un bloc de type inconnu au moment de publier', async () => {
    vi.mocked(getPageByIdDao).mockResolvedValue({
      ...pageRow(),
      blocks: [
        {
          id: UNKNOWN_BLOCK_ID,
          type: 'carrousel-2019',
          rank: 0,
          data: {slides: []},
        },
      ],
    })

    const result = await publishPageService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
    })

    expect(result.status).toBe('published')
  })
})

describe('unpublishPageService', () => {
  it('retire la page du site sans la supprimer', async () => {
    const result = await unpublishPageService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
    })

    expect(result.status).toBe('unpublished')
    expect(updatePageStatusDao).toHaveBeenCalledWith(PAGE_ID, 'unpublished')
  })

  it('ne touche pas à une page d’une autre association', async () => {
    vi.mocked(getPageByIdDao).mockResolvedValue(undefined)

    await expect(
      unpublishPageService({organizationId: ORG_ID, pageId: OTHER_PAGE_ID})
    ).rejects.toThrow()
    expect(updatePageStatusDao).not.toHaveBeenCalled()
  })
})
