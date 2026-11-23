import {beforeEach, describe, expect, it, vi} from 'vitest'

const scope = vi.hoisted(() => ({current: undefined as string | undefined}))

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (organizationId: string, callback: () => unknown) => {
    scope.current = organizationId
    try {
      return await callback()
    } finally {
      scope.current = undefined
    }
  }),
}))
vi.mock('@/db/repositories/campaign-repository', () => ({
  getCampaignTargetRowsDao: vi.fn(),
  getCurrentParcelNumbersForMembersDao: vi.fn(),
  createCampaignWithRecipientsTxnDao: vi.fn(),
  lockCampaignScheduleTxnDao: vi.fn(),
  getAllottedRecipientsByDayDao: vi.fn(),
  finishCampaignTxnDao: vi.fn(),
  getCampaignByIdDao: vi.fn(),
  getCampaignPartsDao: vi.fn(),
  getRecipientStatusCountsDao: vi.fn(),
}))
vi.mock('@/db/repositories/unpaid-reminder-repository', () => ({
  listUnpaidRemindersDao: vi.fn(),
  getReminderRecipientsByProfileDao: vi.fn(),
}))
vi.mock('@/db/repositories/scheduled-job-repository', () => ({
  enqueueScheduledJobTxnDao: vi.fn(),
}))
vi.mock('@/db/repositories/recipient-group-repository', () => ({
  getRecipientGroupByIdDao: vi.fn(),
  getRecipientGroupMemberIdsDao: vi.fn(),
  listRecipientGroupsDao: vi.fn(),
}))
vi.mock('@/db/repositories/organization-repository', () => ({
  getOrganizationByIdDao: vi.fn(),
}))
vi.mock('../billing/resolve-member-billing-provider', () => ({
  resolveMemberBillingProvider: vi.fn(),
}))
vi.mock('../scheduled-job-service', () => ({
  runDueScheduledJobsService: vi.fn(),
}))
vi.mock('../association-settings-service', () => ({
  getAssociationSettingsService: vi.fn(),
}))
vi.mock('../email-service', () => ({
  sendEmailService: vi.fn(),
  isClientEmailEnabledService: vi.fn(),
  readEmailTagStatisticsService: vi.fn(),
}))
vi.mock('@/lib/emails/campaign-email', () => ({
  default: vi.fn(async () => null),
  getCampaignFooterTexts: vi.fn(),
}))
vi.mock('react-email', () => ({render: vi.fn()}))

import {
  createCampaignWithRecipientsTxnDao,
  finishCampaignTxnDao,
  getAllottedRecipientsByDayDao,
  getCampaignByIdDao,
  getCampaignPartsDao,
  getCampaignTargetRowsDao,
  getRecipientStatusCountsDao,
  lockCampaignScheduleTxnDao,
} from '@/db/repositories/campaign-repository'
import {enqueueScheduledJobTxnDao} from '@/db/repositories/scheduled-job-repository'
import {
  getReminderRecipientsByProfileDao,
  listUnpaidRemindersDao,
} from '@/db/repositories/unpaid-reminder-repository'
import {withTenant} from '@/db/tenant-scope'

import {getAssociationSettingsService} from '../association-settings-service'
import {resolveMemberBillingProvider} from '../billing/resolve-member-billing-provider'
import {AuthorizationError} from '../errors/authorization-error'
import {reminderSubmissionIdOf} from '../rules/unpaid-reminder-rules'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  resolveSettings,
} from '../types/domain/association-settings-types'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import type {MemberInvoice} from '../types/domain/member-invoice-types'
import {OrganizationRole} from '../types/domain/organization-types'
import type {ScheduledJob} from '../types/domain/scheduled-job-types'
import {User} from '../types/domain/user-types'
import {
  getUnpaidRemindersOverviewService,
  runUnpaidRemindersJobService,
  scheduleUnpaidRemindersService,
} from '../unpaid-reminder-service'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const CAMPAIGN_R1 = '33333333-3333-4333-8333-333333333333'
const PROFILE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PROFILE_A2 = 'abababab-abab-4bab-8bab-abababababab'
const PROFILE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PROFILE_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const PROFILE_D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const PROFILE_E = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const PROFILE_F = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

const DUE = '2026-03-31'
const OTHER_DUE = '2026-06-30'
/** 21/04/2026, 10:00 a Paris : R1 de l'echeance du 31/03 est du. */
const NOW = new Date('2026-04-21T08:00:00.000Z')

