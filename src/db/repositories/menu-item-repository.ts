import {and, asc, eq, isNull} from 'drizzle-orm'

import {menuItem, MenuItemModel} from '@/db/models/menu-item-model'
import {page, PageModel} from '@/db/models/page-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Entrees du menu du site d'une association (ADR 021). Sous RLS forcee : hors
 * `withTenant(organizationId, ...)`, rien ne sort et rien ne s'ecrit.
 */

export type MenuItemRow = {
  id: string
  organizationId: string
  pageId: string | null
  rank: number
  visible: boolean
  pageTitle: string | null
  pageSlug: string | null
  pageStatus: PageModel['status'] | null
  label: string | null
  address: string | null
}

/**
 * Le menu d'une association, dans son ordre, joint a `page` pour le titre et le
 * statut : l'ecran de gestion affiche les deux, et le rendu public a besoin du
 * statut pour omettre une entree dont la page n'est plus publiee (critere 2).
 *
 * Jointure **externe** (ADR 078) : une entree libre n'a pas de page, une
 * jointure interne la ferait disparaitre sans erreur.
 */
export const getMenuItemsByOrganizationDao = async (
  organizationId: string
): Promise<MenuItemRow[]> =>
  getDb()
    .select({
      id: menuItem.id,
      organizationId: menuItem.organizationId,
      pageId: menuItem.pageId,
      rank: menuItem.rank,
      visible: menuItem.visible,
      pageTitle: page.title,
      pageSlug: page.slug,
      pageStatus: page.status,
      label: menuItem.label,
      address: menuItem.address,
    })
    .from(menuItem)
    .leftJoin(page, eq(menuItem.pageId, page.id))
    .where(eq(menuItem.organizationId, organizationId))
    .orderBy(asc(menuItem.rank))

export const addMenuItemDao = async (input: {
  organizationId: string
  pageId: string
  rank: number
}): Promise<MenuItemModel> => {
  const [row] = await getDb().insert(menuItem).values(input).returning()
  return row
}

export const removeMenuItemDao = async (
  organizationId: string,
  menuItemId: string
): Promise<void> => {
  await getDb()
    .delete(menuItem)
    .where(
      and(
        eq(menuItem.id, menuItemId),
        eq(menuItem.organizationId, organizationId)
      )
    )
}

export const setMenuItemVisibilityDao = async (
  organizationId: string,
  menuItemId: string,
  visible: boolean
): Promise<void> => {
  await getDb()
    .update(menuItem)
    .set({visible, updatedAt: new Date()})
    .where(
      and(
        eq(menuItem.id, menuItemId),
        eq(menuItem.organizationId, organizationId)
      )
    )
}

/**
 * Ecrit l'ordre du menu en **une** transaction : le rang de chaque entree vient
 * de sa position dans le tableau recu. Une seule fonction pour les deux chemins
 * de reordonnancement — la souris et le clavier lui passent le meme tableau,
 * donc produisent le meme resultat.
 */
export const reorderMenuItemsTxnDao = async (
  organizationId: string,
  orderedIds: string[]
): Promise<void> => {
  if (orderedIds.length === 0) return

  await getDb().transaction(async (tx) => {
    for (const [index, menuItemId] of orderedIds.entries()) {
      await tx
        .update(menuItem)
        .set({rank: index, updatedAt: new Date()})
        .where(
          and(
            eq(menuItem.id, menuItemId),
            eq(menuItem.organizationId, organizationId)
          )
        )
    }
  })
}

/** Ajoute une entree libre (s50) : libelle + adresse, sans page. */
export const addMenuLinkDao = async (input: {
  organizationId: string
  label: string
  address: string
  rank: number
}): Promise<MenuItemModel> => {
  const [row] = await getDb().insert(menuItem).values(input).returning()
  return row
}

/**
 * Modifie le libelle et l'adresse d'une entree **deja libre** : le filtre
 * `page_id is null` empeche de changer le type d'une entree de page
 * (ADR 078 §5). Rien de modifie = `undefined`.
 */
export const updateMenuLinkDao = async (
  organizationId: string,
  menuItemId: string,
  values: {label: string; address: string}
): Promise<MenuItemModel | undefined> => {
  const [row] = await getDb()
    .update(menuItem)
    .set({...values, updatedAt: new Date()})
    .where(
      and(
        eq(menuItem.id, menuItemId),
        eq(menuItem.organizationId, organizationId),
        isNull(menuItem.pageId)
      )
    )
    .returning()
  return row
}
