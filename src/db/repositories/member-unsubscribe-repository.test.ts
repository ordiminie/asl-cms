import {drizzle} from 'drizzle-orm/pg-proxy'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * DAO de la desinscription (s25, ADR 051), sur le patron de
 * `member-note-repository.test.ts`. La RLS se prouve en e2e.
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
  createUnsubscribeIfAbsentTxnDao,
  getRecipientByTokenDao,
  getUnsubscribeByMemberDao,
} from './member-unsubscribe-repository'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const CAMPAIGN_ID = '22222222-2222-4222-8222-222222222222'
const PROFILE_ID = '44444444-4444-4444-8444-444444444444'
const RECIPIENT_ID = '66666666-6666-4666-8666-666666666666'
const TOKEN = 'A'.repeat(43)
const NOW = new Date('2026-11-12T13:32:00Z')

beforeEach(() => {
  sent.length = 0
  responses.current = []
})

describe('getRecipientByTokenDao', () => {
  it('résout un jeton en sa ligne de destinataire, avec le refus éventuel', async () => {
    responses.current = [
      [[RECIPIENT_ID, ORG_ID, CAMPAIGN_ID, PROFILE_ID, null]],
    ]

    const row = await getRecipientByTokenDao(TOKEN)

    const [{sql, params}] = sent
    expect(sql).toContain('from "campaign_recipient"')
    expect(sql).toContain('"campaign_recipient"."unsubscribe_token" = $1')
    expect(params).toEqual([TOKEN, 1])
    expect(row).toEqual({
      recipientId: RECIPIENT_ID,
      organizationId: ORG_ID,
      campaignId: CAMPAIGN_ID,
      memberProfileId: PROFILE_ID,
      unsubscribedAt: null,
    })
  })

  it('jeton inconnu → undefined', async () => {
    await expect(getRecipientByTokenDao(TOKEN)).resolves.toBeUndefined()
  })
})

describe('getUnsubscribeByMemberDao', () => {
  it('lit le refus de la seule fiche', async () => {
    responses.current = [[[NOW.toISOString()]]]

    const row = await getUnsubscribeByMemberDao(PROFILE_ID)

    expect(sent[0].sql).toContain('from "member_unsubscribe"')
    expect(sent[0].sql).toContain(
      '"member_unsubscribe"."member_profile_id" = $1'
    )
    expect(row?.createdAt).toEqual(NOW)
  })

  it('aucun refus → undefined', async () => {
    await expect(getUnsubscribeByMemberDao(PROFILE_ID)).resolves.toBeUndefined()
  })
})

describe('createUnsubscribeIfAbsentTxnDao', () => {
  it('insère le refus sans écraser un refus existant', async () => {
    responses.current = [[[PROFILE_ID]]]

    const row = await createUnsubscribeIfAbsentTxnDao({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      campaignId: CAMPAIGN_ID,
    })

    const [{sql, params}] = sent
    expect(sql).toMatch(/^insert into "member_unsubscribe"/)
    expect(sql).toContain(
      'on conflict ("organization_id","member_profile_id") do nothing'
    )
    expect(params).toEqual(
      expect.arrayContaining([ORG_ID, PROFILE_ID, CAMPAIGN_ID])
    )
    expect(row).toEqual({memberProfileId: PROFILE_ID})
  })

  it('refus déjà présent → undefined', async () => {
    await expect(
      createUnsubscribeIfAbsentTxnDao({
        organizationId: ORG_ID,
        memberProfileId: PROFILE_ID,
        campaignId: null,
      })
    ).resolves.toBeUndefined()
  })
})
