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
vi.mock('@/db/repositories/menu-item-repository', () => ({
  addMenuItemDao: vi.fn(),
  getMenuItemsByOrganizationDao: vi.fn(),
  removeMenuItemDao: vi.fn(),
  reorderMenuItemsTxnDao: vi.fn(),
  setMenuItemVisibilityDao: vi.fn(),
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
  addMenuItemDao,
  getMenuItemsByOrganizationDao,
  removeMenuItemDao,
  reorderMenuItemsTxnDao,
  setMenuItemVisibilityDao,
} from '@/db/repositories/menu-item-repository'
import {
  deleteOrganizationSettingsDao,
  getOrganizationSettingsDao,
  upsertOrganizationSettingsDao,
} from '@/db/repositories/organization-setting-repository'
import {getPageByIdDao} from '@/db/repositories/page-repository'

import {getAssociationSettingsService} from '../association-settings-service'
import {AuthorizationError} from '../errors/authorization-error'
import {NotFoundError} from '../errors/not-found-error'
import {
  addMenuItemService,
  canManageSiteNavigationService,
  getMenuItemsForBureauService,
  getPublicSiteNavigationService,
  getSiteFooterService,
  removeMenuItemService,
  reorderMenuItemsService,
  saveSiteFooterService,
  setMenuItemVisibilityService,
} from '../site-navigation-service'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_PAGE_ID = '44444444-4444-4444-8444-444444444444'
const ITEM_ID = '55555555-5555-4555-8555-555555555555'
const OTHER_ITEM_ID = '66666666-6666-4666-8666-666666666666'

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
  status: 'published' as const,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  blocks: [],
  ...overrides,
})

const menuRow = (overrides: Record<string, unknown> = {}) => ({
  id: ITEM_ID,
  organizationId: ORG_ID,
  pageId: PAGE_ID,
  rank: 0,
  visible: true,
  pageTitle: "Qualité de l'eau",
  pageSlug: 'qualite-de-leau',
  pageStatus: 'published' as const,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))
  vi.mocked(getPageByIdDao).mockImplementation(async (pageId) =>
    pageId === PAGE_ID ? pageRow() : undefined
  )
  vi.mocked(getMenuItemsByOrganizationDao).mockImplementation(async () => {
    expect(scope.current).toBe(ORG_ID)
    return []
  })
  vi.mocked(addMenuItemDao).mockImplementation(async (input) => {
    expect(scope.current).toBe(ORG_ID)
    return {
      id: ITEM_ID,
      organizationId: input.organizationId,
      pageId: input.pageId,
      rank: input.rank,
      visible: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  })
  vi.mocked(removeMenuItemDao).mockImplementation(async () => {
    expect(scope.current).toBe(ORG_ID)
  })
  vi.mocked(reorderMenuItemsTxnDao).mockImplementation(async () => {
    expect(scope.current).toBe(ORG_ID)
  })
  vi.mocked(setMenuItemVisibilityDao).mockImplementation(async () => {
    expect(scope.current).toBe(ORG_ID)
  })
  vi.mocked(getOrganizationSettingsDao).mockImplementation(async () => {
    expect(scope.current).toBe(ORG_ID)
    return []
  })
  vi.mocked(upsertOrganizationSettingsDao).mockImplementation(async () => {
    expect(scope.current).toBe(ORG_ID)
  })
})

