import 'server-only'

import {
  addMenuItemDao,
  getMenuItemsByOrganizationDao,
  MenuItemRow,
  removeMenuItemDao,
  reorderMenuItemsTxnDao,
  setMenuItemVisibilityDao,
} from '@/db/repositories/menu-item-repository'
import {
  getOrganizationSettingsDao,
  upsertOrganizationSettingsDao,
} from '@/db/repositories/organization-setting-repository'
import {getPageByIdDao} from '@/db/repositories/page-repository'
import {withTenant} from '@/db/tenant-scope'

import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {NotFoundError} from './errors/not-found-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  MENU_ITEM_ALREADY_IN_MENU,
  MenuItemDTO,
  MenuItemMutationResult,
  SITE_FOOTER_SETTING_KEY,
  SiteNavigationDTO,
} from './types/domain/site-navigation-types'
import {
  addMenuItemServiceSchema,
  menuItemMutationServiceSchema,
  reorderMenuItemsServiceSchema,
  saveSiteFooterServiceSchema,
  setMenuItemVisibilityServiceSchema,
  siteNavigationOrganizationIdSchema,
} from './validation/site-navigation-validation'

const MANAGE_DENIED =
  "Seul le bureau de l'association peut gérer la navigation du site"

const toMenuItemDto = (row: MenuItemRow): MenuItemDTO => ({
  id: row.id,
  pageId: row.pageId,
  rank: row.rank,
  visible: row.visible,
  pageTitle: row.pageTitle,
  pageSlug: row.pageSlug,
  pageStatus: row.pageStatus,
})

const requireNavigationManager = async (
  organizationId: string
): Promise<void> => {
  const authUser = await getAuthUser()
  if (
    !canPerformAction(
      authUser,
      organizationId,
      ActionIdConst.SITE_NAVIGATION_MANAGE
    )
  ) {
    throw new AuthorizationError(MANAGE_DENIED)
  }
}

/**
 * Ajoute une entree de menu pointant vers une page de **cette** association.
 *
 * Ordre : `safeParse` -> controle d'acces -> la page appartient bien a cette
 * association -> ecriture sous son scope. Un identifiant de page valide
 * ailleurs n'existe pas ici : sous RLS, la lecture ne rend rien et l'ajout est
 * refuse. Une page deja presente est rendue comme un resultat, sans rien
 * ecrire.
 */
export const addMenuItemService = async (input: {
  organizationId: string
  pageId: string
}): Promise<MenuItemMutationResult> => {
  const parsed = addMenuItemServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireNavigationManager(parsed.data.organizationId)

  return withTenant(parsed.data.organizationId, async () => {
    const targetPage = await getPageByIdDao(parsed.data.pageId)
    if (!targetPage) {
      throw new NotFoundError('Page introuvable')
    }

    const existing = await getMenuItemsByOrganizationDao(
      parsed.data.organizationId
    )
    if (existing.some((item) => item.pageId === parsed.data.pageId)) {
      return {status: 'rejected', error: MENU_ITEM_ALREADY_IN_MENU}
    }

    const created = await addMenuItemDao({
      organizationId: parsed.data.organizationId,
      pageId: parsed.data.pageId,
      rank: existing.length,
    })

    return {
      status: 'added',
      item: {
        id: created.id,
        pageId: created.pageId,
        rank: created.rank,
        visible: created.visible,
        pageTitle: targetPage.title,
        pageSlug: targetPage.slug,
        pageStatus: targetPage.status,
      },
    }
  })
}

/** Retire une entree du menu. La page cible, elle, n'est pas touchee. */
export const removeMenuItemService = async (input: {
  organizationId: string
  menuItemId: string
}): Promise<void> => {
  const parsed = menuItemMutationServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireNavigationManager(parsed.data.organizationId)

  await withTenant(parsed.data.organizationId, () =>
    removeMenuItemDao(parsed.data.organizationId, parsed.data.menuItemId)
  )
}

/**
 * Ecrit l'ordre du menu. Le rang vient de la **position dans le tableau**,
 * jamais d'un champ envoye par le client : souris et clavier passent par cette
 * seule fonction, donc produisent exactement le meme resultat.
 */
export const reorderMenuItemsService = async (input: {
  organizationId: string
  orderedIds: string[]
}): Promise<void> => {
  const parsed = reorderMenuItemsServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireNavigationManager(parsed.data.organizationId)

  await withTenant(parsed.data.organizationId, () =>
    reorderMenuItemsTxnDao(parsed.data.organizationId, parsed.data.orderedIds)
  )
}

