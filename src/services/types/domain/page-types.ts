import {PageModel} from '@/db/models/page-model'

import {PageBlockPublicationIssue} from './page-block-types'

/**
 * Types de domaine des pages CMS (s04). La presentation ne connait que ceux-ci,
 * jamais les modeles Drizzle.
 */

export type Page = PageModel
export type PageStatus = Page['status']

export type PageBlockDTO = {
  id: string
  type: string
  rank: number
  data: unknown
}

export type PageDTO = {
  id: string
  organizationId: string
  slug: string
  title: string
  status: PageStatus
  createdAt: Date
  updatedAt: Date
}

export type PageWithBlocksDTO = PageDTO & {blocks: PageBlockDTO[]}

/**
 * Un slug refuse l'est toujours pour la meme raison affichee (ADR 020) : deja
 * pris dans cette association, ou reserve par une route du socle. Le bureau
 * n'a pas a distinguer les deux, il doit juste en choisir un autre.
 */
export const PAGE_SLUG_UNAVAILABLE = 'slug_unavailable' as const

export type PageMutationResult =
  | {status: 'saved'; page: PageWithBlocksDTO}
  | {status: 'rejected'; error: typeof PAGE_SLUG_UNAVAILABLE}

export type PagePublicationResult =
  | {status: 'published'; page: PageDTO}
  | {status: 'rejected'; issues: PageBlockPublicationIssue[]}

export type PageUnpublicationResult = {status: 'unpublished'; page: PageDTO}
