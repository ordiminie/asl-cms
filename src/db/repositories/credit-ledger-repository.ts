import {and, desc, eq, gt, isNull, or, sql} from 'drizzle-orm'

import {PaginatedResponse, Pagination} from '@/services/types/common-type'
import {
  CreateCreditEntry,
  CreditActivityItem,
  CreditEntry,
  CreditUsageDay,
} from '@/services/types/domain/credit-types'

import {creditLedger, CreditLedgerModel} from '../models/credit-ledger-model'
import db from '../models/db'

// ========================================
// BALANCE OPERATIONS
// ========================================

export const getBalanceDao = async (
  organizationId: string
): Promise<number> => {
  const result = await db
    .select({
      balance: sql<string>`COALESCE(SUM(${creditLedger.amount}), 0)`,
    })
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.organizationId, organizationId),
        or(
          isNull(creditLedger.expiresAt),
          gt(creditLedger.expiresAt, new Date())
        )
      )
    )

  return Number(result[0]?.balance ?? 0)
}

export const getUsedThisPeriodDao = async (
  organizationId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<number> => {
  // Calculate: consumed (negative usage) - refunded (positive refund)
  const result = await db
    .select({
      consumed: sql<string>`COALESCE(SUM(CASE WHEN ${creditLedger.source} = 'usage' AND ${creditLedger.amount} < 0 THEN ABS(${creditLedger.amount}) ELSE 0 END), 0)`,
      refunded: sql<string>`COALESCE(SUM(CASE WHEN ${creditLedger.source} = 'refund' THEN ${creditLedger.amount} ELSE 0 END), 0)`,
    })
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.organizationId, organizationId),
        sql`${creditLedger.createdAt} >= ${periodStart}`,
        sql`${creditLedger.createdAt} <= ${periodEnd}`
      )
    )

  const consumed = Number(result[0]?.consumed ?? 0)
  const refunded = Number(result[0]?.refunded ?? 0)
  return Math.max(0, consumed - refunded)
}

// ========================================
// CRUD OPERATIONS
// ========================================

export const createCreditEntryDao = async (
  entry: CreateCreditEntry
): Promise<CreditEntry> => {
  const [row] = await db.insert(creditLedger).values(entry).returning()
  return row
}

export const getCreditEntryByIdDao = async (
  id: string
): Promise<CreditEntry | undefined> => {
  const row = await db.query.creditLedger.findFirst({
    where: (credit, {eq}) => eq(credit.id, id),
  })
  return row
}

