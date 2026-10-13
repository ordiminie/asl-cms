import 'server-only'

import {
  deleteOrganizationSettingsDao,
  getOrganizationSettingsDao,
  upsertOrganizationSettingsDao,
} from '@/db/repositories/organization-setting-repository'
import {
  getPageByIdDao,
  PageWithBlocksRow,
} from '@/db/repositories/page-repository'
import {withTenant} from '@/db/tenant-scope'

import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {NotFoundError} from './errors/not-found-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {toPageWithBlocksDto} from './page-service'
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  HOME_PAGE_SETTING_KEY,
  HomePageForBureauDTO,
  HomePageSaveResult,
} from './types/domain/home-page-types'
import {PageWithBlocksDTO} from './types/domain/page-types'
import {User} from './types/domain/user-types'
import {
  homePageOrganizationIdSchema,
  homePagePageIdSchema,
  setHomePageServiceSchema,
} from './validation/home-page-validation'

const MANAGE_DENIED =
  "Seul le bureau de l'association peut choisir la page d'accueil"

const requireHomePageManager = async (
  organizationId: string
): Promise<User | undefined> => {
  const authUser = await getAuthUser()
  if (
    !canPerformAction(authUser, organizationId, ActionIdConst.HOME_PAGE_MANAGE)
  ) {
    throw new AuthorizationError(MANAGE_DENIED)
  }
  return authUser
}

/**
 * Lit la page designee, **quel que soit son statut**. Ligne absente, valeur
 * qui n'est pas un UUID ou page introuvable : `undefined` — sans integrite
 * referentielle (ADR 032), toute lecture traite la reference pendante comme
 * « accueil automatique ».
 *
 * A appeler dans un `withTenant(organizationId, ...)` ouvert par l'appelant :
 * la RLS ne rend jamais la page d'une autre association.
 */
const readHomePage = async (
  organizationId: string
): Promise<PageWithBlocksRow | undefined> => {
  const rows = await getOrganizationSettingsDao(organizationId)
  const value = rows.find((row) => row.key === HOME_PAGE_SETTING_KEY)?.value
  const pageId = homePagePageIdSchema.safeParse(value)
  if (!pageId.success) return undefined

  return getPageByIdDao(pageId.data)
}

/**
 * Designe la page d'accueil, ou revient a l'accueil automatique (`pageId`
 * nul, la ligne est supprimee).
 *
 * Ordre : `safeParse` -> controle d'acces -> lecture de la page **sous le
 * scope de l'association** -> ecriture. La page d'une autre association n'est
 * pas rendue par la RLS : elle est refusee exactement comme une page inconnue.
 * Une page qui n'est pas publiee est rendue comme un resultat, sans ecriture.
 */
export const setHomePageService = async (input: {
  organizationId: string
  pageId: string | null
}): Promise<HomePageSaveResult> => {
  const parsed = setHomePageServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, pageId} = parsed.data
  const authUser = await requireHomePageManager(organizationId)

  if (pageId === null) {
    await withTenant(organizationId, () =>
      deleteOrganizationSettingsDao(organizationId, [HOME_PAGE_SETTING_KEY])
    )
    return {status: 'saved'}
  }

  return withTenant(organizationId, async () => {
    const page = await getPageByIdDao(pageId)
    if (!page) {
      throw new NotFoundError('Page introuvable')
    }
    if (page.status !== 'published') {
      return {status: 'not_published'} as const
    }

    await upsertOrganizationSettingsDao([
      {
        organizationId,
        key: HOME_PAGE_SETTING_KEY,
        value: pageId,
        updatedBy: authUser?.id ?? null,
      },
    ])
    return {status: 'saved'} as const
  })
}

/** Le choix tel que l'ecran du bureau l'affiche, page non publiee comprise. */
export const getHomePageForBureauService = async (
  organizationId: string
): Promise<HomePageForBureauDTO> => {
  const parsed = homePageOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireHomePageManager(parsed.data)

  const page = await withTenant(parsed.data, () => readHomePage(parsed.data))
  if (!page) return {page: null}

  return {page: {id: page.id, title: page.title, status: page.status}}
}

/**
 * La page designee pour le site public, **quel que soit son statut** : c'est
 * le DAL qui ne la sert que publiee (ADR 032). Rendre aussi un brouillon
 * permet au DAL de poser le tag `page:` de la page, que sa publication
 * invalide.
 *
 * **Sans controle d'autorisation, et c'est delibere**, comme
 * `getPageBySlugService` : l'accueil s'adresse a tout le monde.
 */
export const getPublicHomePageService = async (
  organizationId: string
): Promise<PageWithBlocksDTO | undefined> => {
  const parsed = homePageOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) return undefined

  const page = await withTenant(parsed.data, () => readHomePage(parsed.data))
  return page ? toPageWithBlocksDto(page) : undefined
}

/**
 * L'utilisateur connecte peut-il choisir la page d'accueil de cette
 * association ? Sert l'interface ; l'ecriture reverifie de son cote.
 */
export const canManageHomePageService = async (
  organizationId: string
): Promise<boolean> => {
  const parsed = homePageOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) return false

  const authUser = await getAuthUser()
  return canPerformAction(authUser, parsed.data, ActionIdConst.HOME_PAGE_MANAGE)
}
