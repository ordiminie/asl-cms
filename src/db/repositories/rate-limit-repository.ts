import {and, eq, lt, sql} from 'drizzle-orm'

import {rateLimitEvent} from '@/db/models/rate-limit-model'
import {getDb} from '@/db/tenant-scope'

export type RateLimitCounterKey = {
  organizationId: string
  fingerprint: string
  /** Jour du compteur, `YYYY-MM-DD`. */
  day: string
}

/**
 * Compte une demande et rend le total du jour, **en une seule requete** :
 * insertion du compteur a 1, ou incrément s'il existe deja. Deux demandes
 * simultanees ne peuvent pas lire le meme total. Sous RLS forcee : a appeler
 * dans `withTenant(organizationId, ...)`.
 */
export const incrementRateLimitCounterDao = async ({
  organizationId,
  fingerprint,
  day,
}: RateLimitCounterKey): Promise<number> => {
  const [row] = await getDb()
    .insert(rateLimitEvent)
    .values({organizationId, fingerprint, day, count: 1})
    .onConflictDoUpdate({
      target: [
        rateLimitEvent.organizationId,
        rateLimitEvent.fingerprint,
        rateLimitEvent.day,
      ],
      set: {count: sql`${rateLimitEvent.count} + 1`},
    })
    .returning({count: rateLimitEvent.count})
  return row.count
}

/** Supprime les compteurs des jours anterieurs a `today` (`YYYY-MM-DD`). */
export const purgeRateLimitCountersDao = async (
  organizationId: string,
  today: string
): Promise<void> => {
  await getDb()
    .delete(rateLimitEvent)
    .where(
      and(
        eq(rateLimitEvent.organizationId, organizationId),
        lt(rateLimitEvent.day, today)
      )
    )
}