/**
 * Bascule la visibilite propre d'une entree (critere 6) : independante du
 * statut de publication de sa page, qui masque de son cote.
 */
export const setMenuItemVisibilityService = async (input: {
  organizationId: string
  menuItemId: string
  visible: boolean
}): Promise<void> => {
  const parsed = setMenuItemVisibilityServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireNavigationManager(parsed.data.organizationId)

  await withTenant(parsed.data.organizationId, () =>
    setMenuItemVisibilityDao(
      parsed.data.organizationId,
      parsed.data.menuItemId,
      parsed.data.visible
    )
  )
}

/**
 * Le menu tel que l'ecran de gestion l'affiche : **toutes** les entrees,
 * statuts des pages compris, y compris celles qui ne paraissent pas au
 * visiteur.
 */
export const getMenuItemsForBureauService = async (
  organizationId: string
): Promise<MenuItemDTO[]> => {
  const parsed = siteNavigationOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireNavigationManager(parsed.data)

  const rows = await withTenant(parsed.data, () =>
    getMenuItemsByOrganizationDao(parsed.data)
  )
  return rows.map((row) => toMenuItemDto(row))
}

/**
 * Lit la ligne `site.footer_content` de `organization_setting` **sans passer
 * par le registre typé** des parametres (ADR 021) : `getOrganizationSettingsDao`
 * est generique, et `resolveSettings` n'itere que ses propres cles.
 *
 * A appeler dans un `withTenant(organizationId, ...)` ouvert par l'appelant.
 */
const readFooterContent = async (organizationId: string): Promise<string> => {
  const rows = await getOrganizationSettingsDao(organizationId)
  return rows.find((row) => row.key === SITE_FOOTER_SETTING_KEY)?.value ?? ''
}

/** Le pied de page tel que l'ecran de gestion l'edite. */
export const getSiteFooterService = async (
  organizationId: string
): Promise<string> => {
  const parsed = siteNavigationOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireNavigationManager(parsed.data)

  return withTenant(parsed.data, () => readFooterContent(parsed.data))
}

/**
 * Enregistre le pied de page. Le vide est **accepte** et ecrit tel quel : il
 * veut dire « aucun pied de page affiche », pas « revenir au defaut » — la
 * ligne n'est donc jamais supprimee, contrairement a un parametre du registre
 * (ADR 016).
 */
export const saveSiteFooterService = async (
  organizationId: string,
  content: string
): Promise<void> => {
  const parsed = saveSiteFooterServiceSchema.safeParse({
    organizationId,
    content,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const authUser = await getAuthUser()
  if (
    !canPerformAction(
      authUser,
      parsed.data.organizationId,
      ActionIdConst.SITE_NAVIGATION_MANAGE
    )
  ) {
    throw new AuthorizationError(MANAGE_DENIED)
  }

  await withTenant(parsed.data.organizationId, () =>
    upsertOrganizationSettingsDao([
      {
        organizationId: parsed.data.organizationId,
        key: SITE_FOOTER_SETTING_KEY,
        value: parsed.data.content,
        updatedBy: authUser?.id ?? null,
      },
    ])
  )
}

/**
 * Menu et pied de page tels que le visiteur les voit.
 *
 * **Sans controle d'autorisation, et c'est delibere**, comme
 * `getPageBySlugService` : cette navigation s'adresse au public. Une entree ne
 * parait que si le bureau l'a laissee visible **et** que sa page est publiee —
 * les deux conditions sont independantes (criteres 2 et 6), et une entree
 * ecartee est simplement absente, jamais un lien casse.
 */
export const getPublicSiteNavigationService = async (
  organizationId: string
): Promise<SiteNavigationDTO> => {
  const parsed = siteNavigationOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    return {menu: [], footerContent: ''}
  }

  return withTenant(parsed.data, async () => {
    const rows = await getMenuItemsByOrganizationDao(parsed.data)

    return {
      menu: rows
        .filter((row) => row.visible && row.pageStatus === 'published')
        .map((row) => ({
          id: row.id,
          title: row.pageTitle,
          slug: row.pageSlug,
        })),
      footerContent: await readFooterContent(parsed.data),
    }
  })
}

/**
 * L'utilisateur connecte peut-il gerer la navigation de cette association ?
 * Sert l'interface (rubrique de la barre laterale, ecran de gestion) ; chaque
 * mutation reverifie de son cote.
 */
export const canManageSiteNavigationService = async (
  organizationId: string
): Promise<boolean> => {
  const parsed = siteNavigationOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) return false

  const authUser = await getAuthUser()
  return canPerformAction(
    authUser,
    parsed.data,
    ActionIdConst.SITE_NAVIGATION_MANAGE
  )
}
