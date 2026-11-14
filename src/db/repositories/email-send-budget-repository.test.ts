import {drizzle} from 'drizzle-orm/pg-proxy'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * Compteur du budget d'envoi (s52, ADR 053). La base n'est pas joignable en
 * unitaire : un client Drizzle `pg-proxy` rend au test chaque requete telle
 * qu'elle partirait vers Postgres. Le plafond est epingle par son SQL ; son
 * atomicite reelle et la RLS se prouvent en e2e.
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
  claimReportableSendTxnDao,
  countLoginSendTxnDao,
  getSendBudgetDao,
  refundReportableSendTxnDao,
} from './email-send-budget-repository'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const DAY = '2026-11-14'

beforeEach(() => {
  sent.length = 0
  responses.current = []
})

describe('claimReportableSendTxnDao — incrément conditionnel en une instruction (critère 2)', () => {
  it('un seul INSERT … ON CONFLICT DO UPDATE, le plafond dans le WHERE', async () => {
    responses.current = [[[12]]]

    const granted = await claimReportableSendTxnDao({
      organizationId: ORG_ID,
      day: DAY,
      allowance: 200,
    })

    expect(sent).toHaveLength(1)
    const [{sql, params}] = sent
    expect(sql).toMatch(/^insert into "email_send_budget"/)
    expect(sql).toContain(
      'on conflict ("organization_id","day") do update set "reportable_count" = "email_send_budget"."reportable_count" + 1'
    )
    expect(sql).toMatch(
      /where "email_send_budget"\."reportable_count" \+ 1 <= \$\d+ returning "reportable_count"$/
    )
    expect(params).toEqual(expect.arrayContaining([ORG_ID, DAY, 200]))
    expect(granted).toBe(true)
  })

  it('aucune ligne rendue : budget épuisé, refusé', async () => {
    responses.current = [[]]

    await expect(
      claimReportableSendTxnDao({
        organizationId: ORG_ID,
        day: DAY,
        allowance: 200,
      })
    ).resolves.toBe(false)
  })

  it('aucun envoi reportable accordé : refusé sans requête (la première ligne ne passerait pas le WHERE)', async () => {
    await expect(
      claimReportableSendTxnDao({
        organizationId: ORG_ID,
        day: DAY,
        allowance: 0,
      })
    ).resolves.toBe(false)
    expect(sent).toHaveLength(0)
  })
})

describe('countLoginSendTxnDao — la connexion est décomptée, jamais refusée (critère 3)', () => {
  it('incrémente login_count sans aucun plafond', async () => {
    responses.current = [[[3]]]

    await countLoginSendTxnDao({organizationId: ORG_ID, day: DAY})

    const [{sql, params}] = sent
    expect(sql).toMatch(/^insert into "email_send_budget"/)
    expect(sql).toContain(
      'do update set "login_count" = "email_send_budget"."login_count" + 1'
    )
    expect(sql).not.toMatch(/ where /)
    expect(params).toEqual(expect.arrayContaining([ORG_ID, DAY]))
  })
})

describe('refundReportableSendTxnDao — un refus certain rend l’unité', () => {
  it('décrémente sans descendre sous zéro', async () => {
    await refundReportableSendTxnDao({organizationId: ORG_ID, day: DAY})

    const [{sql, params}] = sent
    expect(sql).toMatch(/^update "email_send_budget" set "reportable_count" = /)
    expect(sql).toContain('greatest(')
    expect(params).toEqual(expect.arrayContaining([ORG_ID, DAY]))
  })
})

describe('getSendBudgetDao — compteurs du jour', () => {
  it('rend les deux compteurs du jour', async () => {
    responses.current = [[[40, 7]]]

    await expect(
      getSendBudgetDao({organizationId: ORG_ID, day: DAY})
    ).resolves.toEqual({reportableCount: 40, loginCount: 7})
    expect(sent[0].sql).toMatch(
      /^select "reportable_count", "login_count" from "email_send_budget" where/
    )
  })

  it('sans ligne du jour : zéro partout', async () => {
    responses.current = [[]]

    await expect(
      getSendBudgetDao({organizationId: ORG_ID, day: DAY})
    ).resolves.toEqual({reportableCount: 0, loginCount: 0})
  })
})