describe('[BUREAU] gestion du menu', () => {
  it('ajoute une entrée pointant vers une page de son association (owner)', async () => {
    const result = await addMenuItemService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
    })

    expect(result.status).toBe('added')
    expect(addMenuItemDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
      rank: 0,
    })
  })

  it('ajoute une entrée pour un membre du bureau (board), au rang suivant', async () => {
    const thirdPageId = '77777777-7777-4777-8777-777777777777'
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.ADMIN))
    vi.mocked(getPageByIdDao).mockResolvedValue(pageRow({id: thirdPageId}))
    vi.mocked(getMenuItemsByOrganizationDao).mockResolvedValue([
      menuRow({rank: 0}),
      menuRow({id: OTHER_ITEM_ID, pageId: OTHER_PAGE_ID, rank: 1}),
    ])

    const result = await addMenuItemService({
      organizationId: ORG_ID,
      pageId: thirdPageId,
    })

    expect(result.status).toBe('added')
    expect(addMenuItemDao).toHaveBeenCalledWith(
      expect.objectContaining({rank: 2})
    )
  })

  it('retire une entrée du menu', async () => {
    await removeMenuItemService({organizationId: ORG_ID, menuItemId: ITEM_ID})

    expect(removeMenuItemDao).toHaveBeenCalledWith(ORG_ID, ITEM_ID)
  })

  /**
   * Un seul chemin de reordonnancement : la souris et le clavier envoient le
   * meme tableau d'identifiants, donc produisent le meme resultat.
   */
  it('réordonne le menu à partir de la liste ordonnée reçue', async () => {
    await reorderMenuItemsService({
      organizationId: ORG_ID,
      orderedIds: [OTHER_ITEM_ID, ITEM_ID],
    })

    expect(reorderMenuItemsTxnDao).toHaveBeenCalledWith(ORG_ID, [
      OTHER_ITEM_ID,
      ITEM_ID,
    ])
  })

  it('bascule la visibilité propre d une entrée', async () => {
    await setMenuItemVisibilityService({
      organizationId: ORG_ID,
      menuItemId: ITEM_ID,
      visible: false,
    })

    expect(setMenuItemVisibilityDao).toHaveBeenCalledWith(
      ORG_ID,
      ITEM_ID,
      false
    )
  })

  it('liste le menu de gestion, statuts des pages compris', async () => {
    vi.mocked(getMenuItemsByOrganizationDao).mockResolvedValue([
      menuRow({rank: 0, pageStatus: 'draft'}),
    ])

    const items = await getMenuItemsForBureauService(ORG_ID)

    expect(items).toEqual([
      {
        id: ITEM_ID,
        pageId: PAGE_ID,
        rank: 0,
        visible: true,
        pageTitle: "Qualité de l'eau",
        pageSlug: 'qualite-de-leau',
        pageStatus: 'draft',
      },
    ])
  })
})

describe('[BUREAU] refus métier de la gestion du menu', () => {
  /**
   * La contrainte unique `(organization_id, page_id)` tranche en base ; le
   * service la devance et rend un refus lisible, jamais une exception brute de
   * Postgres.
   */
  it('refuse une page déjà présente dans le menu', async () => {
    vi.mocked(getMenuItemsByOrganizationDao).mockResolvedValue([menuRow()])

    const result = await addMenuItemService({
      organizationId: ORG_ID,
      pageId: PAGE_ID,
    })

    expect(result).toEqual({status: 'rejected', error: 'already_in_menu'})
    expect(addMenuItemDao).not.toHaveBeenCalled()
  })

  /**
   * Un identifiant de page valide ailleurs ne doit jamais entrer dans le menu
   * d'une autre association : sous RLS, la page n'existe simplement pas.
   */
  it('refuse une page qui n appartient pas à cette association', async () => {
    await expect(
      addMenuItemService({organizationId: ORG_ID, pageId: OTHER_PAGE_ID})
    ).rejects.toThrow(NotFoundError)
    expect(addMenuItemDao).not.toHaveBeenCalled()
  })
})

describe('[ORGANIZATION MEMBER] un membre simple ne touche pas au menu', () => {
  beforeEach(() => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.MEMBER))
  })

  it('refuse l ajout', async () => {
    await expect(
      addMenuItemService({organizationId: ORG_ID, pageId: PAGE_ID})
    ).rejects.toThrow(AuthorizationError)
    expect(addMenuItemDao).not.toHaveBeenCalled()
  })

  it('refuse le retrait', async () => {
    await expect(
      removeMenuItemService({organizationId: ORG_ID, menuItemId: ITEM_ID})
    ).rejects.toThrow(AuthorizationError)
    expect(removeMenuItemDao).not.toHaveBeenCalled()
  })

  it('refuse le réordonnancement', async () => {
    await expect(
      reorderMenuItemsService({organizationId: ORG_ID, orderedIds: [ITEM_ID]})
    ).rejects.toThrow(AuthorizationError)
    expect(reorderMenuItemsTxnDao).not.toHaveBeenCalled()
  })

  it('refuse la bascule de visibilité', async () => {
    await expect(
      setMenuItemVisibilityService({
        organizationId: ORG_ID,
        menuItemId: ITEM_ID,
        visible: false,
      })
    ).rejects.toThrow(AuthorizationError)
    expect(setMenuItemVisibilityDao).not.toHaveBeenCalled()
  })
})

