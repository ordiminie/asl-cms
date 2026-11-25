import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  SQL,
  sql,
} from 'drizzle-orm'

import {associationCategory} from '@/db/models/association-category-model'
import {
  memberDocument,
  MemberDocumentModel,
} from '@/db/models/member-document-model'
import {memberProfile} from '@/db/models/member-profile-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Documents nominatifs des fiches (s32, ADR 073). Sous RLS forcee : hors
 * `withTenant(organizationId, ...)`, rien ne sort et rien ne s'ecrit.
 */

/** Un document et le nom de sa categorie, meme supprimee logiquement. */
export type MemberDocumentRow = MemberDocumentModel & {categoryName: string}

/** Un document de la vue d'ensemble du bureau, avec le nom de sa fiche. */
export type BureauMemberDocumentRow = MemberDocumentRow & {
  memberProfileName: string
}

const documentColumns = () => ({
  id: memberDocument.id,
  organizationId: memberDocument.organizationId,
  memberProfileId: memberDocument.memberProfileId,
  title: memberDocument.title,
  categoryId: memberDocument.categoryId,
  documentDate: memberDocument.documentDate,
  fileKey: memberDocument.fileKey,
  fileBytes: memberDocument.fileBytes,
  createdAt: memberDocument.createdAt,
  categoryName: associationCategory.name,
})

const BY_DOCUMENT_DATE = [
  desc(memberDocument.documentDate),
  desc(memberDocument.createdAt),
  desc(memberDocument.id),
]

/** Neutralise les jokers de `LIKE` dans un texte saisi. */
const escapeLike = (value: string): string =>
  value.replace(/[\\%_]/g, (char) => `\\${char}`)

/**
 * Insere un document **avec son identifiant**, genere par le service avant
 * l'ecriture du fichier : il entre dans sa cle de stockage (ADR 073 §2).
 */
export const createMemberDocumentDao = async (input: {
  id: string
  organizationId: string
  memberProfileId: string
  title: string
  categoryId: string
  documentDate: string
  fileKey: string
  fileBytes: number
}): Promise<MemberDocumentModel> => {
  const [row] = await getDb().insert(memberDocument).values(input).returning()
  return row
}

export const getMemberDocumentByIdDao = async (
  documentId: string
): Promise<MemberDocumentModel | undefined> => {
  const [row] = await getDb()
    .select()
    .from(memberDocument)
    .where(eq(memberDocument.id, documentId))
  return row
}

/**
 * Les documents des fiches d'un compte (critere 3), du plus recent au plus
 * ancien par date du document. Aucune fiche : aucune requete.
 */
export const listMemberDocumentsByProfilesDao = async (
  memberProfileIds: string[]
): Promise<MemberDocumentRow[]> => {
  if (memberProfileIds.length === 0) return []

  return getDb()
    .select(documentColumns())
    .from(memberDocument)
    .innerJoin(
      associationCategory,
      eq(memberDocument.categoryId, associationCategory.id)
    )
    .where(inArray(memberDocument.memberProfileId, memberProfileIds))
    .orderBy(...BY_DOCUMENT_DATE)
}

/** Les documents d'une fiche, pour sa section du back-office. */
export const listMemberDocumentsByProfileDao = async (
  memberProfileId: string
): Promise<MemberDocumentRow[]> =>
  getDb()
    .select(documentColumns())
    .from(memberDocument)
    .innerJoin(
      associationCategory,
      eq(memberDocument.categoryId, associationCategory.id)
    )
    .where(eq(memberDocument.memberProfileId, memberProfileId))
    .orderBy(...BY_DOCUMENT_DATE)

/**
 * Tous les documents nominatifs de l'association (critere 6), du dernier
 * depose au premier, filtres par nom de fiche et par categorie, pagines cote
 * serveur.
 */
export const listMemberDocumentsForBureauDao = async (
  organizationId: string,
  filters: {
    search?: string
    categoryId?: string
    page: number
    pageSize: number
  }
): Promise<{rows: BureauMemberDocumentRow[]; total: number}> => {
  const conditions: SQL[] = [eq(memberDocument.organizationId, organizationId)]
  if (filters.search) {
    conditions.push(
      ilike(memberProfile.name, `%${escapeLike(filters.search)}%`)
    )
  }
  if (filters.categoryId) {
    conditions.push(eq(memberDocument.categoryId, filters.categoryId))
  }
  const where = and(...conditions)

  const rows = await getDb()
    .select({...documentColumns(), memberProfileName: memberProfile.name})
    .from(memberDocument)
    .innerJoin(
      memberProfile,
      eq(memberDocument.memberProfileId, memberProfile.id)
    )
    .innerJoin(
      associationCategory,
      eq(memberDocument.categoryId, associationCategory.id)
    )
    .where(where)
    .orderBy(desc(memberDocument.createdAt), desc(memberDocument.id))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize)

  const [totalRow] = await getDb()
    .select({total: count()})
    .from(memberDocument)
    .innerJoin(
      memberProfile,
      eq(memberDocument.memberProfileId, memberProfile.id)
    )
    .where(where)

  return {rows, total: Number(totalRow?.total ?? 0)}
}

/** Combien de documents portent chaque categorie de l'association. */
export const countMemberDocumentsByCategoryDao = async (
  organizationId: string
): Promise<Record<string, number>> => {
  const rows = await getDb()
    .select({categoryId: memberDocument.categoryId, total: count()})
    .from(memberDocument)
    .where(eq(memberDocument.organizationId, organizationId))
    .groupBy(memberDocument.categoryId)
  return Object.fromEntries(rows.map((row) => [row.categoryId, row.total]))
}

/** Supprime la ligne et la rend, ou rien si elle n'existe pas. */
export const deleteMemberDocumentDao = async (
  documentId: string
): Promise<MemberDocumentModel | undefined> => {
  const [row] = await getDb()
    .delete(memberDocument)
    .where(eq(memberDocument.id, documentId))
    .returning()
  return row
}

/**
 * La fiche de l'association dont l'identifiant client Pennylane est
 * **exactement** cette reference, sans casse (ADR 073 §8). Rien sans
 * correspondance, et rien si deux fiches se la disputaient : un lot ne
 * rattache jamais un document a une fiche par defaut.
 */
export const getMemberProfileIdByPennylaneReferenceDao = async (
  organizationId: string,
  reference: string
): Promise<string | undefined> => {
  const rows = await getDb()
    .select({id: memberProfile.id})
    .from(memberProfile)
    .where(
      and(
        eq(memberProfile.organizationId, organizationId),
        sql`lower(${memberProfile.pennylaneCustomerId}) = lower(${reference})`
      )
    )
    .limit(2)
  return rows.length === 1 ? rows[0].id : undefined
}

/** Combien de fiches de l'association un lot ne peut atteindre. */
export const countMemberProfilesWithoutReferenceDao = async (
  organizationId: string
): Promise<number> => {
  const [row] = await getDb()
    .select({total: count()})
    .from(memberProfile)
    .where(
      and(
        eq(memberProfile.organizationId, organizationId),
        isNull(memberProfile.pennylaneCustomerId)
      )
    )
  return Number(row?.total ?? 0)
}
