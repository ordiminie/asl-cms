import {drizzle} from 'drizzle-orm/pg-proxy'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * DAO des signalements de membre (s22, ADR 049). La base n'est pas joignable
 * en unitaire : un client Drizzle `pg-proxy` rend au test chaque requete telle
 * qu'elle partirait vers Postgres (sans transaction : l'ecriture du membre
 * se prouve par le service et l'e2e). La RLS se prouve en e2e.
 */
const {sent, nextRows} = vi.hoisted(() => ({
  sent: [] as {sql: string; params: unknown[]}[],
  nextRows: {current: [] as unknown[]},
}))

vi.mock('@/db/tenant-scope', () => ({
  getDb: () =>
    drizzle(async (sql, params) => {
      sent.push({sql, params})
      return {rows: nextRows.current}
    }),
}))

import {getMyIncidentReportsDao} from './incident-report-repository'

const MEMBER_ID = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  sent.length = 0
  nextRows.current = []
})

describe('getMyIncidentReportsDao', () => {
  it('lit les signalements du seul membre, catégorie jointe, le plus récent d’abord, sans limite', async () => {
    await getMyIncidentReportsDao(MEMBER_ID)

    expect(sent).toHaveLength(1)
    const [{sql, params}] = sent
    expect(sql).toContain('from "incident_report"')
    expect(sql).toContain('left join "association_category"')
    expect(sql).toContain('"incident_report"."member_id" = $1')
    expect(sql).toContain(
      'order by "incident_report"."created_at" desc, "incident_report"."id" desc'
    )
    expect(sql).not.toContain('limit')
    expect(params).toEqual([MEMBER_ID])
  })

  it('lit la date du dernier événement du signalement', async () => {
    await getMyIncidentReportsDao(MEMBER_ID)

    const [{sql}] = sent
    expect(sql).toContain('max("incident_report_event"."created_at")')
    expect(sql).toContain(
      '"incident_report_event"."report_id" = "incident_report"."id"'
    )
  })

  it('ne lit ni la description, ni les coordonnées, ni le témoin d’envoi', async () => {
    await getMyIncidentReportsDao(MEMBER_ID)

    const [{sql}] = sent
    expect(sql).not.toContain('"description"')
    expect(sql).not.toContain('"reporter_')
    expect(sql).not.toContain('"notification_failed"')
  })
})
