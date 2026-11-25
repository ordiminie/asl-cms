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
  claimRecipientForSendTxnDao,
  countUnfinishedCampaignPartsDao,
  createCampaignWithRecipientsTxnDao,
  failCampaignPartsFromTxnDao,
  failUnreceivedRecipientsTxnDao,
  finishCampaignPartTxnDao,
  finishCampaignTxnDao,
  getAllottedRecipientsByDayDao,
  getCampaignByIdDao,
  getCampaignLetterProfileIdsDao,
  getCampaignPartDao,
  getCampaignPartsDao,
  getCampaignRecipientsPageDao,
  getCampaignsByTemplateIdsDao,
  getCampaignsPageDao,
  getCampaignTargetRowsDao,
  getCurrentParcelNumbersForMembersDao,
  getOpenCampaignPartsDao,
  getPendingPartRecipientsDao,
  getRecipientStatusCountsDao,
  getSlidableCampaignPartsDao,
  lockCampaignScheduleTxnDao,
  markCampaignPartDeferredTxnDao,
  markClaimedRecipientFailedTxnDao,
  markRecipientFailedTxnDao,
  markRecipientSentTxnDao,
  markRecipientSettledTxnDao,
  markRecipientSupersededTxnDao,
  markRecipientToVerifyTxnDao,
  markRecipientUnsubscribedTxnDao,
  markSendingRecipientsToVerifyTxnDao,
  markStaleSendingRecipientsToVerifyTxnDao,
  moveCampaignPartTxnDao,
  releaseRecipientClaimTxnDao,
  startCampaignPartTxnDao,
} from './campaign-repository'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const CAMPAIGN_ID = '22222222-2222-4222-8222-222222222222'
const SUBMISSION_ID = '33333333-3333-4333-8333-333333333333'
const PROFILE_A = '44444444-4444-4444-8444-444444444444'
const PROFILE_B = '55555555-5555-4555-8555-555555555555'
const RECIPIENT_ID = '66666666-6666-4666-8666-666666666666'
const RECIPIENT_B = '77777777-7777-4777-8777-777777777777'
const PROFILE_C = '88888888-8888-4888-8888-888888888888'
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
  {
    memberProfileId: PROFILE_A,
    email: 'claire@example.fr',
    unsubscribeToken: 'token-a',
    memberProfileIds: [PROFILE_A],
  },
  {
    memberProfileId: PROFILE_B,
    email: 'paul@example.fr',
    unsubscribeToken: 'token-b',
    memberProfileIds: [PROFILE_B, PROFILE_C],
  },
]

beforeEach(() => {
  sent.length = 0
  responses.current = []
})

describe('getCampaignTargetRowsDao', () => {
  it('lit une ligne par fiche et par adresse active, avec le refus de l’adresse, le nom de son compte et les parcelles (s54, ADR 057)', async () => {
    responses.current = [
      [
        [PROFILE_A, 'Jean Dubois', 'jean@example.fr', false, 'Jean D.'],
        [PROFILE_A, 'Jean Dubois', 'claire@example.fr', true, 'Claire D.'],
        [PROFILE_B, 'Paul Renaud', null, null, null],
      ],
      [[PROFILE_A, '12']],
    ]

    const rows = await getCampaignTargetRowsDao(ORG_ID)

    const [{sql, params}] = sent
    expect(sql).toContain('from "member_profile"')
    expect(sql).toContain('left join "member_profile_email"')
    expect(sql).toContain('"member_profile_email"."status" = $')
    expect(sql).toContain(
      '"member_profile_email"."unsubscribed_at" is not null'
    )
    expect(sql).not.toContain('member_unsubscribe')
    expect(sql).not.toContain('left join "member_profile_account"')
    expect(sql).toContain('"member_profile"."organization_id" = $')
    expect(params).toEqual(expect.arrayContaining([ORG_ID, 'active']))
    expect(rows).toEqual([
      {
        memberProfileId: PROFILE_A,
        name: 'Jean Dubois',
        email: 'jean@example.fr',
        unsubscribed: false,
        accountName: 'Jean D.',
        currentParcelNumbers: ['12'],
      },
      {
        memberProfileId: PROFILE_A,
        name: 'Jean Dubois',
        email: 'claire@example.fr',
        unsubscribed: true,
        accountName: 'Claire D.',
        currentParcelNumbers: ['12'],
      },
      {
        memberProfileId: PROFILE_B,
        name: 'Paul Renaud',
        email: null,
        unsubscribed: false,
        accountName: null,
        currentParcelNumbers: [],
      },
    ])
  })
})

