'use server'

import {
  DOCS_CONTENT_LOCALE,
  type DocsStructure,
  getDocsStructure,
} from '@/lib/files/docs-file-helper'
import {searchDocs, type SearchResult} from '@/lib/files/search'

export async function getDocsStructureAction(): Promise<DocsStructure> {
  return getDocsStructure(DOCS_CONTENT_LOCALE)
}

export async function searchDocsAction(query: string): Promise<SearchResult[]> {
  return searchDocs(query, DOCS_CONTENT_LOCALE)
}