const UNPAID = 'En attente'
const SETTLED = 'Payée'

const withRole = (role: OrganizationRole, organizationId = ORG_ID): User => ({
  ...userTest,
  organizations: [
    {
      id: 'membership',
      organizationId,
      userId: userTest.id,
      role,
      createdAt: new Date(),
    },
  ],
})

const job = (overrides: Partial<ScheduledJob> = {}): ScheduledJob => ({
  id: 'job-1',
  organizationId: ORG_ID,
  kind: 'billing.unpaid_reminders',
  payload: {day: '2026-04-21'},
  attempts: 1,
  resumedAfterStaleLock: false,
  ...overrides,
})

const NO_LETTER_ADDRESS = {
  homeAddressLine: null,
  homeAddressComplement: null,
  homePostalCode: null,
  homeCity: null,
  landAddressLine: null,
  landAddressComplement: null,
  landPostalCode: null,
  landCity: null,
  companyName: null,
}

const row = (
  memberProfileId: string,
  name: string,
  email: string | null,
  overrides: Record<string, unknown> = {}
) => ({
  memberProfileId,
  name,
  email,
  unsubscribed: false,
  currentParcelNumbers: ['12'],
  accountName: null,
  ...NO_LETTER_ADDRESS,
  ...overrides,
})

const targetRows = () => [
  row(PROFILE_A, 'Claire Aubert', 'claire@example.fr'),
  row(PROFILE_B, 'Paul Renaud', 'paul@example.fr'),
  row(PROFILE_C, 'Sans Email', null, {currentParcelNumbers: ['30']}),
  row(PROFILE_D, 'Désinscrite', 'd@example.fr', {unsubscribed: true}),
  row(PROFILE_E, 'Autre Échéance', 'e@example.fr'),
  row(PROFILE_F, 'À Classer', 'f@example.fr'),
]

const invoice = (
  memberProfileId: string,
  status: string,
  overrides: Partial<MemberInvoice> = {}
): MemberInvoice => ({
  id: `inv-${memberProfileId.slice(0, 4)}-${overrides.dueOn ?? DUE}`,
  memberProfileId,
  parcelId: null,
  parcelNumber: '12',
  meterNumber: null,
  source: 'site',
  year: 2026,
  issuedOn: '2026-02-15',
  dueOn: DUE,
  amountCents: 32000,
  status,
  hasPdf: false,
  paymentUrl: null,
  ...overrides,
})

const invoices = () => [
  invoice(PROFILE_A, UNPAID),
  invoice(PROFILE_B, SETTLED),
  invoice(PROFILE_C, UNPAID),
  invoice(PROFILE_D, UNPAID),
  invoice(PROFILE_E, UNPAID, {dueOn: OTHER_DUE}),
  invoice(PROFILE_F, 'Relance 1'),
]

const REMINDER_ROWS = [
  {key: 'billing.unpaid_statuses', value: UNPAID},
  {key: 'billing.settled_statuses', value: SETTLED},
  {key: 'billing.reminder.enabled', value: 'true'},
  {key: 'billing.reminder.delay_weeks.1', value: '3'},
  {key: 'billing.reminder.delay_weeks.2', value: '2'},
  {key: 'billing.reminder.delay_weeks.3', value: '1'},
  {key: 'billing.reminder.subject', value: 'Facture impayée'},
  {key: 'billing.reminder.body', value: 'Bonjour {nom},\n\n{factures}'},
  {key: 'campaign.nature.unpaid_reminder', value: 'statutaire'},
]

const settingsWith = (rows: {key: string; value: string}[] = REMINDER_ROWS) =>
  resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, rows)

const provider = {
  id: 'manual',
  canWrite: true,
  listInvoicesOf: vi.fn(),
}

/** Une base en memoire : une campagne par soumission, son rang avec elle. */
const store = {
  submissions: new Map<string, string>(),
  reminders: [] as {dueOn: string; rank: number; campaignId: string}[],
}

const createdCalls = () =>
  vi.mocked(createCampaignWithRecipientsTxnDao).mock.calls

