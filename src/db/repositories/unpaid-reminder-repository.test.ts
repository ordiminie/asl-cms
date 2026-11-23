import {drizzle} from 'drizzle-orm/pg-proxy'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * DAO des rangs de relance (s29, ADR 070). La base n'est pas joignable en
 * unitaire : un client Drizzle `pg-proxy` rend au test chaque requete telle
 * qu'elle partirait vers Postgres. La RLS se prouve en e2e.
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
  getReminderRecipientsByProfileDao,
  insertUnpaidReminderTxnDao,
  listUnpaidRemindersDao,
} from './unpaid-reminder-repository'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const CAMPAIGN_1 = '22222222-2222-4222-8222-222222222222'
const CAMPAIGN_2 = '33333333-3333-4333-8333-333333333333'
const PROFILE_A = '44444444-4444-4444-8444-444444444444'
const PROFILE_B = '55555555-5555-4555-8555-555555555555'

beforeEach(() => {
  sent.length = 0
  responses.current = []
})

describe('insertUnpaidReminderTxnDao', () => {
  it('écrit le rang de l’échéance et sa campagne, sous l’association', async () => {
    await insertUnpaidReminderTxnDao({
      organizationId: ORG_ID,
      dueOn: '2026-03-31',
      rank: 1,
      campaignId: CAMPAIGN_1,
    })

    expect(sent[0].sql).toMatch(/^insert into "unpaid_reminder"/)
    expect(sent[0].params).toEqual(
      expect.arrayContaining([ORG_ID, '2026-03-31', 1, CAMPAIGN_1])
    )
  })
})

describe('listUnpaidRemindersDao', () => {
  it('lit les rangs de l’association avec l’état de leur campagne et leur dernier jour d’envoi réel', async () => {
    responses.current = [
      [
        ['2026-03-31', 1, CAMPAIGN_1, 'sent', '2026-04-24'],
        ['2026-03-31', 2, CAMPAIGN_2, 'sending', null],
      ],
    ]

    const rows = await listUnpaidRemindersDao(ORG_ID)

    const [{sql, params}] = sent
    expect(sql).toMatch(/from "unpaid_reminder"/)
    expect(sql).toContain('inner join "campaign"')
    expect(sql).toContain('"unpaid_reminder"."organization_id" = $')
    expect(sql).toContain('Europe/Paris')
    expect(params).toEqual(expect.arrayContaining([ORG_ID]))
    expect(rows).toEqual([
      {
        dueOn: '2026-03-31',
        rank: 1,
        campaignId: CAMPAIGN_1,
        campaignStatus: 'sent',
        lastSentOn: '2026-04-24',
      },
      {
        dueOn: '2026-03-31',
        rank: 2,
        campaignId: CAMPAIGN_2,
        campaignStatus: 'sending',
        lastSentOn: null,
      },
    ])
  })
})

describe('getReminderRecipientsByProfileDao', () => {
  it('lit, par fiche, les rangs reçus par email et ceux adressés par courrier', async () => {
    const sentAt = new Date('2026-04-21T08:00:00Z')
    responses.current = [
      [[CAMPAIGN_1, PROFILE_A, sentAt.toISOString()]],
      [[CAMPAIGN_1, PROFILE_B]],
    ]

    const result = await getReminderRecipientsByProfileDao(ORG_ID, [
      CAMPAIGN_1,
      CAMPAIGN_2,
    ])

    expect(sent[0].sql).toContain('from "campaign_recipient_profile"')
    expect(sent[0].sql).toContain('inner join "campaign_recipient"')
    expect(sent[0].params).toEqual(
      expect.arrayContaining([ORG_ID, CAMPAIGN_1, CAMPAIGN_2, 'sent'])
    )
    expect(sent[1].sql).toContain('from "campaign_letter_profile"')
    expect(result).toEqual({
      emails: [{campaignId: CAMPAIGN_1, memberProfileId: PROFILE_A, sentAt}],
      letters: [{campaignId: CAMPAIGN_1, memberProfileId: PROFILE_B}],
    })
  })

  it('n’interroge pas la base sans campagne', async () => {
    expect(await getReminderRecipientsByProfileDao(ORG_ID, [])).toEqual({
      emails: [],
      letters: [],
    })
    expect(sent).toHaveLength(0)
  })
})
