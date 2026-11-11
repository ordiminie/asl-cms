import {drizzle} from 'drizzle-orm/pg-proxy'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * DAO des campagnes (s25, ADR 051). La base n'est pas joignable en unitaire :
 * un client Drizzle `pg-proxy` rend au test chaque requete telle qu'elle
 * partirait vers Postgres. La RLS se prouve en e2e.
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
  createCampaignWithRecipientsTxnDao,
  finishCampaignTxnDao,
  getCampaignByIdDao,
  getCampaignsPageDao,
  getCampaignTargetRowsDao,
  getCurrentParcelNumbersForMembersDao,
  getPendingRecipientsDao,
  markRecipientFailedTxnDao,
  markRecipientSentTxnDao,
} from './campaign-repository'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const CAMPAIGN_ID = '22222222-2222-4222-8222-222222222222'
const SUBMISSION_ID = '33333333-3333-4333-8333-333333333333'
const PROFILE_A = '44444444-4444-4444-8444-444444444444'
const PROFILE_B = '55555555-5555-4555-8555-555555555555'
const RECIPIENT_ID = '66666666-6666-4666-8666-666666666666'
const NOW = new Date('2026-11-12T13:32:00Z')

/** Une ligne `campaign` dans l'ordre des colonnes du modele. */
const campaignRow = (id = CAMPAIGN_ID) => [
  id,
  ORG_ID,
  SUBMISSION_ID,
  'Objet',
  null,
  'Bonjour {nom}',
  'free',
  'all_members',
  2,
  1,
  0,
  0,
  'sending',
  '2026-11-12',
  null,
  'Marie Delorme',
  null,
  null,
  NOW.toISOString(),
  NOW.toISOString(),
  null,
]

const CAMPAIGN_INPUT = {
  organizationId: ORG_ID,
  submissionId: SUBMISSION_ID,
  subject: 'Objet',
  preheader: null,
  bodyMarkdown: 'Bonjour {nom}',
  templateId: 'free',
  targetKind: 'all_members',
  recipientCount: 2,
  withoutEmailCount: 1,
  unsubscribedCount: 0,
  status: 'sending' as const,
  sendDate: '2026-11-12',
  authorUserId: null,
  authorName: 'Marie Delorme',
  onBehalfOfUserId: null,
  onBehalfOfName: null,
}

const RECIPIENTS = [
  {memberProfileId: PROFILE_A, unsubscribeToken: 'token-a'},
  {memberProfileId: PROFILE_B, unsubscribeToken: 'token-b'},
]

beforeEach(() => {
  sent.length = 0
  responses.current = []
})

describe('getCampaignTargetRowsDao', () => {
  it('lit les fiches de l’association avec leur email et leur refus éventuel', async () => {
    responses.current = [
      [
        [PROFILE_A, 'Claire Aubert', 'claire@example.fr', false],
        [PROFILE_B, 'Paul Renaud', null, true],
      ],
    ]

    const rows = await getCampaignTargetRowsDao(ORG_ID)

    const [{sql, params}] = sent
    expect(sql).toContain('from "member_profile"')
    expect(sql).toContain('left join "member_unsubscribe"')
    expect(sql).toContain('"member_profile"."organization_id" = $')
    expect(params).toContain(ORG_ID)
    expect(rows).toEqual([
      {
        memberProfileId: PROFILE_A,
        name: 'Claire Aubert',
        email: 'claire@example.fr',
        unsubscribed: false,
      },
      {
        memberProfileId: PROFILE_B,
        name: 'Paul Renaud',
        email: null,
        unsubscribed: true,
      },
    ])
  })
})

describe('getCurrentParcelNumbersForMembersDao', () => {
  it('ne lit que les périodes ouvertes, et regroupe les numéros par fiche', async () => {
    responses.current = [
      [
        [PROFILE_A, '12'],
        [PROFILE_A, '14'],
      ],
    ]

    const numbers = await getCurrentParcelNumbersForMembersDao([
      PROFILE_A,
      PROFILE_B,
    ])

    expect(sent[0].sql).toContain('"parcel_ownership"."ends_on" is null')
    expect(sent[0].sql).toContain('order by "parcel"."number"')
    expect(numbers).toEqual({[PROFILE_A]: ['12', '14']})
  })

  it('n’interroge pas la base sans fiche', async () => {
    await expect(getCurrentParcelNumbersForMembersDao([])).resolves.toEqual({})
    expect(sent).toHaveLength(0)
  })
})