beforeEach(() => {
  vi.clearAllMocks()
  store.submissions.clear()
  store.reminders = []
  vi.mocked(getAssociationSettingsService).mockResolvedValue(settingsWith())
  vi.mocked(resolveMemberBillingProvider).mockReturnValue(provider)
  provider.listInvoicesOf.mockResolvedValue(invoices())
  vi.mocked(getCampaignTargetRowsDao).mockResolvedValue(targetRows())
  vi.mocked(getAllottedRecipientsByDayDao).mockResolvedValue({})
  vi.mocked(listUnpaidRemindersDao).mockImplementation(async () =>
    store.reminders.map((reminder) => ({
      ...reminder,
      campaignStatus: 'sending' as const,
      lastSentOn: null,
    }))
  )
  vi.mocked(createCampaignWithRecipientsTxnDao).mockImplementation(
    async (input, plan, _recipients, _letters, unpaidReminder) => {
      expect(scope.current).toBe(ORG_ID)
      const existing = store.submissions.get(input.submissionId)
      if (existing) {
        return {
          campaign: {id: existing} as never,
          created: false,
          parts: [],
        }
      }
      const id = `campaign-${store.submissions.size + 1}`
      store.submissions.set(input.submissionId, id)
      if (unpaidReminder)
        store.reminders.push({...unpaidReminder, campaignId: id})
      return {
        campaign: {id} as never,
        created: true,
        parts: plan.map((part) => ({
          id: `${id}-part-${part.number}`,
          number: part.number,
          scheduledFor: part.scheduledFor,
        })),
      }
    }
  )
})

const recipientEmailsOf = (call = 0) =>
  createdCalls()[call][2].map((recipient) => recipient.email)

