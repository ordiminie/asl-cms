'use server'

import {
  type DocsStructure,
  getDocsStructure,
} from '@/lib/files/docs-file-helper'
import {searchDocs, type SearchResult} from '@/lib/files/search'

export async function getDocsStructureAction(
  locale: string = 'en'
): Promise<DocsStructure> {
  return getDocsStructure(locale)
}

export async function searchDocsAction(
  query: string,
  locale: string = 'en'
): Promise<SearchResult[]> {
  return searchDocs(query, locale)
}