describe('createCampaignWithRecipientsTxnDao', () => {
  it('crée la campagne avec ON CONFLICT, puis ses lignes de destinataire', async () => {
    responses.current = [[campaignRow()], []]

    const result = await createCampaignWithRecipientsTxnDao(
      CAMPAIGN_INPUT,
      RECIPIENTS
    )

    expect(sent).toHaveLength(2)
    expect(sent[0].sql).toMatch(/^insert into "campaign"/)
    expect(sent[0].sql).toContain(
      'on conflict ("organization_id","submission_id") do nothing'
    )
    expect(sent[1].sql).toMatch(/^insert into "campaign_recipient"/)
    expect(sent[1].params).toEqual(
      expect.arrayContaining([
        ORG_ID,
        CAMPAIGN_ID,
        PROFILE_A,
        'token-a',
        PROFILE_B,
        'token-b',
      ])
    )
    expect(result).toMatchObject({created: true, campaign: {id: CAMPAIGN_ID}})
  })

  it('soumission rejouée : relit la campagne existante, sans seconde ligne de destinataire', async () => {
    responses.current = [[], [campaignRow()]]

    const result = await createCampaignWithRecipientsTxnDao(
      CAMPAIGN_INPUT,
      RECIPIENTS
    )

    expect(sent).toHaveLength(2)
    expect(sent[1].sql).toMatch(/^select .* from "campaign"/)
    expect(sent[1].sql).toContain('"campaign"."submission_id" = $')
    expect(sent.some(({sql}) => sql.includes('"campaign_recipient"'))).toBe(
      false
    )
    expect(result).toMatchObject({created: false, campaign: {id: CAMPAIGN_ID}})
  })
})

describe('getCampaignByIdDao', () => {
  it('lit la campagne par id dans l’association, undefined sinon', async () => {
    const found = await getCampaignByIdDao(ORG_ID, CAMPAIGN_ID)

    expect(sent[0].sql).toContain('"campaign"."id" = $')
    expect(sent[0].sql).toContain('"campaign"."organization_id" = $')
    expect(found).toBeUndefined()
  })
})

describe('getCampaignsPageDao', () => {
  it('trie par date de création décroissante, page demandée, et compte', async () => {
    responses.current = [[campaignRow()], [[7]]]

    const {rows, total} = await getCampaignsPageDao({
      organizationId: ORG_ID,
      limit: 25,
      offset: 50,
    })

    const select = sent[0]
    expect(select.sql).toContain(
      'order by "campaign"."created_at" desc, "campaign"."id" desc'
    )
    expect(select.sql).toContain('limit $')
    expect(select.params).toEqual(expect.arrayContaining([ORG_ID, 25, 50]))
    expect(sent[1].sql).toMatch(/^select count/)
    expect(rows).toHaveLength(1)
    expect(total).toBe(7)
  })
})

describe('getPendingRecipientsDao', () => {
  it('lit les destinataires en attente avec nom, email et parcelles actuelles', async () => {
    responses.current = [
      [[RECIPIENT_ID, PROFILE_A, 'Claire Aubert', 'claire@example.fr', 'tok']],
      [[PROFILE_A, '12']],
    ]

    const rows = await getPendingRecipientsDao(CAMPAIGN_ID)

    expect(sent[0].sql).toContain('from "campaign_recipient"')
    expect(sent[0].sql).toContain('"campaign_recipient"."status" = $')
    expect(sent[0].params).toEqual(
      expect.arrayContaining([CAMPAIGN_ID, 'pending'])
    )
    expect(rows).toEqual([
      {
        recipientId: RECIPIENT_ID,
        memberProfileId: PROFILE_A,
        name: 'Claire Aubert',
        email: 'claire@example.fr',
        unsubscribeToken: 'tok',
        parcelNumbers: ['12'],
      },
    ])
  })
})

describe('markRecipientSentTxnDao', () => {
  it('passe la ligne à sent et incrémente sent_count dans la même instruction', async () => {
    responses.current = [[[CAMPAIGN_ID, 1]]]

    const result = await markRecipientSentTxnDao(RECIPIENT_ID)

    expect(sent).toHaveLength(1)
    const [{sql, params}] = sent
    expect(sql).toMatch(
      /^with "sent_recipient" as \(update "campaign_recipient"/
    )
    expect(sql).toContain('"sent_at" = now()')
    expect(sql).toContain(
      'update "campaign" set "sent_count" = "campaign"."sent_count" + 1'
    )
    expect(sql).toContain('"updated_at" = now()')
    expect(params).toEqual(
      expect.arrayContaining(['sent', RECIPIENT_ID, 'pending'])
    )
    expect(result).toEqual({campaignId: CAMPAIGN_ID, sentCount: 1})
  })

  it('rend undefined si la ligne n’était plus en attente', async () => {
    await expect(markRecipientSentTxnDao(RECIPIENT_ID)).resolves.toBeUndefined()
  })
})

describe('markRecipientFailedTxnDao', () => {
  it('passe la seule ligne en attente à failed', async () => {
    responses.current = [[[RECIPIENT_ID]]]

    const result = await markRecipientFailedTxnDao(RECIPIENT_ID)

    expect(sent[0].sql).toMatch(
      /^update "campaign_recipient" set "status" = \$1/
    )
    expect(sent[0].params).toEqual(['failed', RECIPIENT_ID, 'pending'])
    expect(result).toEqual({id: RECIPIENT_ID})
  })
})

describe('finishCampaignTxnDao', () => {
  it('clôt une campagne encore en cours, avec son statut final', async () => {
    responses.current = [[[CAMPAIGN_ID]]]

    const result = await finishCampaignTxnDao(CAMPAIGN_ID, 'interrupted')

    const [{sql, params}] = sent
    expect(sql).toMatch(/^update "campaign" set "status" = \$1/)
    expect(sql).toContain('"finished_at" = now()')
    expect(sql).toContain('"campaign"."status" = $')
    expect(params).toEqual(['interrupted', CAMPAIGN_ID, 'sending'])
    expect(result).toEqual({id: CAMPAIGN_ID})
  })
})