describe('runUnpaidRemindersJobService — tâche quotidienne sans session (ADR 070 §4)', () => {
  it('désactivée : rien n’est créé, la tâche se termine sans se reprogrammer (critère 2)', async () => {
    vi.mocked(getAssociationSettingsService).mockResolvedValue(
      settingsWith(
        REMINDER_ROWS.map((setting) =>
          setting.key === 'billing.reminder.enabled'
            ? {...setting, value: 'false'}
            : setting
        )
      )
    )

    const outcome = await runUnpaidRemindersJobService(job(), NOW)

    expect(outcome).toEqual({status: 'completed'})
    expect(provider.listInvoicesOf).not.toHaveBeenCalled()
    expect(createCampaignWithRecipientsTxnDao).not.toHaveBeenCalled()
    expect(enqueueScheduledJobTxnDao).not.toHaveBeenCalled()
  })

  it('activée : la cible ne contient que les impayés de cette échéance, ni à jour, ni à classer, ni une autre échéance (critère 7)', async () => {
    const outcome = await runUnpaidRemindersJobService(job(), NOW)

    expect(outcome).toEqual({status: 'completed'})
    expect(createCampaignWithRecipientsTxnDao).toHaveBeenCalledOnce()
    expect(recipientEmailsOf()).toEqual(['claire@example.fr', 'd@example.fr'])
    const [input, , , letters, unpaidReminder] = createdCalls()[0]
    expect(input).toMatchObject({
      organizationId: ORG_ID,
      submissionId: reminderSubmissionIdOf(ORG_ID, DUE, 1),
      subject: 'Facture impayée',
      preheader: null,
      bodyMarkdown: 'Bonjour {nom},\n\n{factures}',
      templateId: 'unpaid_reminder',
      nature: 'statutaire',
      targetKind: 'unpaid_members',
      authorUserId: null,
      authorName: null,
      status: 'sending',
      sendDate: '2026-04-21',
    })
    expect(letters).toEqual([PROFILE_C])
    expect(unpaidReminder).toEqual({dueOn: DUE, rank: 1})
    expect(lockCampaignScheduleTxnDao).toHaveBeenCalledWith(ORG_ID)
  })

  it('programme le jour suivant ; la clé de la tâche est le jour', async () => {
    await runUnpaidRemindersJobService(job(), NOW)

    expect(enqueueScheduledJobTxnDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      kind: 'billing.unpaid_reminders',
      idempotencyKey: '2026-04-22',
      runAfter: new Date('2026-04-22T00:00:00.000Z'),
      payload: {day: '2026-04-22'},
    })
  })

  it('une part de la relance est programmée par le planificateur (tâche `campaign.deliver_part`)', async () => {
    await runUnpaidRemindersJobService(job(), NOW)

    expect(enqueueScheduledJobTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'campaign.deliver_part',
        idempotencyKey: 'campaign-1-part-1',
      })
    )
  })

  it('factures illisibles : `retry`, rien n’est créé, jamais « tous »', async () => {
    provider.listInvoicesOf.mockRejectedValue(new Error('Pennylane 503'))

    const outcome = await runUnpaidRemindersJobService(job({attempts: 2}), NOW)

    expect(outcome).toEqual({
      status: 'retry',
      runAfter: new Date(NOW.getTime() + 2 * 30 * 60 * 1000),
    })
    expect(createCampaignWithRecipientsTxnDao).not.toHaveBeenCalled()
    expect(enqueueScheduledJobTxnDao).not.toHaveBeenCalled()
  })

  it('rejeu : même jour deux fois, crash après la création puis reprise — une seule campagne, un seul rang (critère 4)', async () => {
    await runUnpaidRemindersJobService(job(), NOW)
    await runUnpaidRemindersJobService(job(), NOW)

    vi.mocked(listUnpaidRemindersDao).mockResolvedValueOnce([])
    await runUnpaidRemindersJobService(
      job({resumedAfterStaleLock: true, attempts: 2}),
      NOW
    )

    expect(store.submissions.size).toBe(1)
    expect(store.reminders).toEqual([
      {dueOn: DUE, rank: 1, campaignId: 'campaign-1'},
    ])
    expect(
      createdCalls().every(
        ([input]) =>
          input.submissionId === reminderSubmissionIdOf(ORG_ID, DUE, 1)
      )
    ).toBe(true)
  })

  it('rang précédent pas terminé : rien de dû, même des semaines plus tard', async () => {
    store.reminders = [{dueOn: DUE, rank: 1, campaignId: CAMPAIGN_R1}]

    await runUnpaidRemindersJobService(
      job(),
      new Date('2026-06-01T08:00:00.000Z')
    )

    expect(createCampaignWithRecipientsTxnDao).not.toHaveBeenCalled()
  })

  it('facture réglée entre R1 et R2 : absente de R2 (critère 3)', async () => {
    vi.mocked(listUnpaidRemindersDao).mockResolvedValue([
      {
        dueOn: DUE,
        rank: 1,
        campaignId: CAMPAIGN_R1,
        campaignStatus: 'sent',
        lastSentOn: '2026-04-21',
      },
    ])
    provider.listInvoicesOf.mockResolvedValue([
      invoice(PROFILE_A, SETTLED),
      invoice(PROFILE_B, UNPAID),
    ])

    await runUnpaidRemindersJobService(
      job(),
      new Date('2026-05-05T08:00:00.000Z')
    )

    expect(recipientEmailsOf()).toEqual(['paul@example.fr'])
    expect(createdCalls()[0][4]).toEqual({dueOn: DUE, rank: 2})
    expect(createdCalls()[0][0].submissionId).toBe(
      reminderSubmissionIdOf(ORG_ID, DUE, 2)
    )
  })

  it.each([
    ['statutaire', ['claire@example.fr', 'd@example.fr']],
    ['facultative', ['claire@example.fr']],
  ] as const)(
    'nature %s : la ligne du désinscrit en impayé est réintégrée ou exclue (critère 8)',
    async (nature, expected) => {
      vi.mocked(getAssociationSettingsService).mockResolvedValue(
        settingsWith(
          REMINDER_ROWS.map((setting) =>
            setting.key === 'campaign.nature.unpaid_reminder'
              ? {...setting, value: nature}
              : setting
          )
        )
      )

      await runUnpaidRemindersJobService(job(), NOW)

      expect(recipientEmailsOf()).toEqual(expected)
      expect(createdCalls()[0][0].nature).toBe(nature)
    }
  )

  it('une adresse portée par deux fiches impayées : une seule ligne, les deux fiches (critère 6)', async () => {
    vi.mocked(getCampaignTargetRowsDao).mockResolvedValue([
      row(PROFILE_A, 'Claire Aubert', 'foyer@example.fr'),
      row(PROFILE_A2, 'Jean Aubert', 'foyer@example.fr'),
    ])
    provider.listInvoicesOf.mockResolvedValue([
      invoice(PROFILE_A, UNPAID),
      invoice(PROFILE_A2, UNPAID),
    ])

    await runUnpaidRemindersJobService(job(), NOW)

    const recipients = createdCalls()[0][2]
    expect(recipients).toHaveLength(1)
    expect(recipients[0].memberProfileIds.sort()).toEqual(
      [PROFILE_A, PROFILE_A2].sort()
    )
  })

  it('une fiche sans email va au courrier de la relance (critère 10)', async () => {
    provider.listInvoicesOf.mockResolvedValue([invoice(PROFILE_C, UNPAID)])

    await runUnpaidRemindersJobService(job(), NOW)

    const [input, plan, recipients, letters] = createdCalls()[0]
    expect(recipients).toEqual([])
    expect(plan).toEqual([])
    expect(letters).toEqual([PROFILE_C])
    expect(input.withoutEmailCount).toBe(1)
    expect(finishCampaignTxnDao).toHaveBeenCalledWith('campaign-1', 'sent')
  })

  it('aucun impayé : rien n’est créé, le jour suivant est programmé', async () => {
    provider.listInvoicesOf.mockResolvedValue([invoice(PROFILE_A, SETTLED)])

    await runUnpaidRemindersJobService(job(), NOW)

    expect(createCampaignWithRecipientsTxnDao).not.toHaveBeenCalled()
    expect(enqueueScheduledJobTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({idempotencyKey: '2026-04-22'})
    )
  })
})

