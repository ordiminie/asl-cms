import {and, count, eq, gte, lt} from 'drizzle-orm'

import {
  AddRateLimitEventModel,
  rateLimitEvent,
} from '@/db/models/rate-limit-model'
import {getDb} from '@/db/tenant-scope'

export type CountRateLimitEvents = {
  organizationId: string
  bucket: string
  fingerprint: string
  since: Date
}

/**
 * Demandes comptees depuis `since` pour une empreinte. Sous RLS forcee : a
 * appeler dans `withTenant(organizationId, ...)`.
 */
export const countRateLimitEventsDao = async ({
  organizationId,
  bucket,
  fingerprint,
  since,
}: CountRateLimitEvents): Promise<number> => {
  const [row] = await getDb()
    .select({total: count()})
    .from(rateLimitEvent)
    .where(
      and(
        eq(rateLimitEvent.organizationId, organizationId),
        eq(rateLimitEvent.bucket, bucket),
        eq(rateLimitEvent.fingerprint, fingerprint),
        gte(rateLimitEvent.createdAt, since)
      )
    )
  return row?.total ?? 0
}

export const addRateLimitEventsDao = async (
  rows: AddRateLimitEventModel[]
): Promise<void> => {
  if (rows.length === 0) return
  await getDb().insert(rateLimitEvent).values(rows)
}

/** Supprime les demandes anterieures a `before` (retention de 24 h). */
export const purgeRateLimitEventsDao = async (
  organizationId: string,
  before: Date
): Promise<void> => {
  await getDb()
    .delete(rateLimitEvent)
    .where(
      and(
        eq(rateLimitEvent.organizationId, organizationId),
        lt(rateLimitEvent.createdAt, before)
      )
    )
}
