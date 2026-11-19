import {drizzle} from 'drizzle-orm/pg-proxy'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * Periodes de propriete lues pour le terrain des factures Pennylane (s20,
 * ADR 062 §4). `pg-proxy` rend chaque requete telle qu'elle partirait ; la
 * RLS et le comportement reel se prouvent en e2e.
 */
const {sent, responses} = vi.hoisted(() => ({
  sent: [] as {sql: string; params: unknown[]}[],
  responses: {current: [] as unknown[][]},
}))

vi.mock('@/db/tenant-scope', () => ({
  getDb: () =>
    drizzle(async (sql, params) => {
      sent.push({sql, params})
      return {rows: responses.current.shift() ?? []}
    }),
}))

import {listOwnershipPeriodsByProfilesDao} from './parcel-ownership-repository'

const PROFILE_A = '33333333-3333-4333-8333-333333333333'
const PROFILE_B = '44444444-4444-4444-8444-444444444444'

beforeEach(() => {
  sent.length = 0
  responses.current = []
})

describe('listOwnershipPeriodsByProfilesDao', () => {
  it('lit toutes les périodes des fiches demandées, avec numéro et compteur', async () => {
    await listOwnershipPeriodsByProfilesDao([PROFILE_A, PROFILE_B])

    const [{sql, params}] = sent
    expect(sql).toContain('from "parcel_ownership"')
    expect(sql).toContain(
      'join "parcel" on "parcel"."id" = "parcel_ownership"."parcel_id"'
    )
    for (const column of [
      '"parcel_ownership"."member_profile_id"',
      '"parcel"."number"',
      '"parcel"."meter_number"',
      '"parcel_ownership"."starts_on"',
      '"parcel_ownership"."ends_on"',
    ]) {
      expect(sql, column).toContain(column)
    }
    expect(sql).toContain('"parcel_ownership"."member_profile_id" in ($1, $2)')
    expect(params).toEqual([PROFILE_A, PROFILE_B])
  })

  it('aucune fiche : aucune requête', async () => {
    expect(await listOwnershipPeriodsByProfilesDao([])).toEqual([])
    expect(sent).toEqual([])
  })
})