describe('scheduleUnpaidRemindersService — la tâche existe dès l’activation', () => {
  it.each([
    ['[SUPER_ADMIN]', userTestSuperAdmin],
    ['[ORGANIZATION OWNER]', withRole(UserOrganizationRoleConst.OWNER)],
    ['[ORGANIZATION BOARD]', withRole(UserOrganizationRoleConst.ADMIN)],
  ])(
    '%s programme aujourd’hui et demain, clés = les jours',
    async (_label, user) => {
      await setupAuthUserMocked(user)

      await scheduleUnpaidRemindersService(ORG_ID, NOW)

      expect(enqueueScheduledJobTxnDao).toHaveBeenCalledWith({
        organizationId: ORG_ID,
        kind: 'billing.unpaid_reminders',
        idempotencyKey: '2026-04-21',
        runAfter: NOW,
        payload: {day: '2026-04-21'},
      })
      expect(enqueueScheduledJobTxnDao).toHaveBeenCalledWith(
        expect.objectContaining({idempotencyKey: '2026-04-22'})
      )
      expect(withTenant).toHaveBeenCalledWith(ORG_ID, expect.any(Function))
    }
  )

  it('relance désactivée : aucune tâche', async () => {
    await setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))
    vi.mocked(getAssociationSettingsService).mockResolvedValue(settingsWith([]))

    await scheduleUnpaidRemindersService(ORG_ID, NOW)

    expect(enqueueScheduledJobTxnDao).not.toHaveBeenCalled()
  })

  it.each([
    ['[ORGANIZATION MEMBER]', withRole(UserOrganizationRoleConst.MEMBER)],
    [
      '[USER NOT IN ORGANIZATION]',
      withRole(UserOrganizationRoleConst.OWNER, OTHER_ORG_ID),
    ],
    ['[PUBLIC]', undefined],
  ])('%s refusé, rien n’est programmé', async (_label, user) => {
    await setupAuthUserMocked(user)

    await expect(scheduleUnpaidRemindersService(ORG_ID, NOW)).rejects.toThrow(
      AuthorizationError
    )
    expect(enqueueScheduledJobTxnDao).not.toHaveBeenCalled()
  })
})

