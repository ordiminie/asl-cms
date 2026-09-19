import {drizzle} from 'drizzle-orm/pg-proxy'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * La base n'est pas joignable en unitaire (`db.ts` refuse toute connexion) :
 * le repository ecrit ici dans un client Drizzle `pg-proxy`, qui ne se connecte
 * a rien et rend au test chaque requete telle qu'elle partirait vers Postgres.
 * Ce qui se prouve ici : **combien** de requetes, et laquelle. Le comportement
 * de Postgres sous RLS forcee se prouve en e2e.
 */
const {sent, nextRows} = vi.hoisted(() => ({
  sent: [] as {sql: string; params: unknown[]}[],
  nextRows: {current: [] as unknown[][]},
}))

vi.mock('@/db/tenant-scope', () => ({
  getDb: () =>
    drizzle(async (sql, params) => {
      sent.push({sql, params})
      return {rows: nextRows.current}
    }),
}))

import {
  incrementRateLimitCounterDao,
  purgeRateLimitCountersDao,
} from './rate-limit-repository'

const ORG_ID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  sent.length = 0
  nextRows.current = []
})

describe('incrementRateLimitCounterDao', () => {
  it('insère ou incrémente le compteur du jour en une seule requête, et rend le compte', async () => {
    nextRows.current = [[4]]

    const count = await incrementRateLimitCounterDao({
      organizationId: ORG_ID,
      fingerprint: 'empreinte',
      day: '2026-09-19',
    })

    expect(count).toBe(4)
    expect(sent).toHaveLength(1)
    const [{sql, params}] = sent
    expect(sql).toMatch(/^insert into "rate_limit_event"/)
    expect(sql).toContain(
      'on conflict ("organization_id","fingerprint","day") do update set "count" = "rate_limit_event"."count" + 1'
    )
    expect(sql).toMatch(/returning "count"$/)
    expect(params).toEqual(
      expect.arrayContaining([ORG_ID, 'empreinte', '2026-09-19'])
    )
  })
})

describe('purgeRateLimitCountersDao', () => {
  it('supprime les compteurs des jours passés de l’association', async () => {
    await purgeRateLimitCountersDao(ORG_ID, '2026-09-19')

    expect(sent).toHaveLength(1)
    const [{sql, params}] = sent
    expect(sql).toMatch(/^delete from "rate_limit_event"/)
    expect(sql).toContain('"rate_limit_event"."organization_id" = $1')
    expect(sql).toContain('"rate_limit_event"."day" < $2')
    expect(params).toEqual([ORG_ID, '2026-09-19'])
  })
})