describe('[PUBLIC] un visiteur non connecté ne touche pas au menu', () => {
  it('refuse l ajout', async () => {
    setupAuthUserMocked(undefined)

    await expect(
      addMenuItemService({organizationId: ORG_ID, pageId: PAGE_ID})
    ).rejects.toThrow(AuthorizationError)
    expect(addMenuItemDao).not.toHaveBeenCalled()
  })
})

const settingRow = (key: string, value: string) => ({
  organizationId: ORG_ID,
  key,
  value,
  updatedAt: new Date('2026-01-02'),
  updatedBy: null,
})

describe('[BUREAU] pied de page', () => {
  it('lit le contenu enregistré', async () => {
    vi.mocked(getOrganizationSettingsDao).mockResolvedValue([
      settingRow('site.footer_content', "**L'association** œuvre depuis 1987."),
    ])

    await expect(getSiteFooterService(ORG_ID)).resolves.toBe(
      "**L'association** œuvre depuis 1987."
    )
  })

  it('rend une chaîne vide quand aucun pied de page n a été enregistré', async () => {
    await expect(getSiteFooterService(ORG_ID)).resolves.toBe('')
  })

  it('enregistre le contenu sous sa clé dédiée', async () => {
    await saveSiteFooterService(ORG_ID, 'Contact : bureau@example.org')

    expect(upsertOrganizationSettingsDao).toHaveBeenCalledWith([
      expect.objectContaining({
        organizationId: ORG_ID,
        key: 'site.footer_content',
        value: 'Contact : bureau@example.org',
      }),
    ])
  })

  /**
   * Vide = aucun pied de page affiche cote public, pas un retour au defaut :
   * la ligne est ecrite avec sa valeur vide, jamais supprimee comme le fait le
   * registre des reglages (ADR 016).
   */
  it('accepte une valeur vide, et l écrit plutôt que de supprimer la ligne', async () => {
    await saveSiteFooterService(ORG_ID, '')

    expect(upsertOrganizationSettingsDao).toHaveBeenCalledWith([
      expect.objectContaining({key: 'site.footer_content', value: ''}),
    ])
    expect(deleteOrganizationSettingsDao).not.toHaveBeenCalled()
  })
})

describe('[ORGANIZATION MEMBER] un membre simple ne touche pas au pied de page', () => {
  beforeEach(() => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.MEMBER))
  })

  it('refuse la lecture de gestion', async () => {
    await expect(getSiteFooterService(ORG_ID)).rejects.toThrow(
      AuthorizationError
    )
    expect(getOrganizationSettingsDao).not.toHaveBeenCalled()
  })

  it('refuse l enregistrement', async () => {
    await expect(saveSiteFooterService(ORG_ID, 'Pirate')).rejects.toThrow(
      AuthorizationError
    )
    expect(upsertOrganizationSettingsDao).not.toHaveBeenCalled()
  })
})

/**
 * Lecture publique : sans controle d'autorisation, et c'est delibere — le menu
 * et le pied de page s'adressent aux visiteurs, comme une page publiee.
 */