describe('getUnpaidRemindersOverviewService — la page de suivi (critère 9)', () => {
  const r1Campaign = {
    id: CAMPAIGN_R1,
    organizationId: ORG_ID,
    submissionId: reminderSubmissionIdOf(ORG_ID, DUE, 1),
    subject: 'Facture impayée',
    preheader: null,
    bodyMarkdown: 'Bonjour',
    templateId: 'unpaid_reminder',
    nature: 'statutaire' as const,
    targetKind: 'unpaid_members',
    targetGroupId: null,
    targetGroupName: null,
    recipientCount: 2,
    withoutEmailCount: 1,
    unsubscribedCount: 0,
    sentCount: 2,
    status: 'sent' as const,
    sendDate: '2026-04-21',
    authorUserId: null,
    authorName: null,
    onBehalfOfUserId: null,
    onBehalfOfName: null,
    createdAt: new Date('2026-04-21T00:05:00Z'),
    updatedAt: new Date('2026-04-21T00:05:00Z'),
    finishedAt: new Date('2026-04-21T01:00:00Z'),
  }

  beforeEach(() => {
    vi.mocked(listUnpaidRemindersDao).mockResolvedValue([
      {
        dueOn: DUE,
        rank: 1,
        campaignId: CAMPAIGN_R1,
        campaignStatus: 'sent',
        lastSentOn: '2026-04-21',
      },
    ])
    vi.mocked(getCampaignByIdDao).mockResolvedValue(r1Campaign as never)
    vi.mocked(getCampaignPartsDao).mockResolvedValue([
      {
        id: 'part-1',
        campaignId: CAMPAIGN_R1,
        number: 1,
        scheduledFor: '2026-04-21',
        recipientCount: 2,
        status: 'sent',
        deferredTo: null,
      },
    ])
    vi.mocked(getRecipientStatusCountsDao).mockResolvedValue([
      {campaignId: CAMPAIGN_R1, partId: 'part-1', status: 'sent', total: 2},
    ])
    vi.mocked(getReminderRecipientsByProfileDao).mockResolvedValue({
      emails: [
        {
          campaignId: CAMPAIGN_R1,
          memberProfileId: PROFILE_A,
          sentAt: new Date('2026-04-21T06:00:00Z'),
        },
      ],
      letters: [{campaignId: CAMPAIGN_R1, memberProfileId: PROFILE_C}],
    })
  })

  it('[ORGANIZATION BOARD] par échéance, les rangs et leurs dates ; par fiche, nom, parcelle, factures et relances', async () => {
    await setupAuthUserMocked(withRole(UserOrganizationRoleConst.ADMIN))

    const overview = await getUnpaidRemindersOverviewService({
      organizationId: ORG_ID,
      page: 1,
    })

    expect(overview.status).toBe('ready')
    if (overview.status !== 'ready') return
    expect(overview).toMatchObject({
      enabled: true,
      delaysWeeks: [3, 2, 1],
      rankCount: 3,
      counts: {unpaid: 4, byEmail: 3, byLetter: 1},
    })
    expect(overview.schedules.map((schedule) => schedule.dueOn)).toEqual([
      DUE,
      OTHER_DUE,
    ])
    expect(overview.schedules[0].ranks).toEqual([
      {
        rank: 1,
        status: 'created',
        campaignId: CAMPAIGN_R1,
        day: '2026-04-21',
        displayState: 'sent',
        recipientCount: 2,
        letterCount: 1,
        receivedCount: 2,
        deferredCount: 0,
        deferredUntil: null,
      },
      {rank: 2, status: 'scheduled', day: '2026-05-05'},
      {rank: 3, status: 'upcoming', day: '2026-05-12'},
    ])
    expect(overview.members.items.map((member) => member.name)).toEqual([
      'Autre Échéance',
      'Claire Aubert',
      'Désinscrite',
      'Sans Email',
    ])
    const claire = overview.members.items[1]
    expect(claire).toEqual({
      id: PROFILE_A,
      name: 'Claire Aubert',
      parcelNumbers: ['12'],
      invoices: [{issuedOn: '2026-02-15', dueOn: DUE, parcelNumber: '12'}],
      reminders: [{rank: 1, day: '2026-04-21', channel: 'email'}],
      channel: 'email',
    })
    expect(overview.members.items[3]).toMatchObject({
      id: PROFILE_C,
      channel: 'letter',
      reminders: [{rank: 1, day: '2026-04-21', channel: 'letter'}],
    })
    expect(JSON.stringify(overview)).not.toMatch(/@example\.fr/)
    expect(overview.members).toMatchObject({page: 1, total: 4, totalPages: 1})
  })

  it('relance désactivée : les rangs à venir disent « Non programmée »', async () => {
    await setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))
    vi.mocked(getAssociationSettingsService).mockResolvedValue(
      settingsWith(
        REMINDER_ROWS.filter(
          (setting) => setting.key !== 'billing.reminder.enabled'
        )
      )
    )

    const overview = await getUnpaidRemindersOverviewService({
      organizationId: ORG_ID,
      page: 1,
    })

    expect(overview.status === 'ready' && overview.enabled).toBe(false)
    expect(
      overview.status === 'ready' &&
        overview.schedules[0].ranks.map((rank) => rank.status)
    ).toEqual(['created', 'not_scheduled', 'not_scheduled'])
  })

  it('factures illisibles : `unavailable`, jamais une liste vide', async () => {
    await setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))
    provider.listInvoicesOf.mockRejectedValue(new Error('Pennylane 503'))

    const overview = await getUnpaidRemindersOverviewService({
      organizationId: ORG_ID,
      page: 1,
    })

    expect(overview).toEqual({
      status: 'unavailable',
      enabled: true,
      delaysWeeks: [3, 2, 1],
    })
  })

  it.each([
    ['[SUPER_ADMIN]', userTestSuperAdmin],
    ['[ORGANIZATION OWNER]', withRole(UserOrganizationRoleConst.OWNER)],
  ])('%s lit la page', async (_label, user) => {
    await setupAuthUserMocked(user)

    const overview = await getUnpaidRemindersOverviewService({
      organizationId: ORG_ID,
      page: 1,
    })

    expect(overview.status).toBe('ready')
  })

  it.each([
    ['[ORGANIZATION MEMBER]', withRole(UserOrganizationRoleConst.MEMBER)],
    [
      '[USER NOT IN ORGANIZATION]',
      withRole(UserOrganizationRoleConst.OWNER, OTHER_ORG_ID),
    ],
    ['[PUBLIC]', undefined],
  ])('%s refusé, aucune lecture', async (_label, user) => {
    await setupAuthUserMocked(user)

    await expect(
      getUnpaidRemindersOverviewService({organizationId: ORG_ID, page: 1})
    ).rejects.toThrow(AuthorizationError)
    expect(getCampaignTargetRowsDao).not.toHaveBeenCalled()
    expect(provider.listInvoicesOf).not.toHaveBeenCalled()
  })
})

