import {and, count, desc, eq, ilike, or, sql} from 'drizzle-orm'

import db from '@/db/models/db'
import {
  AddUserSubmissionModel,
  UserSubmissionModel,
  userSubmissions,
} from '@/db/models/user-submission-model'
import {PaginatedResponse, Pagination} from '@/services/types/common-type'
import {
  UserSubmissionFilters,
  UserSubmissionWithUser,
} from '@/services/types/domain/user-submission-types'

export const createUserSubmissionDao = async (
  data: AddUserSubmissionModel
): Promise<UserSubmissionModel> => {
  const row = await db.insert(userSubmissions).values(data).returning()
  return row[0]
}

export const getUserSubmissionByIdDao = async (
  id: string
): Promise<UserSubmissionWithUser | undefined> => {
  const row = await db.query.userSubmissions.findFirst({
    where: (userSubmissions, {eq}) => eq(userSubmissions.id, id),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  })
  return row as UserSubmissionWithUser | undefined
}

export const getAllUserSubmissionsWithPaginationDao = async (
  pagination: Pagination,
  filters?: UserSubmissionFilters
): Promise<PaginatedResponse<UserSubmissionWithUser>> => {
  const {limit, offset} = pagination

  const conditions = []

  if (filters?.type) {
    conditions.push(eq(userSubmissions.type, filters.type))
  }

  if (filters?.read !== undefined) {
    conditions.push(eq(userSubmissions.read, filters.read))
  }

  if (filters?.archived !== undefined) {
    conditions.push(eq(userSubmissions.archived, filters.archived))
  } else {
    conditions.push(eq(userSubmissions.archived, false))
  }

  if (filters?.search) {
    conditions.push(
      or(
        ilike(userSubmissions.subject, `%${filters.search}%`),
        ilike(userSubmissions.message, `%${filters.search}%`)
      )
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db.query.userSubmissions.findMany({
    where: whereClause,
    orderBy: [desc(userSubmissions.createdAt)],
    limit,
    offset,
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  })

  const [totalResult] = await db
    .select({count: count()})
    .from(userSubmissions)
    .where(whereClause)

  const total = totalResult.count
  const page = Math.floor(offset / limit) + 1
  const totalPages = Math.ceil(total / limit)

  return {
    data: rows as UserSubmissionWithUser[],
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
  }
}

export const getUnreadSubmissionsCountDao = async (): Promise<number> => {
  const [result] = await db
    .select({count: count()})
    .from(userSubmissions)
    .where(
      and(eq(userSubmissions.read, false), eq(userSubmissions.archived, false))
    )

  return result.count
}

export const markUserSubmissionAsReadDao = async (
  id: string
): Promise<UserSubmissionModel | undefined> => {
  const row = await db
    .update(userSubmissions)
    .set({read: true, updatedAt: sql`now()`})
    .where(eq(userSubmissions.id, id))
    .returning()

  return row[0]
}

export const archiveUserSubmissionDao = async (
  id: string
): Promise<UserSubmissionModel | undefined> => {
  const row = await db
    .update(userSubmissions)
    .set({archived: true, updatedAt: sql`now()`})
    .where(eq(userSubmissions.id, id))
    .returning()

  return row[0]
}
