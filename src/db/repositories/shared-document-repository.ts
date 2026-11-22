import {asc, count, desc, eq} from 'drizzle-orm'

import {associationCategory} from '@/db/models/association-category-model'
import {
  sharedDocument,
  SharedDocumentModel,
} from '@/db/models/shared-document-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Documents partages d'une association (s31, ADR 069). Sous RLS forcee : hors
 * `withTenant(organizationId, ...)`, rien ne sort et rien ne s'ecrit.
 */

/** Un document et le nom de sa categorie, meme supprimee logiquement. */
export type SharedDocumentRow = SharedDocumentModel & {categoryName: string}

/** Ordre de l'espace membre (par categorie) ou du bureau (par date). */
export type SharedDocumentListOrder = 'category' | 'recent'

const SHARED_DOCUMENT_ORDER: Record<
  SharedDocumentListOrder,
  ReturnType<typeof asc>[]
> = {
  category: [
    asc(associationCategory.name),
    desc(sharedDocument.createdAt),
    desc(sharedDocument.id),
  ],
  recent: [desc(sharedDocument.createdAt), desc(sharedDocument.id)],
}

/**
 * Insere un document **avec son identifiant**, genere par le service avant
 * l'ecriture du fichier : il entre dans sa cle de stockage (ADR 069).
 */
export const createSharedDocumentDao = async (input: {
  id: string
  organizationId: string
  title: string
  categoryId: string
  fileKey: string
  fileBytes: number
}): Promise<SharedDocumentModel> => {
  const [row] = await getDb().insert(sharedDocument).values(input).returning()
  return row
}

export const getSharedDocumentByIdDao = async (
  documentId: string
): Promise<SharedDocumentModel | undefined> => {
  const [row] = await getDb()
    .select()
    .from(sharedDocument)
    .where(eq(sharedDocument.id, documentId))
  return row
}

/**
 * Les documents de l'association, avec le nom de leur categorie — lu par
 * jointure, garde meme si la categorie a ete supprimee (suppression logique).
 */
export const listSharedDocumentsDao = async (
  organizationId: string,
  order: SharedDocumentListOrder
): Promise<SharedDocumentRow[]> =>
  getDb()
    .select({
      id: sharedDocument.id,
      organizationId: sharedDocument.organizationId,
      title: sharedDocument.title,
      categoryId: sharedDocument.categoryId,
      fileKey: sharedDocument.fileKey,
      fileBytes: sharedDocument.fileBytes,
      createdAt: sharedDocument.createdAt,
      categoryName: associationCategory.name,
    })
    .from(sharedDocument)
    .innerJoin(
      associationCategory,
      eq(sharedDocument.categoryId, associationCategory.id)
    )
    .where(eq(sharedDocument.organizationId, organizationId))
    .orderBy(...SHARED_DOCUMENT_ORDER[order])

/** Supprime la ligne et la rend, ou rien si elle n'existe pas. */
export const deleteSharedDocumentDao = async (
  documentId: string
): Promise<SharedDocumentModel | undefined> => {
  const [row] = await getDb()
    .delete(sharedDocument)
    .where(eq(sharedDocument.id, documentId))
    .returning()
  return row
}

/** Combien de documents portent chaque categorie de l'association. */
export const countSharedDocumentsByCategoryDao = async (
  organizationId: string
): Promise<Record<string, number>> => {
  const rows = await getDb()
    .select({categoryId: sharedDocument.categoryId, total: count()})
    .from(sharedDocument)
    .where(eq(sharedDocument.organizationId, organizationId))
    .groupBy(sharedDocument.categoryId)
  return Object.fromEntries(rows.map((row) => [row.categoryId, row.total]))
}
