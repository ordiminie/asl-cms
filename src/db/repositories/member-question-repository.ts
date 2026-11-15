import {count, desc, eq, getTableColumns} from 'drizzle-orm'

import {associationCategory} from '@/db/models/association-category-model'
import {memberProfile} from '@/db/models/member-profile-model'
import {
  memberQuestion,
  MemberQuestionModel,
} from '@/db/models/member-question-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Questions posees par un membre au bureau (s23). Sous RLS forcee : hors
 * `withTenant(organizationId, ...)`, rien ne sort et rien ne s'ecrit.
 */

/**
 * Une question lue avec son sujet, **supprime compris** (critere 5), et
 * l'identite du membre lue sur sa fiche (une seule source, critere 4).
 */
export type MemberQuestionRow = MemberQuestionModel & {
  categoryName: string
  categoryDeletedAt: Date | null
  memberName: string
  memberEmail: string | null
}

export type MemberQuestionPageRows = {
  rows: MemberQuestionRow[]
  total: number
}

/** Le plus recent d'abord, puis l'identifiant : un departage stable. */
const MEMBER_QUESTION_ORDER = [
  desc(memberQuestion.createdAt),
  desc(memberQuestion.id),
] as const

const selectQuestionWithCategoryAndMember = () =>
  getDb()
    .select({
      ...getTableColumns(memberQuestion),
      categoryName: associationCategory.name,
      categoryDeletedAt: associationCategory.deletedAt,
      memberName: memberProfile.name,
      memberEmail: memberProfile.email,
    })
    .from(memberQuestion)
    .innerJoin(
      associationCategory,
      eq(memberQuestion.categoryId, associationCategory.id)
    )
    .innerJoin(memberProfile, eq(memberQuestion.memberId, memberProfile.id))

/** Ecrit la question : la fiche et le sujet, jamais une identite copiee. */
export const createMemberQuestionDao = async (
  input: Pick<
    MemberQuestionModel,
    'organizationId' | 'memberId' | 'categoryId' | 'body'
  >
): Promise<MemberQuestionModel> => {
  const [row] = await getDb().insert(memberQuestion).values(input).returning()
  return row
}

export const getMemberQuestionsPageDao = async (
  organizationId: string,
  page: number,
  pageSize: number
): Promise<MemberQuestionPageRows> => {
  const where = eq(memberQuestion.organizationId, organizationId)
  const [rows, [{total}]] = await Promise.all([
    selectQuestionWithCategoryAndMember()
      .where(where)
      .orderBy(...MEMBER_QUESTION_ORDER)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    getDb().select({total: count()}).from(memberQuestion).where(where),
  ])
  return {rows, total}
}

export const getMemberQuestionByIdDao = async (
  questionId: string
): Promise<MemberQuestionRow | undefined> => {
  const [row] = await selectQuestionWithCategoryAndMember().where(
    eq(memberQuestion.id, questionId)
  )
  return row
}

/**
 * Combien de questions chaque sujet porte, supprimes compris : le bureau lit,
 * avant de supprimer un sujet, combien de questions seront conservees.
 */
export const countMemberQuestionsByCategoryDao = async (
  organizationId: string
): Promise<Record<string, number>> => {
  const rows = await getDb()
    .select({categoryId: memberQuestion.categoryId, total: count()})
    .from(memberQuestion)
    .where(eq(memberQuestion.organizationId, organizationId))
    .groupBy(memberQuestion.categoryId)
  return Object.fromEntries(rows.map((row) => [row.categoryId, row.total]))
}

export const markMemberQuestionNotificationFailedDao = async (
  questionId: string
): Promise<void> => {
  await getDb()
    .update(memberQuestion)
    .set({notificationFailed: true})
    .where(eq(memberQuestion.id, questionId))
}