describe('getCampaignTargetRowsDao — ce que lit le courrier (s28, ADR 067)', () => {
  it('lit aussi le domicile, le terrain et le libellé d’entreprise de la fiche', async () => {
    responses.current = [
      [
        [
          PROFILE_B,
          'Paul Renaud',
          null,
          null,
          null,
          '4 rue des Lilas',
          'Bât. B',
          '69003',
          'Lyon',
          '12 chemin de la Fourche',
          null,
          '07140',
          'Les Vans',
          'SARL Renaud',
        ],
      ],
      [],
    ]

    const [row] = await getCampaignTargetRowsDao(ORG_ID)

    for (const column of [
      'home_address_line',
      'home_address_complement',
      'home_postal_code',
      'home_city',
      'land_address_line',
      'land_address_complement',
      'land_postal_code',
      'land_city',
      'company_name',
    ]) {
      expect(sent[0].sql).toContain(`"member_profile"."${column}"`)
    }
    expect(row).toMatchObject({
      memberProfileId: PROFILE_B,
      email: null,
      homeAddressLine: '4 rue des Lilas',
      homeAddressComplement: 'Bât. B',
      homePostalCode: '69003',
      homeCity: 'Lyon',
      landAddressLine: '12 chemin de la Fourche',
      landAddressComplement: null,
      landPostalCode: '07140',
      landCity: 'Les Vans',
      companyName: 'SARL Renaud',
    })
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

const PART_1 = '77777777-7777-4777-8777-777777777777'
const PART_2 = '88888888-8888-4888-8888-888888888888'

const PLAN = [
  {number: 1, scheduledFor: '2026-11-12', recipientCount: 1},
  {number: 2, scheduledFor: '2026-11-13', recipientCount: 1},
]

describe('createCampaignWithRecipientsTxnDao', () => {
  it('crée la campagne avec ON CONFLICT, ses parts, puis ses destinataires rattachés à leur part dans l’ordre', async () => {
    responses.current = [
      [campaignRow()],
      [
        [PART_1, 1, '2026-11-12'],
        [PART_2, 2, '2026-11-13'],
      ],
      [
        [RECIPIENT_ID, 'claire@example.fr'],
        [RECIPIENT_B, 'paul@example.fr'],
      ],
    ]

    const result = await createCampaignWithRecipientsTxnDao(
      CAMPAIGN_INPUT,
      PLAN,
      RECIPIENTS,
      []
    )

    expect(sent).toHaveLength(4)
    expect(sent[0].sql).toMatch(/^insert into "campaign"/)
    expect(sent[0].sql).toContain(
      'on conflict ("organization_id","submission_id") do nothing'
    )
    expect(sent[1].sql).toMatch(/^insert into "campaign_part"/)
    expect(sent[1].params).toEqual(
      expect.arrayContaining([
        ORG_ID,
        CAMPAIGN_ID,
        1,
        '2026-11-12',
        2,
        '2026-11-13',
      ])
    )
    expect(sent[2].sql).toMatch(/^insert into "campaign_recipient"/)
    expect(sent[2].sql).toContain('"email"')
    const params = sent[2].params
    const partOf = (profile: string) => params[params.indexOf(profile) + 2]
    expect(params).toEqual(
      expect.arrayContaining([
        ORG_ID,
        CAMPAIGN_ID,
        'claire@example.fr',
        'paul@example.fr',
        'token-a',
        'token-b',
      ])
    )
    expect(partOf(PROFILE_A)).toBe(PART_1)
    expect(partOf(PROFILE_B)).toBe(PART_2)
    expect(sent[3].sql).toMatch(/^insert into "campaign_recipient_profile"/)
    expect(sent[3].params).toEqual([
      ORG_ID,
      RECIPIENT_ID,
      PROFILE_A,
      ORG_ID,
      RECIPIENT_B,
      PROFILE_B,
      ORG_ID,
      RECIPIENT_B,
      PROFILE_C,
    ])
    expect(result).toMatchObject({
      created: true,
      campaign: {id: CAMPAIGN_ID},
      parts: [
        {id: PART_1, number: 1, scheduledFor: '2026-11-12'},
        {id: PART_2, number: 2, scheduledFor: '2026-11-13'},
      ],
    })
  })

  it('refuse un plan qui ne couvre pas exactement les destinataires', async () => {
    responses.current = [[campaignRow()], [[PART_1, 1, '2026-11-12']]]

    await expect(
      createCampaignWithRecipientsTxnDao(
        CAMPAIGN_INPUT,
        [{number: 1, scheduledFor: '2026-11-12', recipientCount: 1}],
        RECIPIENTS,
        []
      )
    ).rejects.toThrow()
  })

  it('soumission rejouée : relit la campagne existante, sans part ni destinataire', async () => {
    responses.current = [[], [campaignRow()]]

    const result = await createCampaignWithRecipientsTxnDao(
      CAMPAIGN_INPUT,
      PLAN,
      RECIPIENTS,
      []
    )

    expect(sent).toHaveLength(2)
    expect(sent[1].sql).toMatch(/^select .* from "campaign"/)
    expect(sent[1].sql).toContain('"campaign"."submission_id" = $')
    expect(
      sent.some(
        ({sql}) =>
          sql.includes('"campaign_recipient"') ||
          sql.includes('"campaign_part"')
      )
    ).toBe(false)
    expect(result).toMatchObject({
      created: false,
      campaign: {id: CAMPAIGN_ID},
      parts: [],
    })
  })
})

describe('createCampaignWithRecipientsTxnDao — fiches du courrier figées (s28, ADR 065)', () => {
  const createdResponses = () => [
    [campaignRow()],
    [
      [PART_1, 1, '2026-11-12'],
      [PART_2, 2, '2026-11-13'],
    ],
    [
      [RECIPIENT_ID, 'claire@example.fr'],
      [RECIPIENT_B, 'paul@example.fr'],
    ],
  ]

  it('écrit les fiches sans email de la campagne, dans la même transaction, après ses destinataires', async () => {
    responses.current = createdResponses()

    await createCampaignWithRecipientsTxnDao(CAMPAIGN_INPUT, PLAN, RECIPIENTS, [
      PROFILE_C,
      PROFILE_A,
      PROFILE_C,
    ])

    expect(sent).toHaveLength(5)
    expect(sent[4].sql).toMatch(/^insert into "campaign_letter_profile"/)
    expect(sent[4].params).toEqual([
      ORG_ID,
      CAMPAIGN_ID,
      PROFILE_C,
      ORG_ID,
      CAMPAIGN_ID,
      PROFILE_A,
    ])
  })

  it('aucune fiche sans email : aucune écriture de courrier', async () => {
    responses.current = createdResponses()

    await createCampaignWithRecipientsTxnDao(
      CAMPAIGN_INPUT,
      PLAN,
      RECIPIENTS,
      []
    )

    expect(sent.some(({sql}) => sql.includes('campaign_letter_profile'))).toBe(
      false
    )
  })

  it('soumission rejouée : rien n’est figé de plus', async () => {
    responses.current = [[], [campaignRow()]]

    await createCampaignWithRecipientsTxnDao(CAMPAIGN_INPUT, PLAN, RECIPIENTS, [
      PROFILE_C,
    ])

    expect(sent.some(({sql}) => sql.includes('campaign_letter_profile'))).toBe(
      false
    )
  })
})

describe('getCampaignLetterProfileIdsDao — les fiches du courrier figées (s28, ADR 065)', () => {
  it('lit les fiches figées de cette campagne, sous l’association', async () => {
    responses.current = [[[PROFILE_C], [PROFILE_A]]]

    const ids = await getCampaignLetterProfileIdsDao(ORG_ID, CAMPAIGN_ID)

    expect(sent[0].sql).toMatch(/from "campaign_letter_profile"/)
    expect(sent[0].sql).toContain(
      '"campaign_letter_profile"."organization_id" = $'
    )
    expect(sent[0].sql).toContain('"campaign_letter_profile"."campaign_id" = $')
    expect(sent[0].params).toEqual(
      expect.arrayContaining([ORG_ID, CAMPAIGN_ID])
    )
    expect(ids).toEqual([PROFILE_C, PROFILE_A])
  })
})

describe('lockCampaignScheduleTxnDao — un plan d’envoi à la fois par association', () => {
  it('pose un verrou consultatif transactionnel sur la clé de l’association', async () => {
    await lockCampaignScheduleTxnDao(ORG_ID)

    const [{sql, params}] = sent
    expect(sql).toContain('pg_advisory_xact_lock(hashtextextended(')
    expect(params).toEqual([`campaign_schedule:${ORG_ID}`])
  })
})

describe('getAllottedRecipientsByDayDao — le plafond du jour déjà pris', () => {
  it('somme les parts non échouées de toutes les campagnes, par jour, à partir d’aujourd’hui', async () => {
    responses.current = [
      [
        ['2026-11-12', 40],
        ['2026-11-13', '100'],
      ],
    ]

    const allotted = await getAllottedRecipientsByDayDao(ORG_ID, '2026-11-12')

    const [{sql, params}] = sent
    expect(sql).toContain('from "campaign_part"')
    expect(sql).toContain('sum("recipient_count")')
    expect(sql).toContain('"campaign_part"."organization_id" = $')
    expect(sql).toContain('"campaign_part"."scheduled_for" >= $')
    expect(sql).toContain('"campaign_part"."status" <> $')
    expect(sql).toContain('group by "campaign_part"."scheduled_for"')
    expect(params).toEqual(
      expect.arrayContaining([ORG_ID, '2026-11-12', 'failed'])
    )
    expect(allotted).toEqual({'2026-11-12': 40, '2026-11-13': 100})
  })

  it('compte aussi le reste reporté d’une part au jour où il part (revue s52, n° 1)', async () => {
    responses.current = [
      [
        ['2026-11-14', '100'],
        ['2026-11-15', 96],
      ],
      [['2026-11-15', '40']],
    ]

    const allotted = await getAllottedRecipientsByDayDao(ORG_ID, '2026-11-14')

    const {sql, params} = sent[1]
    expect(sql).toContain('sum("deferred_count")')
    expect(sql).toContain('"campaign_part"."organization_id" = $')
    expect(sql).toContain('"campaign_part"."deferred_to" >= $')
    expect(sql).toContain('"campaign_part"."status" <> $')
    expect(sql).toContain('group by "campaign_part"."deferred_to"')
    expect(params).toEqual(
      expect.arrayContaining([ORG_ID, '2026-11-14', 'failed'])
    )
    expect(allotted).toEqual({'2026-11-14': 100, '2026-11-15': 136})
  })
})

describe('report d’une part et glissement des suivantes (revue s52, n° 1)', () => {
  it('markCampaignPartDeferredTxnDao pose le jour du reste et le nombre de destinataires encore en attente, en une instruction', async () => {
    await markCampaignPartDeferredTxnDao(PART_1, '2026-11-15')

    const [{sql, params}] = sent
    expect(sql).toMatch(
      /^update "campaign_part" set "deferred_to" = \$1, "deferred_count" = \(select count\(\*\) from "campaign_recipient"/
    )
    expect(params).toEqual(
      expect.arrayContaining(['2026-11-15', PART_1, 'pending'])
    )
  })

  it('getSlidableCampaignPartsDao lit les parts ouvertes de l’association à partir du jour du reste, sans contenu', async () => {
    responses.current = [
      [
        [PART_1, CAMPAIGN_ID, '2026-11-14', 100, 'sending', '2026-11-15'],
        ['part-3', CAMPAIGN_ID, '2026-11-15', 96, 'scheduled', null],
      ],
    ]

    const parts = await getSlidableCampaignPartsDao(ORG_ID, '2026-11-15')

    const [{sql, params}] = sent
    expect(sql).toContain('from "campaign_part"')
    expect(sql).toContain('"campaign_part"."organization_id" = $')
    expect(sql).toContain('"campaign_part"."status" in ($')
    expect(sql).toContain('"campaign_part"."scheduled_for" >= $')
    expect(sql).toContain('"campaign_part"."deferred_to" >= $')
    expect(params).toEqual(
      expect.arrayContaining([ORG_ID, 'scheduled', 'sending', '2026-11-15'])
    )
    expect(parts).toEqual([
      {
        id: PART_1,
        campaignId: CAMPAIGN_ID,
        scheduledFor: '2026-11-14',
        recipientCount: 100,
        status: 'sending',
        deferredTo: '2026-11-15',
      },
      {
        id: 'part-3',
        campaignId: CAMPAIGN_ID,
        scheduledFor: '2026-11-15',
        recipientCount: 96,
        status: 'scheduled',
        deferredTo: null,
      },
    ])
  })

  it('moveCampaignPartTxnDao change le jour d’une part encore programmée et l’échéance de sa tâche ouverte non prise', async () => {
    const runAfter = new Date('2026-11-16T01:00:00.000Z')

    await moveCampaignPartTxnDao({
      organizationId: ORG_ID,
      partId: 'part-3',
      day: '2026-11-16',
      runAfter,
    })

    const [part, job] = sent
    expect(part.sql).toMatch(
      /^update "campaign_part" set "scheduled_for" = \$1/
    )
    expect(part.params).toEqual(
      expect.arrayContaining(['2026-11-16', 'part-3', 'scheduled'])
    )
    expect(job.sql).toMatch(/^update "scheduled_job" set "run_after" = \$1/)
    expect(job.sql).toContain('"scheduled_job"."completed_at" is null')
    expect(job.sql).toContain('"scheduled_job"."failed_at" is null')
    expect(job.sql).toContain('"scheduled_job"."locked_at" is null')
    expect(job.params).toEqual(
      expect.arrayContaining([
        runAfter.toISOString(),
        ORG_ID,
        'campaign.deliver_part',
        'part-3',
      ])
    )
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

describe('getPendingPartRecipientsDao', () => {
  it('lit l’adresse de la ligne, puis la relit active dans l’association, avec son refus et son compte (s54, ADR 057)', async () => {
    responses.current = [
      [
        [
          RECIPIENT_ID,
          ORG_ID,
          PROFILE_A,
          'Claire Aubert',
          'claire@example.fr',
          'tok',
        ],
      ],
      [[PROFILE_A, 'claire@example.fr', false, 'Claire A.']],
      [[PROFILE_A, '12']],
    ]

    const rows = await getPendingPartRecipientsDao(PART_1)

    const [{sql, params}] = sent
    expect(sql).toContain('from "campaign_recipient"')
    expect(sql).toContain('left join "member_profile"')
    expect(sql).toContain('"campaign_recipient"."email"')
    expect(sql).not.toContain('member_unsubscribe')
    expect(sql).toContain('"campaign_recipient"."part_id" = $')
    expect(sql).toContain('"campaign_recipient"."status" = $')
    expect(sql).toContain('order by "campaign_recipient"."id"')
    expect(params).toEqual(expect.arrayContaining([PART_1, 'pending']))
    expect(sent[1].sql).toContain('from "member_profile_email"')
    expect(sent[1].sql).toContain('lower(trim("member_profile_email"."email"))')
    expect(sent[1].params).toEqual(
      expect.arrayContaining([ORG_ID, 'active', 'claire@example.fr'])
    )
    expect(rows).toEqual([
      {
        recipientId: RECIPIENT_ID,
        memberProfileId: PROFILE_A,
        name: 'Claire Aubert',
        email: 'claire@example.fr',
        unsubscribeToken: 'tok',
        unsubscribed: false,
        accountName: 'Claire A.',
        parcelNumbers: ['12'],
        addressProfileCount: 1,
        memberProfileIds: [PROFILE_A],
      },
    ])
  })

  it('relit l’adresse entière : parcelles et refus de toutes ses fiches (s53, ADR 055)', async () => {
    responses.current = [
      [
        [
          RECIPIENT_ID,
          ORG_ID,
          PROFILE_A,
          'Bernard Lefèvre',
          'Bernard@example.fr',
          'tok',
        ],
      ],
      [
        [PROFILE_A, 'bernard@example.fr', false, 'Bernard L.'],
        [PROFILE_B, 'bernard@example.fr', true, 'Bernard L.'],
      ],
      [
        [PROFILE_A, '12'],
        [PROFILE_B, '31'],
      ],
    ]

    const rows = await getPendingPartRecipientsDao(PART_1)

    expect(rows).toEqual([
      expect.objectContaining({
        recipientId: RECIPIENT_ID,
        email: 'Bernard@example.fr',
        accountName: 'Bernard L.',
        unsubscribed: true,
        parcelNumbers: ['12', '31'],
        addressProfileCount: 2,
      }),
    ])
  })

  it('adresse partagée, une seule fiche ciblée figée : seule sa parcelle, à son nom (ADR 061)', async () => {
    responses.current = [
      [
        [
          RECIPIENT_ID,
          ORG_ID,
          PROFILE_B,
          'Bernard Lefèvre (27)',
          'bernard@example.fr',
          'tok',
        ],
      ],
      [
        [PROFILE_A, 'bernard@example.fr', false, 'Bernard L.'],
        [PROFILE_B, 'bernard@example.fr', false, 'Bernard L.'],
      ],
      [
        [PROFILE_A, '12'],
        [PROFILE_B, '27'],
      ],
      [[RECIPIENT_ID, PROFILE_B]],
    ]

    const rows = await getPendingPartRecipientsDao(PART_1)

    const frozen = sent.find(({sql}) =>
      sql.includes('from "campaign_recipient_profile"')
    )
    expect(frozen?.params).toEqual(expect.arrayContaining([RECIPIENT_ID]))
    expect(rows).toEqual([
      expect.objectContaining({
        recipientId: RECIPIENT_ID,
        name: 'Bernard Lefèvre (27)',
        email: 'bernard@example.fr',
        unsubscribed: false,
        parcelNumbers: ['27'],
        addressProfileCount: 1,
      }),
    ])
  })

  it('le refus porté par une fiche non ciblée de l’adresse exclut toujours l’envoi (ADR 061 §2)', async () => {
    responses.current = [
      [
        [
          RECIPIENT_ID,
          ORG_ID,
          PROFILE_B,
          'Bernard Lefèvre (27)',
          'bernard@example.fr',
          'tok',
        ],
      ],
      [
        [PROFILE_A, 'bernard@example.fr', true, 'Bernard L.'],
        [PROFILE_B, 'bernard@example.fr', false, 'Bernard L.'],
      ],
      [
        [PROFILE_A, '12'],
        [PROFILE_B, '27'],
      ],
      [[RECIPIENT_ID, PROFILE_B]],
    ]

    const rows = await getPendingPartRecipientsDao(PART_1)

    expect(rows).toEqual([
      expect.objectContaining({
        unsubscribed: true,
        parcelNumbers: ['27'],
        addressProfileCount: 1,
      }),
    ])
  })

  it('adresse retirée depuis la création : la ligne reste, sans adresse, rien ne lui sera envoyé', async () => {
    responses.current = [
      [
        [
          RECIPIENT_ID,
          ORG_ID,
          PROFILE_A,
          'Jean Dubois',
          'retiree@example.fr',
          'tok',
        ],
      ],
      [],
      [[PROFILE_A, '12']],
    ]

    const rows = await getPendingPartRecipientsDao(PART_1)

    expect(rows).toEqual([
      expect.objectContaining({
        recipientId: RECIPIENT_ID,
        memberProfileId: PROFILE_A,
        email: null,
      }),
    ])
  })

  it('garde une ligne dont la fiche a été supprimée, sans nom', async () => {
    responses.current = [
      [[RECIPIENT_ID, ORG_ID, null, null, 'claire@example.fr', 'tok']],
      [],
    ]

    const rows = await getPendingPartRecipientsDao(PART_1)

    expect(rows).toEqual([
      expect.objectContaining({
        recipientId: RECIPIENT_ID,
        memberProfileId: null,
        name: null,
        email: null,
        parcelNumbers: [],
        addressProfileCount: 1,
      }),
    ])
  })
})

describe('getCampaignPartDao', () => {
  it('lit une part par son identifiant', async () => {
    responses.current = [
      [[PART_1, CAMPAIGN_ID, 2, '2026-11-13', 100, 'scheduled']],
    ]

    const part = await getCampaignPartDao(PART_1)

    expect(sent[0].sql).toContain('from "campaign_part"')
    expect(sent[0].sql).toContain('"campaign_part"."id" = $')
    expect(part).toEqual({
      id: PART_1,
      campaignId: CAMPAIGN_ID,
      number: 2,
      scheduledFor: '2026-11-13',
      recipientCount: 100,
      status: 'scheduled',
    })
  })
})

describe('claimRecipientForSendTxnDao — « en cours d’envoi » posé avant l’envoi', () => {
  it('passe une seule ligne pending à sending, horodatée, en une instruction', async () => {
    responses.current = [[[RECIPIENT_ID]]]

    const claimed = await claimRecipientForSendTxnDao(RECIPIENT_ID)

    const [{sql, params}] = sent
    expect(sql).toMatch(/^update "campaign_recipient" set "status" = \$1/)
    expect(sql).toContain('"claimed_at" = now()')
    expect(sql).toContain('"campaign_recipient"."status" = $')
    expect(params).toEqual(['sending', RECIPIENT_ID, 'pending'])
    expect(claimed).toBe(true)
  })

  it('une ligne déjà prise ou servie n’est jamais reprise', async () => {
    await expect(claimRecipientForSendTxnDao(RECIPIENT_ID)).resolves.toBe(false)
  })
})

describe('issues d’un envoi', () => {
  it('releaseRecipientClaimTxnDao remet une ligne sending en attente (refus certain)', async () => {
    await releaseRecipientClaimTxnDao(RECIPIENT_ID)

    expect(sent[0].params).toEqual(['pending', null, RECIPIENT_ID, 'sending'])
  })

  it('markRecipientToVerifyTxnDao passe une ligne sending à vérifier', async () => {
    await markRecipientToVerifyTxnDao(RECIPIENT_ID)

    expect(sent[0].params).toEqual(['to_verify', RECIPIENT_ID, 'sending'])
  })

  it('markRecipientUnsubscribedTxnDao écarte une ligne encore en attente', async () => {
    await markRecipientUnsubscribedTxnDao(RECIPIENT_ID)

    expect(sent[0].params).toEqual(['unsubscribed', RECIPIENT_ID, 'pending'])
  })

  it('markStaleSendingRecipientsToVerifyTxnDao balaie les lignes sending trop vieilles de la part', async () => {
    const staleBefore = new Date('2026-11-12T13:17:00.000Z')
    responses.current = [[[RECIPIENT_ID]]]

    const swept = await markStaleSendingRecipientsToVerifyTxnDao(
      PART_1,
      staleBefore
    )

    const [{sql, params}] = sent
    expect(sql).toContain('"campaign_recipient"."part_id" = $')
    expect(sql).toContain('"campaign_recipient"."claimed_at" < $')
    expect(params).toEqual([
      'to_verify',
      PART_1,
      'sending',
      staleBefore.toISOString(),
    ])
    expect(swept).toBe(1)
  })

  it('markSendingRecipientsToVerifyTxnDao balaie toutes les lignes sending de la part, quel que soit leur âge (M1)', async () => {
    responses.current = [[[RECIPIENT_ID], ['autre']]]

    const swept = await markSendingRecipientsToVerifyTxnDao(PART_1)

    const [{sql, params}] = sent
    expect(sql).toContain('"campaign_recipient"."part_id" = $')
    expect(sql).not.toContain('claimed_at')
    expect(params).toEqual(['to_verify', PART_1, 'sending'])
    expect(swept).toBe(2)
  })

  it('failUnreceivedRecipientsTxnDao passe en échec les lignes encore en attente de la campagne', async () => {
    await failUnreceivedRecipientsTxnDao(CAMPAIGN_ID)

    expect(sent[0].sql).toContain('"campaign_recipient"."campaign_id" = $')
    expect(sent[0].params).toEqual(['failed', CAMPAIGN_ID, 'pending'])
  })
})

describe('états d’une part', () => {
  it('startCampaignPartTxnDao passe une part programmée en cours d’envoi', async () => {
    await startCampaignPartTxnDao(PART_1)

    expect(sent[0].sql).toContain('"campaign_part"."status" in ($')
    expect(sent[0].params).toEqual(['sending', PART_1, 'scheduled', 'sending'])
  })

  it('finishCampaignPartTxnDao clôt la part avec son statut', async () => {
    await finishCampaignPartTxnDao(PART_1, 'sent')

    expect(sent[0].sql).toContain('"finished_at" = now()')
    expect(sent[0].params).toEqual(expect.arrayContaining(['sent', PART_1]))
  })

  it('failCampaignPartsFromTxnDao passe en échec la part et les suivantes non closes', async () => {
    await failCampaignPartsFromTxnDao(CAMPAIGN_ID, 2)

    const [{sql, params}] = sent
    expect(sql).toContain('"campaign_part"."number" >= $')
    expect(sql).toContain('"campaign_part"."status" in ($')
    expect(params).toEqual(
      expect.arrayContaining(['failed', CAMPAIGN_ID, 2, 'scheduled', 'sending'])
    )
  })

  it('countUnfinishedCampaignPartsDao compte les parts ni envoyées ni échouées', async () => {
    responses.current = [[[1]]]

    const left = await countUnfinishedCampaignPartsDao(CAMPAIGN_ID)

    expect(sent[0].sql).toMatch(/^select count/)
    expect(sent[0].params).toEqual(
      expect.arrayContaining([CAMPAIGN_ID, 'scheduled', 'sending'])
    )
    expect(left).toBe(1)
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
      expect.arrayContaining(['sent', RECIPIENT_ID, 'sending'])
    )
    expect(result).toEqual({campaignId: CAMPAIGN_ID, sentCount: 1})
  })

  it('rend undefined si la ligne n’était plus en cours d’envoi', async () => {
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

describe('getCampaignPartsDao — les parts des campagnes lues', () => {
  it('lit les parts des campagnes demandées, dans l’ordre', async () => {
    responses.current = [
      [
        [PART_1, CAMPAIGN_ID, 1, '2026-11-12', 100, 'sent', null],
        ['part-2', CAMPAIGN_ID, 2, '2026-11-13', 100, 'sending', '2026-11-14'],
      ],
    ]

    const parts = await getCampaignPartsDao([CAMPAIGN_ID])

    expect(sent[0].sql).toContain('"campaign_part"."campaign_id" in ($')
    expect(sent[0].sql).toContain('"deferred_to"')
    expect(sent[0].sql).not.toContain('"scheduled_job"')
    expect(sent[0].sql).toContain(
      'order by "campaign_part"."campaign_id" asc, "campaign_part"."number" asc'
    )
    expect(parts).toEqual([
      {
        id: PART_1,
        campaignId: CAMPAIGN_ID,
        number: 1,
        scheduledFor: '2026-11-12',
        recipientCount: 100,
        status: 'sent',
        deferredTo: null,
      },
      {
        id: 'part-2',
        campaignId: CAMPAIGN_ID,
        number: 2,
        scheduledFor: '2026-11-13',
        recipientCount: 100,
        status: 'sending',
        deferredTo: '2026-11-14',
      },
    ])
  })

  it('n’interroge pas la base sans campagne', async () => {
    await expect(getCampaignPartsDao([])).resolves.toEqual([])
    expect(sent).toHaveLength(0)
  })
})

describe('getRecipientStatusCountsDao — décomptes par statut', () => {
  it('compte les lignes par campagne, part et statut', async () => {
    responses.current = [[[CAMPAIGN_ID, PART_1, 'sent', '98']]]

    const rows = await getRecipientStatusCountsDao([CAMPAIGN_ID])

    const [{sql}] = sent
    expect(sql).toContain('count(*)')
    expect(sql).toContain(
      'group by "campaign_recipient"."campaign_id", "campaign_recipient"."part_id", "campaign_recipient"."status"'
    )
    expect(rows).toEqual([
      {campaignId: CAMPAIGN_ID, partId: PART_1, status: 'sent', total: 98},
    ])
  })
})

describe('getCampaignRecipientsPageDao — la liste paginée des destinataires', () => {
  const page = (statuses: string[] | null) =>
    getCampaignRecipientsPageDao({
      organizationId: ORG_ID,
      campaignId: CAMPAIGN_ID,
      statuses: statuses as never,
      limit: 25,
      offset: 25,
    })

  it('bornée à la campagne et à l’association, triée par nom puis identifiant, sans jeton', async () => {
    responses.current = [
      [
        [
          RECIPIENT_ID,
          PROFILE_A,
          'Claire Aubert',
          'to_verify',
          null,
          '2026-11-13',
        ],
      ],
      [[26]],
      [[PROFILE_A, '12']],
    ]

    const {rows, total} = await page(['to_verify'])

    const [{sql, params}] = sent
    expect(sql).toContain('left join "member_profile"')
    expect(sql).toContain('inner join "campaign_part"')
    expect(sql).toContain('"campaign_recipient"."organization_id" = $')
    expect(sql).toContain('"campaign_recipient"."campaign_id" = $')
    expect(sql).toContain('"campaign_recipient"."status" in ($')
    expect(sql).toContain(
      'order by "member_profile"."name" asc nulls last, "campaign_recipient"."id" asc'
    )
    expect(sql).not.toContain('unsubscribe_token')
    expect(params).toEqual(
      expect.arrayContaining([ORG_ID, CAMPAIGN_ID, 'to_verify', 25])
    )
    expect(sent[1].sql).toMatch(/^select count/)
    expect(total).toBe(26)
    expect(rows).toEqual([
      {
        id: RECIPIENT_ID,
        name: 'Claire Aubert',
        status: 'to_verify',
        sentAt: null,
        scheduledFor: '2026-11-13',
        parcelNumbers: ['12'],
      },
    ])
  })

  it('« Tous » ne filtre pas sur le statut', async () => {
    responses.current = [[], [[0]]]

    await page(null)

    expect(sent[0].sql).not.toContain('"campaign_recipient"."status" in')
  })

  it('une ligne dont la fiche a été supprimée apparaît, sans nom', async () => {
    responses.current = [
      [[RECIPIENT_ID, null, null, 'sent', NOW.toISOString(), '2026-11-12']],
      [[1]],
    ]

    const {rows} = await page(null)

    expect(rows).toEqual([
      expect.objectContaining({
        id: RECIPIENT_ID,
        name: null,
        parcelNumbers: [],
      }),
    ])
  })
})

describe('getOpenCampaignPartsDao — parts non closes et leur report (s52, envois en attente)', () => {
  it('lit les parts ouvertes de l’association, leur campagne, le jour de leur reste reporté et leurs destinataires en attente', async () => {
    responses.current = [
      [
        [
          PART_1,
          CAMPAIGN_ID,
          'Convocation',
          3,
          3,
          '2026-11-14',
          'sending',
          '2026-11-15',
          40,
        ],
      ],
    ]

    const parts = await getOpenCampaignPartsDao(ORG_ID)

    const [{sql, params}] = sent
    expect(sql).toContain('from "campaign_part"')
    expect(sql).toContain('inner join "campaign" on')
    expect(sql).not.toContain('"scheduled_job"')
    expect(sql).toContain('"campaign_part"."organization_id" = $')
    expect(sql).toContain('"campaign_part"."status" in ($')
    expect(sql).not.toMatch(/"email"|"unsubscribe_token"|"body_markdown"/)
    expect(params).toEqual(
      expect.arrayContaining([ORG_ID, 'scheduled', 'sending', 'pending'])
    )
    expect(parts).toEqual([
      {
        partId: PART_1,
        campaignId: CAMPAIGN_ID,
        campaignSubject: 'Convocation',
        number: 3,
        partCount: 3,
        scheduledFor: '2026-11-14',
        status: 'sending',
        deferredTo: '2026-11-15',
        pendingCount: 40,
      },
    ])
  })

  it('compte les parts de la campagne dans une sous-requête qui nomme la vraie table campaign_part', async () => {
    responses.current = [[]]

    await getOpenCampaignPartsDao(ORG_ID)

    const [{sql}] = sent
    expect(sql).toContain(
      '(select count(*) from "campaign_part" "sibling_part" where "sibling_part"."campaign_id" = "campaign_part"."campaign_id")'
    )
  })
})

describe('createCampaignWithRecipientsTxnDao — rang d’une relance d’impayé (s29, ADR 070 §6)', () => {
  const createdResponses = () => [
    [campaignRow()],
    [],
    [
      [PART_1, 1, '2026-11-12'],
      [PART_2, 2, '2026-11-13'],
    ],
    [
      [RECIPIENT_ID, 'claire@example.fr'],
      [RECIPIENT_B, 'paul@example.fr'],
    ],
  ]

  it('écrit le rang dans la même transaction, juste après la campagne', async () => {
    responses.current = createdResponses()

    await createCampaignWithRecipientsTxnDao(
      CAMPAIGN_INPUT,
      PLAN,
      RECIPIENTS,
      [],
      {dueOn: '2026-03-31', rank: 2}
    )

    expect(sent[0].sql).toMatch(/^insert into "campaign"/)
    expect(sent[1].sql).toMatch(/^insert into "unpaid_reminder"/)
    expect(sent[1].params).toEqual(
      expect.arrayContaining([ORG_ID, '2026-03-31', 2, CAMPAIGN_ID])
    )
  })

  it('soumission rejouée : ni campagne ni rang de plus', async () => {
    responses.current = [[], [campaignRow()]]

    const result = await createCampaignWithRecipientsTxnDao(
      CAMPAIGN_INPUT,
      PLAN,
      RECIPIENTS,
      [],
      {dueOn: '2026-03-31', rank: 1}
    )

    expect(sent.some(({sql}) => sql.includes('unpaid_reminder'))).toBe(false)
    expect(result).toMatchObject({created: false})
  })

  it('une relance sans destinataire email garde son rang et ses fiches du courrier', async () => {
    responses.current = [[campaignRow()], []]

    const result = await createCampaignWithRecipientsTxnDao(
      {...CAMPAIGN_INPUT, recipientCount: 0},
      [],
      [],
      [PROFILE_C],
      {dueOn: '2026-03-31', rank: 1}
    )

    expect(sent.map(({sql}) => sql.split(' ').slice(0, 3).join(' '))).toEqual([
      'insert into "campaign"',
      'insert into "unpaid_reminder"',
      'insert into "campaign_letter_profile"',
    ])
    expect(result).toMatchObject({created: true, parts: []})
  })

  it('une campagne manuelle n’écrit aucun rang', async () => {
    responses.current = [
      [campaignRow()],
      [
        [PART_1, 1, '2026-11-12'],
        [PART_2, 2, '2026-11-13'],
      ],
      [
        [RECIPIENT_ID, 'claire@example.fr'],
        [RECIPIENT_B, 'paul@example.fr'],
      ],
    ]

    await createCampaignWithRecipientsTxnDao(
      CAMPAIGN_INPUT,
      PLAN,
      RECIPIENTS,
      []
    )

    expect(sent.some(({sql}) => sql.includes('unpaid_reminder'))).toBe(false)
  })
})

describe('markRecipientSettledTxnDao — réglée avant l’envoi (s29, ADR 070 §3)', () => {
  it('passe la seule ligne en attente à settled, sans rien envoyer', async () => {
    responses.current = [[[RECIPIENT_ID]]]

    const row = await markRecipientSettledTxnDao(RECIPIENT_ID)

    expect(sent[0].sql).toMatch(
      /^update "campaign_recipient" set "status" = \$1/
    )
    expect(sent[0].params).toEqual(['settled', RECIPIENT_ID, 'pending'])
    expect(row).toEqual({id: RECIPIENT_ID})
  })
})

describe('getPendingPartRecipientsDao — les fiches que la ligne représente (s29, ADR 070 §3)', () => {
  it('rend les fiches ciblées figées de l’adresse : la relance relit leurs factures', async () => {
    responses.current = [
      [
        [
          RECIPIENT_ID,
          ORG_ID,
          PROFILE_A,
          'Bernard Lefèvre',
          'bernard@example.fr',
          'tok',
        ],
      ],
      [
        [PROFILE_A, 'bernard@example.fr', false, 'Bernard L.'],
        [PROFILE_B, 'bernard@example.fr', false, 'Bernard L.'],
        [PROFILE_C, 'bernard@example.fr', false, 'Bernard L.'],
      ],
      [],
      [
        [RECIPIENT_ID, PROFILE_A],
        [RECIPIENT_ID, PROFILE_B],
      ],
    ]

    const [row] = await getPendingPartRecipientsDao(PART_1)

    expect(row.memberProfileIds).toEqual([PROFILE_A, PROFILE_B])
  })
})

describe('lignes d’une invitation (s42b, ADR 072 §4, §5)', () => {
  it('markClaimedRecipientFailedTxnDao passe en échec la seule ligne prise (sending)', async () => {
    responses.current = [[[RECIPIENT_ID]]]

    const row = await markClaimedRecipientFailedTxnDao(RECIPIENT_ID)

    expect(sent[0].sql).toMatch(
      /^update "campaign_recipient" set "status" = \$1/
    )
    expect(sent[0].params).toEqual(['failed', RECIPIENT_ID, 'sending'])
    expect(row).toEqual({id: RECIPIENT_ID})
  })

  it('markRecipientSupersededTxnDao écarte la seule ligne en attente, sans rien envoyer', async () => {
    responses.current = [[[RECIPIENT_ID]]]

    const row = await markRecipientSupersededTxnDao(RECIPIENT_ID)

    expect(sent[0].params).toEqual(['superseded', RECIPIENT_ID, 'pending'])
    expect(row).toEqual({id: RECIPIENT_ID})
  })
})

describe('getCampaignsByTemplateIdsDao (s42b)', () => {
  it('lit les campagnes de ces types dans l’association, la plus ancienne d’abord', async () => {
    await getCampaignsByTemplateIdsDao(ORG_ID, [
      'member_invitation_launch',
      'member_invitation_reminder',
    ])

    expect(sent[0].sql).toContain('"campaign"."organization_id" = $1')
    expect(sent[0].sql).toMatch(/"campaign"\."template_id" in \(\$2, \$3\)/)
    expect(sent[0].sql).toMatch(/order by "campaign"\."created_at" asc/)
    expect(sent[0].params).toEqual([
      ORG_ID,
      'member_invitation_launch',
      'member_invitation_reminder',
    ])
  })
})
