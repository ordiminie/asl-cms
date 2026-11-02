import {drizzle} from 'drizzle-orm/pg-proxy'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * DAO des traces de s48 (ADR 041). La base n'est pas joignable en unitaire :
 * les requetes partent dans un client Drizzle `pg-proxy` qui les rend au test.
 * La RLS de `impersonation_event` se prouve en e2e (acces croise).
 */
const {sent, nextRows} = vi.hoisted(() => ({
  sent: [] as {sql: string; params: unknown[]}[],
  nextRows: {current: [] as unknown[]},
}))

/**
 * `pg-proxy` ne connait pas les transactions : la transaction du DAO est
 * deroulee sur le meme client, ce qui suffit a lire les requetes envoyees.
 */
vi.mock('@/db/tenant-scope', () => ({
  getDb: () => {
    const proxy = drizzle(async (sql, params) => {
      sent.push({sql, params})
      return {rows: nextRows.current}
    })
    return Object.assign(proxy, {
      transaction: (run: (tx: typeof proxy) => unknown) => run(proxy),
    })
  },
}))

import {insertImpersonationEventDao} from './impersonation-event-repository'
import {changeIncidentReportStatusTxnDao} from './incident-report-repository'
import {insertMemberRoleEventDao} from './member-role-event-repository'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const ADMIN_ID = '22222222-2222-4222-8222-222222222222'
const TARGET_ID = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  sent.length = 0
  nextRows.current = []
})

describe('insertImpersonationEventDao', () => {
  it('écrit une ligne d’ouverture dans impersonation_event', async () => {
    await insertImpersonationEventDao({
      organizationId: ORG_ID,
      kind: 'opened',
      adminUserId: ADMIN_ID,
      adminName: 'Zoé Support',
      targetUserId: TARGET_ID,
      targetName: 'Claire Montel',
      sessionId: 'session-1',
      reason: 'Passation bloquée',
    })

    expect(sent).toHaveLength(1)
    const [{sql, params}] = sent
    expect(sql).toMatch(/^insert into "impersonation_event"/)
    expect(sql).toContain('"admin_user_id"')
    expect(sql).toContain('"target_name"')
    expect(params).toEqual(
      expect.arrayContaining([
        ORG_ID,
        'opened',
        ADMIN_ID,
        'Zoé Support',
        TARGET_ID,
        'Claire Montel',
        'session-1',
        'Passation bloquée',
      ])
    )
  })
})

describe('traces existantes — « pour le compte de » (s48, critère 6)', () => {
  it('member_role_event porte on_behalf_of_user_id et on_behalf_of_name', async () => {
    await insertMemberRoleEventDao({
      organizationId: ORG_ID,
      reason: 'assignment',
      authorUserId: ADMIN_ID,
      authorName: 'Zoé Support',
      onBehalfOfUserId: TARGET_ID,
      onBehalfOfName: 'Claire Montel',
    })

    const [{sql, params}] = sent
    expect(sql).toContain('"on_behalf_of_user_id"')
    expect(sql).toContain('"on_behalf_of_name"')
    expect(params).toEqual(expect.arrayContaining([TARGET_ID, 'Claire Montel']))
  })

  it('le changement de statut d’un signalement écrit le « pour le compte de »', async () => {
    nextRows.current = [['report-1']]

    await changeIncidentReportStatusTxnDao({
      organizationId: ORG_ID,
      reportId: 'report-1',
      from: 'reported',
      to: 'in_progress',
      authorUserId: ADMIN_ID,
      authorName: 'Zoé Support',
      onBehalfOfUserId: TARGET_ID,
      onBehalfOfName: 'Claire Montel',
    })

    const insert = sent.find(({sql}) =>
      sql.startsWith('insert into "incident_report_event"')
    )
    expect(insert?.sql).toContain('"on_behalf_of_user_id"')
    expect(insert?.params).toEqual(
      expect.arrayContaining([TARGET_ID, 'Claire Montel'])
    )
  })

  it('hors imitation, le « pour le compte de » du signalement est nul', async () => {
    nextRows.current = [['report-1']]

    await changeIncidentReportStatusTxnDao({
      organizationId: ORG_ID,
      reportId: 'report-1',
      from: 'reported',
      to: 'in_progress',
      authorUserId: TARGET_ID,
      authorName: 'Claire Montel',
      onBehalfOfUserId: null,
      onBehalfOfName: null,
    })

    const insert = sent.find(({sql}) =>
      sql.startsWith('insert into "incident_report_event"')
    )
    expect(insert?.params.filter((value) => value === null)).toHaveLength(2)
  })
})