describe('volume — 200 impayés le même jour, 100 envois de campagne par jour (amendement du 15/11)', () => {
  const PROFILE_COUNT = 200
  const profileIdOf = (index: number) =>
    `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
  const manyRows = () =>
    Array.from({length: PROFILE_COUNT}, (_, index) =>
      row(profileIdOf(index), `Membre ${index}`, `m${index}@example.fr`)
    )
  const manyInvoices = () =>
    Array.from({length: PROFILE_COUNT}, (_, index) =>
      invoice(profileIdOf(index), UNPAID)
    )

  beforeEach(() => {
    vi.mocked(getCampaignTargetRowsDao).mockResolvedValue(manyRows())
    provider.listInvoicesOf.mockResolvedValue(manyInvoices())
  })

  it('R1 tient en 2 parts de 100, jamais au-delà du plafond', async () => {
    await runUnpaidRemindersJobService(job(), NOW)

    const [, plan, recipients] = createdCalls()[0]
    expect(recipients).toHaveLength(PROFILE_COUNT)
    expect(plan).toEqual([
      {number: 1, scheduledFor: '2026-04-21', recipientCount: 100},
      {number: 2, scheduledFor: '2026-04-22', recipientCount: 100},
    ])
  })

  it('un jour déjà entamé par une autre campagne : aucun jour ne dépasse le plafond', async () => {
    vi.mocked(getAllottedRecipientsByDayDao).mockResolvedValue({
      '2026-04-21': 40,
    })

    await runUnpaidRemindersJobService(job(), NOW)

    const [, plan] = createdCalls()[0]
    expect(plan.map((part) => part.recipientCount)).toEqual([60, 100, 40])
  })

  it('R2 n’est pas dû avant la fin de R1, puis part 2 semaines après son dernier envoi réel', async () => {
    const r1 = {
      dueOn: DUE,
      rank: 1,
      campaignId: CAMPAIGN_R1,
      lastSentOn: null as string | null,
      campaignStatus: 'sending' as 'sending' | 'sent',
    }
    vi.mocked(listUnpaidRemindersDao).mockImplementation(async () => [r1])

    await runUnpaidRemindersJobService(
      job(),
      new Date('2026-05-05T08:00:00.000Z')
    )
    expect(createCampaignWithRecipientsTxnDao).not.toHaveBeenCalled()

    r1.campaignStatus = 'sent'
    r1.lastSentOn = '2026-04-22'
    await runUnpaidRemindersJobService(
      job(),
      new Date('2026-05-05T08:00:00.000Z')
    )
    expect(createCampaignWithRecipientsTxnDao).not.toHaveBeenCalled()

    await runUnpaidRemindersJobService(
      job(),
      new Date('2026-05-06T08:00:00.000Z')
    )
    expect(createCampaignWithRecipientsTxnDao).toHaveBeenCalledOnce()
    expect(createdCalls()[0][4]).toEqual({dueOn: DUE, rank: 2})
  })
})