export const getCreditEntriesByOrganizationDao = async (
  organizationId: string,
  pagination: Pagination
): Promise<PaginatedResponse<CreditEntry>> => {
  const [rows, [{count}]] = await Promise.all([
    db
      .select()
      .from(creditLedger)
      .where(eq(creditLedger.organizationId, organizationId))
      .orderBy(desc(creditLedger.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db
      .select({count: sql<number>`count(*)`})
      .from(creditLedger)
      .where(eq(creditLedger.organizationId, organizationId)),
  ])

  const page = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = Math.ceil(count / pagination.limit)

  return {
    data: rows.length === 0 ? [] : rows,
    pagination: {
      total: count,
      page: page,
      limit: pagination.limit,
      totalPages: totalPages,
    },
  }
}

// ========================================
// USAGE GRAPH DATA
// ========================================

export const getDailyUsageDao = async (
  organizationId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<CreditUsageDay[]> => {
  // Calculate net usage per day: consumed - refunded
  const result = await db
    .select({
      day: sql<string>`TO_CHAR(${creditLedger.createdAt}, 'YYYY-MM-DD')`,
      consumed: sql<string>`COALESCE(SUM(CASE WHEN ${creditLedger.source} = 'usage' AND ${creditLedger.amount} < 0 THEN ABS(${creditLedger.amount}) ELSE 0 END), 0)`,
      refunded: sql<string>`COALESCE(SUM(CASE WHEN ${creditLedger.source} = 'refund' THEN ${creditLedger.amount} ELSE 0 END), 0)`,
    })
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.organizationId, organizationId),
        sql`(${creditLedger.source} = 'usage' OR ${creditLedger.source} = 'refund')`,
        sql`${creditLedger.createdAt} >= ${periodStart}`,
        sql`${creditLedger.createdAt} <= ${periodEnd}`
      )
    )
    .groupBy(sql`TO_CHAR(${creditLedger.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`TO_CHAR(${creditLedger.createdAt}, 'YYYY-MM-DD')`)

  return result.map((row) => ({
    day: row.day,
    creditsUsed: Math.max(0, Number(row.consumed) - Number(row.refunded)),
  }))
}

// ========================================
// RECENT ACTIVITY
// ========================================

export const getRecentActivityDao = async (
  organizationId: string,
  limit: number = 20
): Promise<CreditActivityItem[]> => {
  const rows = await db
    .select({
      id: creditLedger.id,
      amount: creditLedger.amount,
      source: creditLedger.source,
      reason: creditLedger.reason,
      createdAt: creditLedger.createdAt,
    })
    .from(creditLedger)
    .where(eq(creditLedger.organizationId, organizationId))
    .orderBy(desc(creditLedger.createdAt))
    .limit(limit)

  return rows.map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    source: row.source,
    reason: row.reason,
    createdAt: row.createdAt,
  }))
}

// ========================================
// TRANSACTIONAL OPERATIONS
// ========================================

export const consumeCreditsTxnDao = async (
  organizationId: string,
  amount: number,
  reason: string
): Promise<CreditEntry> => {
  return await db.transaction(async (tx) => {
    // Check balance within transaction
    const balanceResult = await tx
      .select({
        balance: sql<string>`COALESCE(SUM(${creditLedger.amount}), 0)`,
      })
      .from(creditLedger)
      .where(
        and(
          eq(creditLedger.organizationId, organizationId),
          or(
            isNull(creditLedger.expiresAt),
            gt(creditLedger.expiresAt, new Date())
          )
        )
      )

    const balance = Number(balanceResult[0]?.balance ?? 0)

    if (balance < amount) {
      throw new Error('Insufficient credits')
    }

    const [entry] = await tx
      .insert(creditLedger)
      .values({
        organizationId,
        amount: String(-Math.abs(amount)),
        source: 'usage',
        reason,
      })
      .returning()

    return entry
  })
}

export const allocateMonthlyCreditsTxnDao = async (params: {
  organizationId: string
  monthlyCredits: number
  overrideCredits?: number
  periodStart: Date
  periodEnd: Date
  sourceId?: string
}): Promise<CreditEntry[]> => {
  return await db.transaction(async (tx) => {
    const entries: CreditLedgerModel[] = []

    // Vérifier si une allocation existe déjà pour cette période (idempotence)
    const existingAllocation = await tx
      .select()
      .from(creditLedger)
      .where(
        and(
          eq(creditLedger.organizationId, params.organizationId),
          eq(creditLedger.source, 'plan'),
          eq(creditLedger.periodStart, params.periodStart)
        )
      )
      .limit(1)

    if (existingAllocation.length > 0) {
      // Allocation déjà effectuée pour cette période
      return existingAllocation
    }

    // Allocate plan credits
    if (params.monthlyCredits > 0) {
      const [planEntry] = await tx
        .insert(creditLedger)
        .values({
          organizationId: params.organizationId,
          amount: String(params.monthlyCredits),
          source: 'plan',
          sourceId: params.sourceId,
          reason: 'Monthly plan allocation',
          periodStart: params.periodStart,
          periodEnd: params.periodEnd,
          expiresAt: params.periodEnd,
        })
        .returning()
      entries.push(planEntry)
    }

    // Allocate override credits if any
    if (params.overrideCredits && params.overrideCredits > 0) {
      const [overrideEntry] = await tx
        .insert(creditLedger)
        .values({
          organizationId: params.organizationId,
          amount: String(params.overrideCredits),
          source: 'admin_grant',
          reason: 'Monthly override allocation',
          periodStart: params.periodStart,
          periodEnd: params.periodEnd,
          expiresAt: params.periodEnd,
        })
        .returning()
      entries.push(overrideEntry)
    }

    return entries
  })
}

export const grantCreditsTxnDao = async (params: {
  organizationId: string
  amount: number
  reason?: string
  expiresAt?: Date | null
}): Promise<CreditEntry> => {
  const [entry] = await db
    .insert(creditLedger)
    .values({
      organizationId: params.organizationId,
      amount: String(params.amount),
      source: 'admin_grant',
      reason: params.reason ?? 'Admin credit grant',
      expiresAt: params.expiresAt ?? undefined,
    })
    .returning()

  return entry
}

export const addPackCreditsTxnDao = async (params: {
  organizationId: string
  amount: number
  sourceId: string
  expiresAt?: Date | null
}): Promise<CreditEntry> => {
  const [entry] = await db
    .insert(creditLedger)
    .values({
      organizationId: params.organizationId,
      amount: String(params.amount),
      source: 'pack',
      sourceId: params.sourceId,
      reason: `Credit pack purchase (${params.amount} credits)`,
      expiresAt: params.expiresAt ?? undefined,
    })
    .returning()

  return entry
}

export const refundCreditsTxnDao = async (params: {
  organizationId: string
  amount: number
  reason: string
}): Promise<CreditEntry> => {
  const [entry] = await db
    .insert(creditLedger)
    .values({
      organizationId: params.organizationId,
      amount: String(params.amount),
      source: 'refund',
      reason: params.reason,
    })
    .returning()

  return entry
}

// ========================================
// ADMIN OPERATIONS
// ========================================

export const getAllOrganizationsCreditsDao = async (
  pagination: Pagination,
  search?: string
): Promise<
  PaginatedResponse<{
    organizationId: string
    balance: number
    totalAllocated: number
    totalUsed: number
  }>
> => {
  let searchCondition = undefined
  if (search && search.trim()) {
    searchCondition = sql`${creditLedger.organizationId}::text ILIKE ${`%${search.trim()}%`}`
  }

  const baseQuery = db
    .select({
      organizationId: creditLedger.organizationId,
      balance: sql<string>`COALESCE(SUM(CASE WHEN ${creditLedger.expiresAt} IS NULL OR ${creditLedger.expiresAt} > NOW() THEN ${creditLedger.amount} ELSE 0 END), 0)`,
      totalAllocated: sql<string>`COALESCE(SUM(CASE WHEN ${creditLedger.amount} > 0 THEN ${creditLedger.amount} ELSE 0 END), 0)`,
      totalUsed: sql<string>`COALESCE(SUM(CASE WHEN ${creditLedger.amount} < 0 THEN ABS(${creditLedger.amount}) ELSE 0 END), 0)`,
    })
    .from(creditLedger)
    .where(searchCondition)
    .groupBy(creditLedger.organizationId)

  const countQuery = db
    .selectDistinct({organizationId: creditLedger.organizationId})
    .from(creditLedger)
    .where(searchCondition)

  const [rows, countResult] = await Promise.all([
    baseQuery.limit(pagination.limit).offset(pagination.offset),
    countQuery,
  ])

  const count = countResult.length
  const page = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = Math.ceil(count / pagination.limit)

  return {
    data: rows.map((row) => ({
      organizationId: row.organizationId,
      balance: Number(row.balance),
      totalAllocated: Number(row.totalAllocated),
      totalUsed: Number(row.totalUsed),
    })),
    pagination: {
      total: count,
      page,
      limit: pagination.limit,
      totalPages,
    },
  }
}
