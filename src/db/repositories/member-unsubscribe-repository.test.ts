import {drizzle} from 'drizzle-orm/pg-proxy'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * DAO de la desinscription (s25, ADR 051 ; portee par l'adresse de fiche
 * depuis s54, ADR 057), sur le patron de `member-note-repository.test.ts`.
 * La RLS se prouve en e2e.
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
  getRecipientByTokenDao,
  getUnsubscribeByMemberDao,
  unsubscribeEmailIfAbsentTxnDao,
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
  it('résout un jeton en sa ligne de destinataire et son adresse, avec le refus de cette adresse dans l’association', async () => {
    responses.current = [
      [
        [
          RECIPIENT_ID,
          ORG_ID,
          CAMPAIGN_ID,
          PROFILE_ID,
          'claire@example.fr',
          NOW.toISOString(),
        ],
      ],
    ]

    const row = await getRecipientByTokenDao(TOKEN)

    const [{sql, params}] = sent
    expect(sql).toContain('from "campaign_recipient"')
    expect(sql).toContain('"campaign_recipient"."unsubscribe_token" = $')
    expect(sql).toContain('"member_profile_email"')
    expect(sql).toContain('lower(trim(mpe_refusal."email"))')
    expect(sql).not.toContain('member_unsubscribe')
    expect(params).toContain(TOKEN)
    expect(row).toEqual({
      recipientId: RECIPIENT_ID,
      organizationId: ORG_ID,
      campaignId: CAMPAIGN_ID,
      memberProfileId: PROFILE_ID,
      email: 'claire@example.fr',
      unsubscribedAt: NOW,
    })
  })

  it('jeton inconnu → undefined', async () => {
    expect(await getRecipientByTokenDao(TOKEN)).toBeUndefined()
  })
})

describe('unsubscribeEmailIfAbsentTxnDao', () => {
  it('date toutes les adresses de l’association égales sans casse, sans réécrire un refus existant', async () => {
    responses.current = [[['e1'], ['e2']]]

    const dated = await unsubscribeEmailIfAbsentTxnDao(
      ORG_ID,
      'Claire@Example.fr'
    )

    const [{sql, params}] = sent
    expect(sql).toMatch(
      /^update "member_profile_email" set "unsubscribed_at" = now\(\)/
    )
    expect(sql).toContain('"member_profile_email"."organization_id" = $')
    expect(sql).toContain(
      'lower(trim("member_profile_email"."email")) = lower(trim($'
    )
    expect(sql).toContain('"member_profile_email"."unsubscribed_at" is null')
    expect(params).toEqual(
      expect.arrayContaining([ORG_ID, 'Claire@Example.fr'])
    )
    expect(dated).toBe(2)
  })

  it('aucune adresse à dater → 0', async () => {
    expect(await unsubscribeEmailIfAbsentTxnDao(ORG_ID, 'x@example.fr')).toBe(0)
  })
})

describe('getUnsubscribeByMemberDao', () => {
  it('lit le refus d’une fiche dont toutes les adresses actives ont refusé, au plus récent', async () => {
    responses.current = [[[2, 2, NOW.toISOString()]]]

    expect(await getUnsubscribeByMemberDao(PROFILE_ID)).toEqual({
      createdAt: NOW,
    })
    const [{sql, params}] = sent
    expect(sql).toContain('from "member_profile_email"')
    expect(sql).toContain('"member_profile_email"."member_profile_id" = $')
    expect(sql).toContain('"member_profile_email"."status" = $')
    expect(params).toEqual(expect.arrayContaining([PROFILE_ID, 'active']))
  })

  it('une adresse active sans refus : pas de refus de la fiche', async () => {
    responses.current = [[[2, 1, NOW.toISOString()]]]

    expect(await getUnsubscribeByMemberDao(PROFILE_ID)).toBeUndefined()
  })

  it('aucune adresse active : pas de refus de la fiche', async () => {
    responses.current = [[[0, 0, null]]]

    expect(await getUnsubscribeByMemberDao(PROFILE_ID)).toBeUndefined()
  })
})
