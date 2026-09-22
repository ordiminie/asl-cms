import {and, count, desc, eq} from 'drizzle-orm'

import {news, NewsModel} from '@/db/models/news-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Actualites d'une association (s05, ADR 023). Sous RLS forcee : hors
 * `withTenant(organizationId, ...)`, rien ne sort et rien ne s'ecrit.
 */

export type NewsPageRows = {rows: NewsModel[]; total: number}

/**
 * Tri public et du bureau : date decroissante, puis creation decroissante,
 * puis identifiant — un departage stable, pour que la pagination ne saute ni
 * ne repete une ligne.
 */
const NEWS_ORDER = [
  desc(news.publishedOn),
  desc(news.createdAt),
  desc(news.id),
] as const

export const createNewsDao = async (input: {
  organizationId: string
  publishedOn: string
}): Promise<NewsModel> => {
  const [row] = await getDb().insert(news).values(input).returning()
  return row
}

export const getNewsByIdDao = async (
  newsId: string
): Promise<NewsModel | undefined> => {
  const [row] = await getDb().select().from(news).where(eq(news.id, newsId))
  return row
}

export const getNewsBySlugDao = async (
  organizationId: string,
  slug: string
): Promise<NewsModel | undefined> => {
  const [row] = await getDb()
    .select()
    .from(news)
    .where(and(eq(news.organizationId, organizationId), eq(news.slug, slug)))
  return row
}

export const isNewsSlugTakenDao = async (
  organizationId: string,
  slug: string
): Promise<boolean> => {
  const [row] = await getDb()
    .select({id: news.id})
    .from(news)
    .where(and(eq(news.organizationId, organizationId), eq(news.slug, slug)))
    .limit(1)
  return Boolean(row)
}

export const updateNewsDao = async (
  newsId: string,
  input: {
    title: string
    publishedOn: string
    content: string
    imageAlt: string
    slug?: string
    imageKey?: null
  }
): Promise<NewsModel> => {
  const [row] = await getDb()
    .update(news)
    .set({...input, updatedAt: new Date()})
    .where(eq(news.id, newsId))
    .returning()
  return row
}

export const updateNewsStatusDao = async (
  newsId: string,
  status: NewsModel['status']
): Promise<NewsModel> => {
  const [row] = await getDb()
    .update(news)
    .set({status, updatedAt: new Date()})
    .where(eq(news.id, newsId))
    .returning()
  return row
}

export const updateNewsImageDao = async (
  newsId: string,
  imageKey: string
): Promise<NewsModel> => {
  const [row] = await getDb()
    .update(news)
    .set({imageKey, updatedAt: new Date()})
    .where(eq(news.id, newsId))
    .returning()
  return row
}

const getNewsPageDao = async (
  where: ReturnType<typeof and>,
  limit: number,
  offset: number
): Promise<NewsPageRows> => {
  const [rows, [{total}]] = await Promise.all([
    getDb()
      .select()
      .from(news)
      .where(where)
      .orderBy(...NEWS_ORDER)
      .limit(limit)
      .offset(offset),
    getDb().select({total: count()}).from(news).where(where),
  ])
  return {rows, total}
}

/** Liste du bureau : tous les statuts. */
export const getNewsPageByOrganizationDao = async (input: {
  organizationId: string
  limit: number
  offset: number
}): Promise<NewsPageRows> =>
  getNewsPageDao(
    and(eq(news.organizationId, input.organizationId)),
    input.limit,
    input.offset
  )

/** Liste publique : les actualites **publiees** seulement. */
export const getPublishedNewsPageDao = async (input: {
  organizationId: string
  limit: number
  offset: number
}): Promise<NewsPageRows> =>
  getNewsPageDao(
    and(
      eq(news.organizationId, input.organizationId),
      eq(news.status, 'published')
    ),
    input.limit,
    input.offset
  )
