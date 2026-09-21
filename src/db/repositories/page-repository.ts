import {and, asc, desc, eq, notInArray} from 'drizzle-orm'

import {contentBlock, ContentBlockModel} from '@/db/models/content-block-model'
import {page, PageModel} from '@/db/models/page-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Pages et blocs d'une association. Sous RLS forcee : hors
 * `withTenant(organizationId, ...)`, rien ne sort et rien ne s'ecrit.
 */

export type PageBlockRow = {
  id: string
  type: string
  rank: number
  data: unknown
}

export type PageWithBlocksRow = PageModel & {blocks: PageBlockRow[]}

export type ReorderedPageBlock = {
  id?: string
  type: string
  rank: number
  data: unknown
}

const toBlockRow = (row: ContentBlockModel): PageBlockRow => ({
  id: row.id,
  type: row.type,
  rank: row.rank,
  data: row.data,
})

const getPageBlocksDao = async (pageId: string): Promise<PageBlockRow[]> => {
  const rows = await getDb()
    .select()
    .from(contentBlock)
    .where(eq(contentBlock.pageId, pageId))
    .orderBy(asc(contentBlock.rank))

  return rows.map((row) => toBlockRow(row))
}

export const getPagesByOrganizationDao = async (
  organizationId: string
): Promise<PageModel[]> =>
  getDb()
    .select()
    .from(page)
    .where(eq(page.organizationId, organizationId))
    .orderBy(desc(page.updatedAt))

export const getPageByIdDao = async (
  pageId: string
): Promise<PageWithBlocksRow | undefined> => {
  const [row] = await getDb().select().from(page).where(eq(page.id, pageId))
  if (!row) return undefined

  return {...row, blocks: await getPageBlocksDao(row.id)}
}

export const getPageBySlugDao = async (
  organizationId: string,
  slug: string
): Promise<PageWithBlocksRow | undefined> => {
  const [row] = await getDb()
    .select()
    .from(page)
    .where(and(eq(page.organizationId, organizationId), eq(page.slug, slug)))
  if (!row) return undefined

  return {...row, blocks: await getPageBlocksDao(row.id)}
}

export const createPageDao = async (input: {
  organizationId: string
  slug: string
  title: string
}): Promise<PageModel> => {
  const [row] = await getDb().insert(page).values(input).returning()
  return row
}

export const updatePageDao = async (
  pageId: string,
  input: {slug: string; title: string}
): Promise<PageModel> => {
  const [row] = await getDb()
    .update(page)
    .set({...input, updatedAt: new Date()})
    .where(eq(page.id, pageId))
    .returning()
  return row
}

export const updatePageStatusDao = async (
  pageId: string,
  status: PageModel['status']
): Promise<PageModel> => {
  const [row] = await getDb()
    .update(page)
    .set({status, updatedAt: new Date()})
    .where(eq(page.id, pageId))
    .returning()
  return row
}

/**
 * Ecrit la liste ordonnee des blocs d'une page en **une** transaction :
 * suppression des blocs retires, mise a jour de ceux qui restent, insertion des
 * nouveaux. Une seule fonction pour les deux chemins de reordonnancement — la
 * souris et le clavier lui passent le meme tableau, donc produisent le meme
 * resultat (critere 8, par construction).
 */
export const reorderPageBlocksTxnDao = async (
  pageId: string,
  blocks: ReorderedPageBlock[]
): Promise<PageBlockRow[]> =>
  getDb().transaction(async (tx) => {
    const keptIds = blocks
      .map((block) => block.id)
      .filter((id): id is string => Boolean(id))

    await (keptIds.length === 0
      ? tx.delete(contentBlock).where(eq(contentBlock.pageId, pageId))
      : tx
          .delete(contentBlock)
          .where(
            and(
              eq(contentBlock.pageId, pageId),
              notInArray(contentBlock.id, keptIds)
            )
          ))

    for (const block of blocks) {
      const values = {
        type: block.type,
        rank: block.rank,
        data: block.data as Record<string, unknown>,
      }

      await (block.id
        ? tx
            .update(contentBlock)
            .set(values)
            .where(
              and(
                eq(contentBlock.id, block.id),
                eq(contentBlock.pageId, pageId)
              )
            )
        : tx.insert(contentBlock).values({pageId, ...values}))
    }

    const rows = await tx
      .select()
      .from(contentBlock)
      .where(eq(contentBlock.pageId, pageId))
      .orderBy(asc(contentBlock.rank))

    return rows.map((row) => toBlockRow(row))
  })
