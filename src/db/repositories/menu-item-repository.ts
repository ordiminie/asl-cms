import {and, asc, eq} from 'drizzle-orm'

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
  pageId: string
  rank: number
  visible: boolean
  pageTitle: string
  pageSlug: string
  pageStatus: PageModel['status']
}

/**
 * Le menu d'une association, dans son ordre, joint a `page` pour le titre et le
 * statut : l'ecran de gestion affiche les deux, et le rendu public a besoin du
 * statut pour omettre une entree dont la page n'est plus publiee (critere 2).
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
    })
    .from(menuItem)
    .innerJoin(page, eq(menuItem.pageId, page.id))
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
