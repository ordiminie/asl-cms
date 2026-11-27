'use server'

import {updateTag} from 'next/cache'
import {getTranslations} from 'next-intl/server'

import {siteNavigationTag} from '@/app/dal/site-navigation-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {
  createMenuLinkFormSchema,
  MENU_LINK_FORM_FIELDS,
  type MenuLinkActionResult,
  type MenuLinkFormField,
} from '@/components/features/navigation/menu-link-form-validation'
import type {
  SiteNavigationActionResult,
  SiteNavigationAddResult,
} from '@/components/features/navigation/site-navigation-manager'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {ValidationParsedZodError} from '@/services/errors/validation-error'
import {
  addMenuItemService,
  addMenuLinkService,
  removeMenuItemService,
  reorderMenuItemsService,
  saveSiteFooterService,
  setMenuItemVisibilityService,
  updateMenuLinkService,
} from '@/services/facades/site-navigation-service-facade'
import {
  MENU_ITEM_ALREADY_IN_MENU,
  type MenuLinkItemDTO,
} from '@/services/types/domain/site-navigation-types'

/**
 * Server Actions de l'ecran « Navigation du site » (s04b, ecran 1).
 *
 * Chacune rejoue le controle de session (`requireActionAuth`) avant d'appeler
 * la facade — le service reverifie l'autorisation de son cote — puis invalide
 * `siteNavigationTag` **apres** le succes seulement : un echec ne doit pas
 * faire tomber une lecture publique encore valable. Un refus est rendu comme
 * un resultat traduit, jamais leve : l'ecran l'ecrit dans la page (§5).
 */

const failure = async (
  error: unknown
): Promise<{status: 'error'; message: string}> => {
  const t = await getTranslations('BureauNavigationPage.errors')
  return {
    status: 'error',
    message: error instanceof AuthorizationError ? t('forbidden') : t('failed'),
  }
}

/** Ajoute une entree pointant vers une page de cette association. */
export async function addMenuItemAction(
  pageId: string
): Promise<SiteNavigationAddResult> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    const result = await addMenuItemService({
      organizationId: tenant.id,
      pageId,
    })

    if (result.status === 'rejected') {
      const t = await getTranslations('BureauNavigationPage.errors')
      return {
        status: 'error',
        message:
          result.error === MENU_ITEM_ALREADY_IN_MENU
            ? t('alreadyInMenu')
            : t('failed'),
      }
    }

    updateTag(siteNavigationTag(tenant.id))
    return {status: 'added', item: result.item}
  } catch (error) {
    return failure(error)
  }
}

/** Retire une entree du menu, sans toucher a la page qu'elle designe. */
export async function removeMenuItemAction(
  menuItemId: string
): Promise<SiteNavigationActionResult> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    await removeMenuItemService({organizationId: tenant.id, menuItemId})

    updateTag(siteNavigationTag(tenant.id))
    return {status: 'ok'}
  } catch (error) {
    return failure(error)
  }
}

/**
 * Ecrit l'ordre du menu. Le rang vient de la position dans la liste recue :
 * souris et clavier empruntent ce seul chemin.
 */
export async function reorderMenuItemsAction(
  orderedIds: string[]
): Promise<SiteNavigationActionResult> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    await reorderMenuItemsService({organizationId: tenant.id, orderedIds})

    updateTag(siteNavigationTag(tenant.id))
    return {status: 'ok'}
  } catch (error) {
    return failure(error)
  }
}

/** Bascule la visibilite propre d'une entree (critere 6), a effet immediat. */
export async function setMenuItemVisibilityAction(
  menuItemId: string,
  visible: boolean
): Promise<SiteNavigationActionResult> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    await setMenuItemVisibilityService({
      organizationId: tenant.id,
      menuItemId,
      visible,
    })

    updateTag(siteNavigationTag(tenant.id))
    return {status: 'ok'}
  } catch (error) {
    return failure(error)
  }
}

/**
 * Enregistre le pied de page. Le vide est accepte : il veut dire « aucun pied
 * de page affiche », pas « revenir au defaut ».
 */
export async function saveSiteFooterAction(
  content: string
): Promise<SiteNavigationActionResult> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    await saveSiteFooterService(tenant.id, content)

    updateTag(siteNavigationTag(tenant.id))
    return {status: 'ok'}
  } catch (error) {
    return failure(error)
  }
}

const readField = (formData: FormData, key: string): string =>
  formData.get(key)?.toString() ?? ''

type Translator = Awaited<ReturnType<typeof getTranslations>>

const toLinkFailure = (error: unknown, t: Translator): MenuLinkActionResult => {
  if (error instanceof AuthorizationError) {
    return {status: 'error', message: t('errors.forbidden')}
  }
  if (error instanceof ValidationParsedZodError) {
    return {status: 'error', message: t('errors.invalidData')}
  }
  return {status: 'error', message: t('errors.failed')}
}

/**
 * Gabarit commun de l'ajout et de la modification d'une entree libre (s50) :
 * le schema traduit du formulaire est rejoue ici pour rendre chaque refus **sur
 * son champ** (critere 3), avant tout appel de la facade ; le menu n'est
 * invalide qu'apres un succes (critere 6). Une entree introuvable — une entree
 * de page, ou celle d'une autre association — est un echec sans champ.
 */
const saveMenuLink = async (
  formData: FormData,
  save: (values: {
    organizationId: string
    label: string
    address: string
  }) => Promise<MenuLinkItemDTO>
): Promise<MenuLinkActionResult> => {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('BureauNavigationPage')

  try {
    await requireActionAuth()

    const validation = createMenuLinkFormSchema(t).safeParse(
      Object.fromEntries(
        MENU_LINK_FORM_FIELDS.map((field) => [
          field,
          readField(formData, field),
        ])
      )
    )
    if (!validation.success) {
      return {
        status: 'invalid',
        errors: validation.error.issues.map((issue) => ({
          field: issue.path[0] as MenuLinkFormField,
          message: issue.message,
        })),
      }
    }

    const item = await save({organizationId: tenant.id, ...validation.data})

    updateTag(siteNavigationTag(tenant.id))
    return {status: 'saved', item}
  } catch (error) {
    return toLinkFailure(error, t)
  }
}

/** « Ajouter au menu » depuis le `dialog` d'une adresse : en dernier rang. */
export async function addMenuLinkAction(
  _prevState: MenuLinkActionResult | undefined,
  formData: FormData
): Promise<MenuLinkActionResult> {
  return saveMenuLink(formData, (values) => addMenuLinkService(values))
}

/**
 * « Enregistrer l'entree » : libelle et adresse d'une entree **deja libre**.
 * Le type d'une entree ne change jamais (arbitrage 2).
 */
export async function updateMenuLinkAction(
  _prevState: MenuLinkActionResult | undefined,
  formData: FormData
): Promise<MenuLinkActionResult> {
  return saveMenuLink(formData, (values) =>
    updateMenuLinkService({
      ...values,
      menuItemId: readField(formData, 'menuItemId'),
    })
  )
}
