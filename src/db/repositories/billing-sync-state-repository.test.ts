import {drizzle} from 'drizzle-orm/pg-proxy'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * DAO de l'etat de la synchronisation Pennylane (s20, ADR 062 §7). La base
 * n'est pas joignable en unitaire : `pg-proxy` rend chaque requete telle
 * qu'elle partirait. La RLS se prouve en e2e.
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

import {
  getBillingSyncStateDao,
  recordBillingSyncFailureDao,
  recordBillingSyncSuccessDao,
} from './billing-sync-state-repository'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const NOW = new Date('2026-11-19T13:05:00.000Z')

beforeEach(() => {
  sent.length = 0
  responses.current = []
})

describe('getBillingSyncStateDao', () => {
  it('lit la ligne de l’association ; rien sans synchronisation', async () => {
    expect(await getBillingSyncStateDao(ORG_ID)).toBeUndefined()

    const [{sql, params}] = sent
    expect(sql).toContain('from "billing_sync_state"')
    expect(sql).toContain('"billing_sync_state"."organization_id" = $1')
    expect(params).toEqual([ORG_ID])
  })
})

describe('recordBillingSyncFailureDao', () => {
  it('note la tentative et son motif, sans toucher au dernier succès ni aux comptes', async () => {
    await recordBillingSyncFailureDao(ORG_ID, NOW, 'unavailable')

    const [{sql, params}] = sent
    expect(sql).toContain('insert into "billing_sync_state"')
    expect(sql).toContain('on conflict ("organization_id") do update set')
    expect(sql).toContain('"last_attempt_at" = $')
    expect(sql).toContain('"last_error" = $')
    expect(sql).not.toContain('"last_success_at" =')
    expect(sql).not.toContain('"counts" =')
    expect(params).toEqual(expect.arrayContaining([ORG_ID, 'unavailable']))
  })
})

describe('recordBillingSyncSuccessDao', () => {
  it('note le succès : instants, motif effacé, comptes et listes remplacés', async () => {
    await recordBillingSyncSuccessDao(ORG_ID, {
      now: NOW,
      counts: {written: 2, draft: 1},
      unmatchedCustomers: [{id: '7', name: 'X', reference: null}],
      terrainMismatches: [],
    })

    const [{sql, params}] = sent
    expect(sql).toContain('insert into "billing_sync_state"')
    expect(sql).toContain('on conflict ("organization_id") do update set')
    for (const column of [
      'last_attempt_at',
      'last_success_at',
      'last_error',
      'counts',
      'unmatched_customers',
      'terrain_mismatches',
      'updated_at',
    ]) {
      expect(sql, column).toContain(`"${column}" =`)
    }
    expect(params).toEqual(
      expect.arrayContaining([
        ORG_ID,
        JSON.stringify({written: 2, draft: 1}),
        JSON.stringify([{id: '7', name: 'X', reference: null}]),
      ])
    )
  })
})