describe('[PUBLIC] navigation rendue au visiteur', () => {
  beforeEach(() => {
    setupAuthUserMocked(undefined)
    vi.mocked(getOrganizationSettingsDao).mockResolvedValue([
      settingRow('site.footer_content', 'Les Amis de l’Étang, depuis 1987.'),
    ])
  })

  it('rend les entrées visibles dont la page est publiée, dans leur ordre', async () => {
    vi.mocked(getMenuItemsByOrganizationDao).mockResolvedValue([
      menuRow({rank: 0, pageTitle: "Qualité de l'eau", pageSlug: 'eau'}),
      menuRow({
        id: OTHER_ITEM_ID,
        pageId: OTHER_PAGE_ID,
        rank: 1,
        pageTitle: 'Adhérer',
        pageSlug: 'adherer',
      }),
    ])

    const navigation = await getPublicSiteNavigationService(ORG_ID)

    expect(navigation.menu).toEqual([
      {id: ITEM_ID, title: "Qualité de l'eau", slug: 'eau'},
      {id: OTHER_ITEM_ID, title: 'Adhérer', slug: 'adherer'},
    ])
    expect(navigation.footerContent).toBe('Les Amis de l’Étang, depuis 1987.')
  })

  /** Critère 2 : une entrée vers une page dépubliée disparaît, sans casser le menu. */
  it('omet l entrée dont la page n est pas publiée', async () => {
    vi.mocked(getMenuItemsByOrganizationDao).mockResolvedValue([
      menuRow({rank: 0, pageStatus: 'draft'}),
      menuRow({
        id: OTHER_ITEM_ID,
        pageId: OTHER_PAGE_ID,
        rank: 1,
        pageStatus: 'unpublished',
      }),
      menuRow({
        id: '88888888-8888-4888-8888-888888888888',
        pageId: '99999999-9999-4999-8999-999999999999',
        rank: 2,
        pageSlug: 'adherer',
        pageTitle: 'Adhérer',
      }),
    ])

    const navigation = await getPublicSiteNavigationService(ORG_ID)

    expect(navigation.menu.map((entry) => entry.slug)).toEqual(['adherer'])
  })

  /** Critère 6 : la visibilité de l'entrée est propre, même page publiée. */
  it('omet l entrée masquée par le bureau bien que sa page soit publiée', async () => {
    vi.mocked(getMenuItemsByOrganizationDao).mockResolvedValue([
      menuRow({rank: 0, visible: false, pageStatus: 'published'}),
    ])

    const navigation = await getPublicSiteNavigationService(ORG_ID)

    expect(navigation.menu).toEqual([])
  })

  it('rend un pied de page vide quand aucun n est enregistré', async () => {
    vi.mocked(getOrganizationSettingsDao).mockResolvedValue([])
    vi.mocked(getMenuItemsByOrganizationDao).mockResolvedValue([])

    await expect(getPublicSiteNavigationService(ORG_ID)).resolves.toEqual({
      menu: [],
      footerContent: '',
    })
  })
})

describe('canManageSiteNavigationService', () => {
  it('accorde au bureau de cette association', async () => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.ADMIN))

    await expect(canManageSiteNavigationService(ORG_ID)).resolves.toBe(true)
  })

  it('refuse un membre simple', async () => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.MEMBER))

    await expect(canManageSiteNavigationService(ORG_ID)).resolves.toBe(false)
  })
})

/**
 * ADR 021 : la cle du pied de page vit dans `organization_setting` **hors** du
 * registre typé. `resolveSettings` itere le registre, jamais les lignes : sa
 * presence en base ne doit rien changer aux reglages de s02.
 */
describe('pied de page et registre des réglages (s02) ne se croisent pas', () => {
  it('laisse la résolution du registre inchangée en présence de la clé du pied de page', async () => {
    vi.mocked(getOrganizationSettingsDao).mockResolvedValue([])
    const withoutFooter = await getAssociationSettingsService(ORG_ID)

    vi.mocked(getOrganizationSettingsDao).mockResolvedValue([
      settingRow('site.footer_content', 'Pied de page des Amis de l’Étang'),
    ])
    const withFooter = await getAssociationSettingsService(ORG_ID)

    expect(withFooter).toEqual(withoutFooter)
    expect(withFooter).not.toHaveProperty('site.footer_content')
  })
})
