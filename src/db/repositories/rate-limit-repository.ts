import {and, eq, lt, sql} from 'drizzle-orm'

import {rateLimitEvent} from '@/db/models/rate-limit-model'
import {getDb} from '@/db/tenant-scope'

export type RateLimitCounterKey = {
  organizationId: string
  fingerprint: string
  /** Debut de la fenetre du compteur (debut du jour, de l'heure...). */
  windowStart: Date
}

/**
 * Compte un evenement et rend le total de la fenetre, **en une seule
 * requete** : insertion du compteur a 1, ou incrément s'il existe deja. Deux
 * evenements simultanes ne peuvent pas lire le meme total. Sous RLS forcee : a
 * appeler dans `withTenant(organizationId, ...)`.
 */
export const incrementRateLimitCounterDao = async ({
  organizationId,
  fingerprint,
  windowStart,
}: RateLimitCounterKey): Promise<number> => {
  const [row] = await getDb()
    .insert(rateLimitEvent)
    .values({organizationId, fingerprint, windowStart, count: 1})
    .onConflictDoUpdate({
      target: [
        rateLimitEvent.organizationId,
        rateLimitEvent.fingerprint,
        rateLimitEvent.windowStart,
      ],
      set: {count: sql`${rateLimitEvent.count} + 1`},
    })
    .returning({count: rateLimitEvent.count})
  return row.count
}

/**
 * Supprime les compteurs de l'association dont la fenetre commence avant
 * `cutoff`, et rend leur nombre. Sous RLS forcee : a appeler dans
 * `withTenant(organizationId, ...)`, sans quoi rien n'est supprime — et rien
 * n'est leve.
 */
export const purgeRateLimitCountersDao = async (
  organizationId: string,
  cutoff: Date
): Promise<number> => {
  const deleted = await getDb()
    .delete(rateLimitEvent)
    .where(
      and(
        eq(rateLimitEvent.organizationId, organizationId),
        lt(rateLimitEvent.windowStart, cutoff)
      )
    )
    .returning({id: rateLimitEvent.id})
  return deleted.length
}
