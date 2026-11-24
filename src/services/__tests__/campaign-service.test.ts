import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

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
  getCampaignByIdDao: vi.fn(),
  getCampaignsPageDao: vi.fn(),
  getPendingPartRecipientsDao: vi.fn(),
  markRecipientSentTxnDao: vi.fn(),
  markRecipientFailedTxnDao: vi.fn(),
  finishCampaignTxnDao: vi.fn(),
  lockCampaignScheduleTxnDao: vi.fn(),
  getAllottedRecipientsByDayDao: vi.fn(),
  getCampaignPartDao: vi.fn(),
  claimRecipientForSendTxnDao: vi.fn(),
  releaseRecipientClaimTxnDao: vi.fn(),
  markRecipientToVerifyTxnDao: vi.fn(),
  markRecipientUnsubscribedTxnDao: vi.fn(),
  markStaleSendingRecipientsToVerifyTxnDao: vi.fn(),
  markSendingRecipientsToVerifyTxnDao: vi.fn(),
  failUnreceivedRecipientsTxnDao: vi.fn(),
  startCampaignPartTxnDao: vi.fn(),
  finishCampaignPartTxnDao: vi.fn(),
  failCampaignPartsFromTxnDao: vi.fn(),
  countUnfinishedCampaignPartsDao: vi.fn(),
  getCampaignPartsDao: vi.fn(),
  getRecipientStatusCountsDao: vi.fn(),
  getCampaignRecipientsPageDao: vi.fn(),
  markCampaignPartDeferredTxnDao: vi.fn(),
  getSlidableCampaignPartsDao: vi.fn(),
  moveCampaignPartTxnDao: vi.fn(),
  saveCampaignStatisticsTxnDao: vi.fn(),
}))
vi.mock('@/db/repositories/recipient-group-repository', () => ({
  getRecipientGroupByIdDao: vi.fn(),
  getRecipientGroupMemberIdsDao: vi.fn(),
  listRecipientGroupsDao: vi.fn(),
}))
vi.mock('../billing/resolve-member-billing-provider', () => ({
  resolveMemberBillingProvider: vi.fn(),
}))
vi.mock('@/db/repositories/scheduled-job-repository', () => ({
  enqueueScheduledJobTxnDao: vi.fn(),
}))
vi.mock('../scheduled-job-service', () => ({
  runDueScheduledJobsService: vi.fn(),
}))
vi.mock('@/db/repositories/organization-repository', () => ({
  getOrganizationByIdDao: vi.fn(),
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
  getCampaignFooterTexts: vi.fn(async () => ({
    associationName: 'ASL Les Pins',
    legalName: null,
    legalMentions: null,
    reason: 'Motif.',
    unsubscribeLabel: 'Ne plus recevoir ces campagnes',
    notice: 'Phrase.',
  })),
}))
vi.mock('react-email', () => ({
  render: vi.fn(async () => '<html>rendu</html>'),
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
  getCampaignPartDao,
  getCampaignPartsDao,
  getCampaignRecipientsPageDao,
  getCampaignsPageDao,
  getCampaignTargetRowsDao,
  getCurrentParcelNumbersForMembersDao,
  getPendingPartRecipientsDao,
  getRecipientStatusCountsDao,
  getSlidableCampaignPartsDao,
  lockCampaignScheduleTxnDao,
  markCampaignPartDeferredTxnDao,
  markRecipientFailedTxnDao,
  markRecipientSentTxnDao,
  markRecipientToVerifyTxnDao,
  markRecipientUnsubscribedTxnDao,
  markSendingRecipientsToVerifyTxnDao,
  markStaleSendingRecipientsToVerifyTxnDao,
  moveCampaignPartTxnDao,
  releaseRecipientClaimTxnDao,
  saveCampaignStatisticsTxnDao,
  startCampaignPartTxnDao,
} from '@/db/repositories/campaign-repository'
import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {
  getRecipientGroupByIdDao,
  getRecipientGroupMemberIdsDao,
  listRecipientGroupsDao,
} from '@/db/repositories/recipient-group-repository'
import {enqueueScheduledJobTxnDao} from '@/db/repositories/scheduled-job-repository'
import {withTenant} from '@/db/tenant-scope'
import CampaignMail, {getCampaignFooterTexts} from '@/lib/emails/campaign-email'
import {EmailTransportError} from '@/lib/emails/transport/email-transport'
import {logger} from '@/lib/logger'

import {getAssociationSettingsService} from '../association-settings-service'
import {getActingContext} from '../authentication/auth-service'
import type {MemberBillingProvider} from '../billing/member-billing-provider'
import {resolveMemberBillingProvider} from '../billing/resolve-member-billing-provider'
import {
  campaignScheduledJobHandlers,
  canManageCampaignsService,
  deliverCampaignPartService,
  getCampaignComposerContextService,
  getCampaignRecipientsService,
  getCampaignService,
  getCampaignStatisticsService,
  listCampaignsService,
  previewCampaignPlanService,
  previewCampaignService,
  sendCampaignService,
} from '../campaign-service'
import {
  isClientEmailEnabledService,
  readEmailTagStatisticsService,
  sendEmailService,
} from '../email-service'
import {AuthorizationError} from '../errors/authorization-error'
import {CampaignTargetUnavailableError} from '../errors/campaign-errors'
import {NotFoundError} from '../errors/not-found-error'
import {ValidationParsedZodError} from '../errors/validation-error'
import {runDueScheduledJobsService} from '../scheduled-job-service'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {
  CAMPAIGN_RECIPIENT_SENDING_STALE_MS,
  CAMPAIGN_RECIPIENTS_PAGE_SIZE,
  CAMPAIGNS_PAGE_SIZE,
} from '../types/domain/campaign-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {SCHEDULED_JOB_LOCK_STALE_MS} from '../types/domain/scheduled-job-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const CAMPAIGN_ID = '33333333-3333-4333-8333-333333333333'
const SUBMISSION_ID = '44444444-4444-4444-8444-444444444444'
const PROFILE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PROFILE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PROFILE_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const PROFILE_D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const PROFILE_E = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const ADMIN_ID = '77777777-7777-4777-8777-777777777777'
const ORIGIN = 'http://asl-les-pins.test:3000'

const withRole = (role: OrganizationRole, organizationId = ORG_ID): User => ({
  ...userTest,
  name: 'Marie Delorme',
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

const board = withRole(UserOrganizationRoleConst.ADMIN)
const plainMember = withRole(UserOrganizationRoleConst.MEMBER)

const content = {
  organizationId: ORG_ID,
  templateId: 'free' as const,
  subject: 'Peinture du portail',
  preheader: 'Merci de laisser le passage libre.',
  bodyMarkdown: 'Bonjour {nom}, parcelle {parcelle}, le {date}.',
  target: {kind: 'all_members' as const},
}

const ALL = {kind: 'all_members'} as const

const sendInput = {...content, submissionId: SUBMISSION_ID}

/** Ni domicile, ni terrain, ni libelle : ce que le courrier lit (s28). */
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

const targetRows = () => [
  {
    memberProfileId: PROFILE_A,
    name: 'Claire Aubert',
    email: 'claire@example.fr',
    unsubscribed: false,
    currentParcelNumbers: [],
    accountName: null,
    ...NO_LETTER_ADDRESS,
  },
  {
    memberProfileId: PROFILE_B,
    name: 'Paul Renaud',
    email: 'paul@example.fr',
    unsubscribed: false,
    currentParcelNumbers: [],
    accountName: null,
    ...NO_LETTER_ADDRESS,
  },
  {
    memberProfileId: PROFILE_C,
    name: 'Sans Email',
    email: null,
    unsubscribed: false,
    currentParcelNumbers: [],
    accountName: null,
    ...NO_LETTER_ADDRESS,
  },
  {
    memberProfileId: PROFILE_D,
    name: 'Désinscrite',
    email: 'd@example.fr',
    unsubscribed: true,
    currentParcelNumbers: [],
    accountName: null,
    ...NO_LETTER_ADDRESS,
  },
]

const campaignRow = (overrides: Record<string, unknown> = {}) => ({
  id: CAMPAIGN_ID,
  organizationId: ORG_ID,
  submissionId: SUBMISSION_ID,
  subject: 'Peinture du portail',
  preheader: 'Merci',
  bodyMarkdown: 'Bonjour {nom}',
  templateId: 'free',
  nature: 'facultative' as const,
  targetKind: 'all_members',
  targetGroupId: null,
  targetGroupName: null,
  recipientCount: 2,
  withoutEmailCount: 1,
  unsubscribedCount: 1,
  sentCount: 0,
  status: 'sending' as const,
  sendDate: '2026-11-12',
  authorUserId: userTest.id,
  authorName: 'Marie Delorme',
  onBehalfOfUserId: null,
  onBehalfOfName: null,
  createdAt: new Date('2026-11-12T13:32:00Z'),
  updatedAt: new Date('2026-11-12T13:32:00Z'),
  finishedAt: null,
  ...overrides,
})

const writeDaos = () => [
  createCampaignWithRecipientsTxnDao,
  enqueueScheduledJobTxnDao,
  markRecipientSentTxnDao,
  markRecipientFailedTxnDao,
  finishCampaignTxnDao,
]

const expectNoDaoCall = () => {
  for (const dao of [
    ...writeDaos(),
    getCampaignTargetRowsDao,
    getCampaignByIdDao,
    getCampaignsPageDao,
    getPendingPartRecipientsDao,
    getAllottedRecipientsByDayDao,
    lockCampaignScheduleTxnDao,
    getCampaignRecipientsPageDao,
    getCampaignPartsDao,
    getRecipientStatusCountsDao,
    saveCampaignStatisticsTxnDao,
    readEmailTagStatisticsService,
  ]) {
    expect(dao).not.toHaveBeenCalled()
  }
  expect(withTenant).not.toHaveBeenCalled()
}

const expectNoWrite = () => {
  for (const dao of writeDaos()) expect(dao).not.toHaveBeenCalled()
  expect(sendEmailService).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({toFake: ['Date']})
  vi.setSystemTime(new Date('2026-11-12T13:32:00.000Z'))
  vi.mocked(getActingContext).mockResolvedValue(undefined)
  vi.mocked(getOrganizationByIdDao).mockResolvedValue({
    id: ORG_ID,
    name: 'ASL Les Pins',
    domain: 'asl-les-pins.test',
    identityLogoKey: null,
  } as never)
  vi.mocked(getAssociationSettingsService).mockResolvedValue({
    'contact.email': {value: 'bureau@asl-les-pins.test', isDefault: false},
    'identity.accent_hue': {value: '195', isDefault: true},
  } as never)
  vi.mocked(isClientEmailEnabledService).mockResolvedValue(true)
  vi.mocked(getCampaignTargetRowsDao).mockResolvedValue(targetRows())
  vi.mocked(getCurrentParcelNumbersForMembersDao).mockResolvedValue({
    [PROFILE_A]: ['12', '14'],
  })
  vi.mocked(createCampaignWithRecipientsTxnDao).mockImplementation(
    async (_input, plan) => ({
      campaign: campaignRow() as never,
      created: true,
      parts: plan.map((part) => ({
        id: `part-${part.number}`,
        number: part.number,
        scheduledFor: part.scheduledFor,
      })),
    })
  )
  vi.mocked(getAllottedRecipientsByDayDao).mockResolvedValue({})
  vi.mocked(lockCampaignScheduleTxnDao).mockResolvedValue()
  vi.mocked(enqueueScheduledJobTxnDao).mockResolvedValue({id: 'job'})
  vi.mocked(runDueScheduledJobsService).mockResolvedValue({
    organizations: 1,
    processed: 1,
    failed: [],
  })
  vi.mocked(getCampaignByIdDao).mockResolvedValue(campaignRow() as never)
  vi.mocked(getCampaignsPageDao).mockResolvedValue({
    rows: [campaignRow() as never],
    total: 1,
  })
  vi.mocked(markRecipientSentTxnDao).mockResolvedValue({
    campaignId: CAMPAIGN_ID,
    sentCount: 1,
  })
  vi.mocked(markRecipientFailedTxnDao).mockResolvedValue({id: 'r'})
  vi.mocked(finishCampaignTxnDao).mockResolvedValue({id: CAMPAIGN_ID})
  vi.mocked(sendEmailService).mockResolvedValue({status: 'sent'})
  vi.mocked(getCampaignPartsDao).mockResolvedValue([])
  vi.mocked(getRecipientStatusCountsDao).mockResolvedValue([])
  vi.mocked(getCampaignRecipientsPageDao).mockResolvedValue({
    rows: [],
    total: 0,
  })
  vi.mocked(listRecipientGroupsDao).mockResolvedValue([])
  vi.mocked(getRecipientGroupByIdDao).mockResolvedValue(undefined)
  vi.mocked(getRecipientGroupMemberIdsDao).mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
})

const calls: [string, () => Promise<unknown>][] = [
  [
    'lire le contexte du composeur',
    () => getCampaignComposerContextService(ORG_ID, ALL, 'free'),
  ],
  ['voir l’aperçu', () => previewCampaignService(content)],
  ['envoyer', () => sendCampaignService(sendInput)],
  [
    'lire l’archive',
    () => listCampaignsService({organizationId: ORG_ID, page: 1}),
  ],
  [
    'lire une campagne',
    () => getCampaignService({organizationId: ORG_ID, campaignId: CAMPAIGN_ID}),
  ],
  [
    'lire les destinataires',
    () =>
      getCampaignRecipientsService({
        organizationId: ORG_ID,
        campaignId: CAMPAIGN_ID,
        filter: 'all',
        page: 1,
      }),
  ],
  [
    'lire les statistiques',
    () =>
      getCampaignStatisticsService({
        organizationId: ORG_ID,
        campaignId: CAMPAIGN_ID,
      }),
  ],
]

describe('autorisation — seul le bureau de l’association', () => {
  describe.each(calls)('%s', (_label, call) => {
    it('[GUEST] refuse un visiteur sans session, sans appel au DAO', async () => {
      await setupAuthUserMocked(undefined)

      await expect(call()).rejects.toBeInstanceOf(AuthorizationError)
      expectNoDaoCall()
    })

    it('[ORGANIZATION MEMBER] refuse un membre simple, sans appel au DAO', async () => {
      await setupAuthUserMocked(plainMember)

      await expect(call()).rejects.toBeInstanceOf(AuthorizationError)
      expectNoDaoCall()
    })

    it('[USER NOT IN ORGANIZATION] refuse le bureau d’une autre association', async () => {
      await setupAuthUserMocked(
        withRole(UserOrganizationRoleConst.OWNER, OTHER_ORG_ID)
      )

      await expect(call()).rejects.toBeInstanceOf(AuthorizationError)
      expectNoDaoCall()
    })

    it('[SUPER_ADMIN À LA PLACE D’UN MEMBRE] refuse : le compte vu est jugé', async () => {
      await setupAuthUserMocked(plainMember)
      vi.mocked(getActingContext).mockResolvedValue({
        user: plainMember,
        impersonator: {id: ADMIN_ID, name: 'Zourite Studio'},
      })

      await expect(call()).rejects.toBeInstanceOf(AuthorizationError)
      expectNoDaoCall()
    })
  })

  it('[SUPER_ADMIN] autorise le SuperAdmin hors imitation', async () => {
    await setupAuthUserMocked(userTestSuperAdmin)

    await expect(
      getCampaignComposerContextService(ORG_ID, ALL, 'free')
    ).resolves.toMatchObject({associationName: 'ASL Les Pins'})
  })
})

describe('getCampaignComposerContextService — décompte avant l’envoi (critère 2)', () => {
  beforeEach(async () => {
    await setupAuthUserMocked(board)
  })

  it('distingue destinataires, sans email et désinscrits, et la somme fait le total', async () => {
    const context = await getCampaignComposerContextService(ORG_ID, ALL, 'free')

    expect(context.counts).toEqual({
      profilesWithEmail: 3,
      profilesWithoutEmail: 1,
      profiles: 4,
      recipients: 2,
      unsubscribed: 1,
      reinstated: 0,
      nature: 'facultative',
    })
    expect(context.reachableMembers).toEqual([
      {id: PROFILE_A, name: 'Claire Aubert'},
      {id: PROFILE_B, name: 'Paul Renaud'},
    ])
    expect(context.replyTo).toBe('bureau@asl-les-pins.test')
    expect(context.subjectMaxLength).toBe(60 - 'ASL Les Pins — '.length)
    expect(withTenant).toHaveBeenCalledWith(ORG_ID, expect.any(Function))
  })
})

describe('previewCampaignService — aperçu avec un destinataire réel (critère 5)', () => {
  beforeEach(async () => {
    await setupAuthUserMocked(board)
  })

  it('rend objet, HTML et texte pour le premier membre joignable, sans écrire ni envoyer', async () => {
    const result = await previewCampaignService(content)

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.preview.member).toEqual({
      id: PROFILE_A,
      name: 'Claire Aubert',
    })
    expect(result.preview.subject).toBe('ASL Les Pins — Peinture du portail')
    expect(result.preview.html).toBe('<html>rendu</html>')
    expect(result.preview.text).toContain(
      'Bonjour Claire Aubert, parcelle 12 et 14, le 12 novembre 2026.'
    )
    expect(result.preview.counts.recipients).toBe(2)
    expectNoWrite()
  })

  it('rend l’aperçu du membre choisi, s’il est joignable dans cette association', async () => {
    vi.mocked(getCurrentParcelNumbersForMembersDao).mockResolvedValue({})

    const result = await previewCampaignService({
      ...content,
      memberProfileId: PROFILE_B,
    })

    expect(result.status === 'ok' && result.preview.member.id).toBe(PROFILE_B)
    expect(getCurrentParcelNumbersForMembersDao).toHaveBeenCalledWith([
      PROFILE_B,
    ])
    expect(result.status === 'ok' && result.preview.text).toContain(
      'parcelle , le'
    )
  })

  it('une adresse partagée : {nom} = nom du compte, {parcelle} = parcelles de toutes ses fiches (s53, ADR 055)', async () => {
    vi.mocked(getCampaignTargetRowsDao).mockResolvedValue([
      {...targetRows()[0], accountName: 'Claire A.'},
      {
        memberProfileId: PROFILE_E,
        name: 'SCI Aubert',
        email: 'claire@example.fr',
        unsubscribed: false,
        currentParcelNumbers: [],
        accountName: 'Claire A.',
        ...NO_LETTER_ADDRESS,
      },
    ])
    vi.mocked(getCurrentParcelNumbersForMembersDao).mockResolvedValue({
      [PROFILE_A]: ['14'],
      [PROFILE_E]: ['31', '12'],
    })

    const result = await previewCampaignService(content)

    expect(getCurrentParcelNumbersForMembersDao).toHaveBeenCalledWith([
      PROFILE_A,
      PROFILE_E,
    ])
    expect(result.status === 'ok' && result.preview.text).toContain(
      'Bonjour Claire A., parcelle 12, 14 et 31,'
    )
  })

  it('ne montre jamais un membre désinscrit ou d’une autre association : repli sur le premier joignable', async () => {
    const result = await previewCampaignService({
      ...content,
      memberProfileId: PROFILE_D,
    })

    expect(result.status === 'ok' && result.preview.member.id).toBe(PROFILE_A)
  })

  it('variable inconnue → signalée, aucune lecture de fiche ni rendu', async () => {
    const result = await previewCampaignService({
      ...content,
      bodyMarkdown: 'Parcelle {parcele}',
      subject: 'Objet {Nom}',
    })

    expect(result).toEqual({
      status: 'unknown_variables',
      variables: ['Nom', 'parcele'],
    })
    expect(CampaignMail).not.toHaveBeenCalled()
    expectNoWrite()
  })

  it('aucun destinataire → no_recipient', async () => {
    vi.mocked(getCampaignTargetRowsDao).mockResolvedValue([])

    await expect(previewCampaignService(content)).resolves.toEqual({
      status: 'no_recipient',
    })
  })
})

describe('sendCampaignService — envoi (critères 1, 7, 9)', () => {
  beforeEach(async () => {
    await setupAuthUserMocked(board)
  })

  it('crée la campagne et une ligne par destinataire joignable, jetons de 256 bits', async () => {
    const result = await sendCampaignService(sendInput)

    expect(result).toMatchObject({status: 'created', campaignId: CAMPAIGN_ID})
    expect(result.status === 'created' && result.deliver).toEqual(
      expect.any(Function)
    )
    const [campaign, , recipients] = vi.mocked(
      createCampaignWithRecipientsTxnDao
    ).mock.calls[0]
    expect(campaign).toMatchObject({
      organizationId: ORG_ID,
      submissionId: SUBMISSION_ID,
      subject: 'Peinture du portail',
      bodyMarkdown: content.bodyMarkdown,
      templateId: 'free',
      targetKind: 'all_members',
      recipientCount: 2,
      withoutEmailCount: 1,
      unsubscribedCount: 1,
      status: 'sending',
      sendDate: '2026-11-12',
      authorUserId: userTest.id,
      authorName: 'Marie Delorme',
      onBehalfOfUserId: null,
    })
    expect(recipients.map((recipient) => recipient.memberProfileId)).toEqual([
      PROFILE_A,
      PROFILE_B,
    ])
    for (const {unsubscribeToken} of recipients) {
      expect(unsubscribeToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    }
    expect(new Set(recipients.map((r) => r.unsubscribeToken)).size).toBe(2)
    expect(withTenant).toHaveBeenCalledWith(ORG_ID, expect.any(Function))
  })

  it('une fiche à deux adresses actives donne deux lignes, chacune avec son adresse (s54, ADR 057)', async () => {
    vi.mocked(getCampaignTargetRowsDao).mockResolvedValue([
      {
        memberProfileId: PROFILE_A,
        name: 'Jean Dubois',
        email: 'jean@example.fr',
        unsubscribed: false,
        currentParcelNumbers: ['21'],
        accountName: 'Jean Dubois',
        ...NO_LETTER_ADDRESS,
      },
      {
        memberProfileId: PROFILE_A,
        name: 'Jean Dubois',
        email: 'claire@example.fr',
        unsubscribed: false,
        currentParcelNumbers: ['21'],
        accountName: 'Claire Dubois',
        ...NO_LETTER_ADDRESS,
      },
    ])

    await sendCampaignService(sendInput)

    const [campaign, , recipients] = vi.mocked(
      createCampaignWithRecipientsTxnDao
    ).mock.calls[0]
    expect(campaign).toMatchObject({recipientCount: 2, withoutEmailCount: 0})
    expect(
      recipients.map(({memberProfileId, email}) => ({memberProfileId, email}))
    ).toEqual([
      {memberProfileId: PROFILE_A, email: 'jean@example.fr'},
      {memberProfileId: PROFILE_A, email: 'claire@example.fr'},
    ])
  })

  it('fige pour le courrier les fiches ciblées sans adresse active, jamais un désinscrit (s28, ADR 065)', async () => {
    await sendCampaignService(sendInput)

    const [campaign, , , letterProfileIds] = vi.mocked(
      createCampaignWithRecipientsTxnDao
    ).mock.calls[0]
    expect(letterProfileIds).toEqual([PROFILE_C])
    expect(letterProfileIds).not.toContain(PROFILE_D)
    expect(campaign.withoutEmailCount).toBe(letterProfileIds.length)
  })

  it('n’envoie rien lui-même : la livraison est rendue à l’appelant', async () => {
    await sendCampaignService(sendInput)

    expect(sendEmailService).not.toHaveBeenCalled()
    expect(getPendingPartRecipientsDao).not.toHaveBeenCalled()
    expect(runDueScheduledJobsService).not.toHaveBeenCalled()
  })

  it('la livraison rendue est un passage immédiat des tâches dues de cette association', async () => {
    const result = await sendCampaignService(sendInput)
    if (result.status !== 'created' || !result.deliver) {
      throw new Error('livraison attendue')
    }

    await result.deliver()

    expect(runDueScheduledJobsService).toHaveBeenCalledTimes(1)
    expect(
      vi.mocked(runDueScheduledJobsService).mock.calls[0][0]
    ).toMatchObject({
      organizationId: ORG_ID,
      now: new Date('2026-11-12T13:32:00.000Z'),
    })
    expect(
      vi.mocked(runDueScheduledJobsService).mock.calls[0][0].handlers
    ).toBe(campaignScheduledJobHandlers)
  })

  it('pendant une imitation, l’auteur est le SuperAdmin, au nom du compte vu, lu avant withTenant', async () => {
    vi.mocked(getActingContext).mockResolvedValue({
      user: board,
      impersonator: {id: ADMIN_ID, name: 'Zourite Studio'},
    })

    await sendCampaignService(sendInput)

    expect(
      vi.mocked(createCampaignWithRecipientsTxnDao).mock.calls[0][0]
    ).toMatchObject({
      authorUserId: ADMIN_ID,
      authorName: 'Zourite Studio',
      onBehalfOfUserId: board.id,
      onBehalfOfName: 'Marie Delorme',
    })
    expect(
      vi.mocked(getActingContext).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(withTenant).mock.invocationCallOrder[0])
  })

  it('soumission rejouée → la même campagne, aucune livraison relancée', async () => {
    vi.mocked(createCampaignWithRecipientsTxnDao).mockResolvedValue({
      campaign: campaignRow() as never,
      created: false,
      parts: [],
    })

    const result = await sendCampaignService(sendInput)

    expect(result).toEqual({
      status: 'created',
      campaignId: CAMPAIGN_ID,
      deliver: null,
    })
    expect(createCampaignWithRecipientsTxnDao).toHaveBeenCalledTimes(1)
    expect(enqueueScheduledJobTxnDao).not.toHaveBeenCalled()
  })

  it('variable inconnue → refus, aucune écriture', async () => {
    await expect(
      sendCampaignService({...sendInput, bodyMarkdown: 'Parcelle {parcele}'})
    ).resolves.toEqual({status: 'unknown_variables', variables: ['parcele']})
    expectNoWrite()
  })

  it('cible vide → refus, aucune écriture', async () => {
    vi.mocked(getCampaignTargetRowsDao).mockResolvedValue([
      {
        memberProfileId: PROFILE_C,
        name: 'X',
        email: null,
        unsubscribed: false,
        currentParcelNumbers: [],
        accountName: null,
        ...NO_LETTER_ADDRESS,
      },
    ])

    await expect(sendCampaignService(sendInput)).resolves.toEqual({
      status: 'no_recipient',
    })
    expectNoWrite()
  })

  it('envoi aux membres coupé par les réglages → refus avant toute lecture ou écriture', async () => {
    vi.mocked(isClientEmailEnabledService).mockResolvedValue(false)

    await expect(sendCampaignService(sendInput)).resolves.toEqual({
      status: 'delivery_disabled',
    })
    expectNoWrite()
    expect(getCampaignTargetRowsDao).not.toHaveBeenCalled()
  })

  it('objet au-delà du plafond calculé depuis le nom → erreur de validation, aucune écriture', async () => {
    await expect(
      sendCampaignService({...sendInput, subject: 'x'.repeat(46)})
    ).rejects.toBeInstanceOf(ValidationParsedZodError)
    expectNoWrite()
  })

  it('saisie invalide → erreur de validation avant toute autorisation ou lecture', async () => {
    await expect(
      sendCampaignService({...sendInput, submissionId: 'pas-un-uuid'})
    ).rejects.toBeInstanceOf(ValidationParsedZodError)
    expectNoDaoCall()
  })

  it('désinscrit exclu de la cible suivante (critère 7)', async () => {
    vi.mocked(getCampaignTargetRowsDao).mockResolvedValue(
      targetRows().map((row) =>
        row.memberProfileId === PROFILE_B ? {...row, unsubscribed: true} : row
      )
    )

    await sendCampaignService(sendInput)

    const [campaign, , recipients] = vi.mocked(
      createCampaignWithRecipientsTxnDao
    ).mock.calls[0]
    expect(recipients.map((r) => r.memberProfileId)).toEqual([PROFILE_A])
    expect(campaign).toMatchObject({recipientCount: 1, unsubscribedCount: 2})
  })

  it('une adresse portée par deux fiches ne crée qu’un destinataire (s53, ADR 055, critère 7)', async () => {
    vi.mocked(getCampaignTargetRowsDao).mockResolvedValue([
      ...targetRows(),
      {
        memberProfileId: PROFILE_E,
        name: 'SCI Aubert',
        email: 'Claire@example.fr',
        unsubscribed: false,
        currentParcelNumbers: ['31'],
        accountName: 'Claire Aubert',
        ...NO_LETTER_ADDRESS,
      },
    ])

    await sendCampaignService(sendInput)

    const [campaign, , recipients] = vi.mocked(
      createCampaignWithRecipientsTxnDao
    ).mock.calls[0]
    expect(recipients.map((r) => r.memberProfileId)).toEqual([
      PROFILE_E,
      PROFILE_B,
    ])
    expect(campaign).toMatchObject({recipientCount: 2})
  })

  it('n’écrit aucun contenu ni adresse dans un journal', async () => {
    const result = await sendCampaignService(sendInput)
    if (result.status === 'created') await result.deliver?.()

    const logged = JSON.stringify(
      Object.values(logger).flatMap((fn) =>
        vi.isMockFunction(fn) ? fn.mock.calls : []
      )
    )
    expect(logged).not.toContain('Peinture')
    expect(logged).not.toContain('Bonjour')
    expect(logged).not.toContain('@example.fr')
  })
})

const manyTargets = (count: number) =>
  Array.from({length: count}, (_, index) => ({
    memberProfileId: `${String(index).padStart(8, '0')}-0000-4000-8000-000000000000`,
    name: `Membre ${String(index).padStart(4, '0')}`,
    email: `m${index}@example.fr`,
    unsubscribed: false,
    currentParcelNumbers: [],
    accountName: null,
    ...NO_LETTER_ADDRESS,
  }))

const settingsWith = (values: Record<string, unknown>) =>
  ({
    'contact.email': {value: 'bureau@asl-les-pins.test', isDefault: false},
    'identity.accent_hue': {value: '195', isDefault: true},
    ...Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, {value}])
    ),
  }) as never

const planOf = () =>
  vi.mocked(createCampaignWithRecipientsTxnDao).mock.calls[0][1]

describe('sendCampaignService — étalement en parts quotidiennes (s26, critères 1 à 4)', () => {
  beforeEach(async () => {
    await setupAuthUserMocked(board)
  })

  it('250 destinataires, plafond 100 → 3 parts et 3 tâches, la première due maintenant', async () => {
    vi.mocked(getCampaignTargetRowsDao).mockResolvedValue(manyTargets(250))

    await sendCampaignService(sendInput)

    expect(planOf()).toEqual([
      {number: 1, scheduledFor: '2026-11-12', recipientCount: 100},
      {number: 2, scheduledFor: '2026-11-13', recipientCount: 100},
      {number: 3, scheduledFor: '2026-11-14', recipientCount: 50},
    ])
    const jobs = vi
      .mocked(enqueueScheduledJobTxnDao)
      .mock.calls.map(([job]) => job)
    expect(jobs).toEqual([
      {
        organizationId: ORG_ID,
        kind: 'campaign.deliver_part',
        idempotencyKey: 'part-1',
        runAfter: new Date('2026-11-12T13:32:00.000Z'),
        payload: {partId: 'part-1', campaignId: CAMPAIGN_ID},
      },
      expect.objectContaining({
        idempotencyKey: 'part-2',
        runAfter: new Date('2026-11-13T01:00:00.000Z'),
      }),
      expect.objectContaining({
        idempotencyKey: 'part-3',
        runAfter: new Date('2026-11-14T01:00:00.000Z'),
      }),
    ])
  })

  it('les destinataires sont répartis dans l’ordre stable de la cible', async () => {
    const targets = manyTargets(150)
    vi.mocked(getCampaignTargetRowsDao).mockResolvedValue(targets)

    await sendCampaignService(sendInput)

    const recipients = vi.mocked(createCampaignWithRecipientsTxnDao).mock
      .calls[0][2]
    expect(recipients.map((r) => r.memberProfileId)).toEqual(
      targets.map((row) => row.memberProfileId)
    )
  })

  it('100 destinataires → une seule part, une seule tâche', async () => {
    vi.mocked(getCampaignTargetRowsDao).mockResolvedValue(manyTargets(100))

    await sendCampaignService(sendInput)

    expect(planOf()).toHaveLength(1)
    expect(enqueueScheduledJobTxnDao).toHaveBeenCalledTimes(1)
  })

  it('le plafond est celui du tenant : 500 → 400 destinataires en une part', async () => {
    vi.mocked(getAssociationSettingsService).mockResolvedValue(
      settingsWith({'campaign.daily_send_cap': 500})
    )
    vi.mocked(getCampaignTargetRowsDao).mockResolvedValue(manyTargets(400))

    await sendCampaignService(sendInput)

    expect(planOf()).toEqual([
      {number: 1, scheduledFor: '2026-11-12', recipientCount: 400},
    ])
  })

  it('verrouille le plan de l’association avant de lire le déjà-programmé, dans le scope du tenant', async () => {
    const scopes: (string | undefined)[] = []
    vi.mocked(lockCampaignScheduleTxnDao).mockImplementation(async () => {
      scopes.push(scope.current)
    })
    vi.mocked(getAllottedRecipientsByDayDao).mockImplementation(async () => {
      scopes.push(scope.current)
      return {}
    })

    await sendCampaignService(sendInput)

    expect(lockCampaignScheduleTxnDao).toHaveBeenCalledWith(ORG_ID)
    expect(getAllottedRecipientsByDayDao).toHaveBeenCalledWith(
      ORG_ID,
      '2026-11-12'
    )
    expect(
      vi.mocked(lockCampaignScheduleTxnDao).mock.invocationCallOrder[0]
    ).toBeLessThan(
      vi.mocked(getAllottedRecipientsByDayDao).mock.invocationCallOrder[0]
    )
    expect(scopes).toEqual([ORG_ID, ORG_ID])
  })

  it('deux créations simultanées de 100 le même jour ne dépassent pas le plafond', async () => {
    const allotted: Record<string, number> = {}
    let tail: Promise<void> = Promise.resolve()
    let releaseHeld: () => void = () => undefined
    vi.mocked(lockCampaignScheduleTxnDao).mockImplementation(async () => {
      const previous = tail
      let release: () => void = () => undefined
      tail = new Promise<void>((resolve) => {
        release = resolve
      })
      await previous
      releaseHeld = release
    })
    vi.mocked(getAllottedRecipientsByDayDao).mockImplementation(async () => ({
      ...allotted,
    }))
    vi.mocked(createCampaignWithRecipientsTxnDao).mockImplementation(
      async (_input, plan) => {
        for (const part of plan) {
          allotted[part.scheduledFor] =
            (allotted[part.scheduledFor] ?? 0) + part.recipientCount
        }
        releaseHeld()
        return {
          campaign: campaignRow() as never,
          created: true,
          parts: plan.map((part) => ({
            id: `part-${part.number}`,
            number: part.number,
            scheduledFor: part.scheduledFor,
          })),
        }
      }
    )
    vi.mocked(getCampaignTargetRowsDao).mockResolvedValue(manyTargets(100))

    await Promise.all([
      sendCampaignService(sendInput),
      sendCampaignService({
        ...sendInput,
        submissionId: '55555555-5555-4555-8555-555555555555',
      }),
    ])

    expect(allotted).toEqual({'2026-11-12': 100, '2026-11-13': 100})
  })
})

describe('previewCampaignPlanService — le plan annoncé avant l’envoi (s26)', () => {
  beforeEach(async () => {
    await setupAuthUserMocked(board)
  })

  it('rend le plan, le plafond et le déjà-programmé du jour, sans verrou ni écriture', async () => {
    vi.mocked(getCampaignTargetRowsDao).mockResolvedValue(manyTargets(296))
    vi.mocked(getAllottedRecipientsByDayDao).mockResolvedValue({
      '2026-11-12': 40,
    })

    const plan = await previewCampaignPlanService(ORG_ID, ALL, 'free')

    expect(plan).toEqual({
      today: '2026-11-12',
      dailySendCap: 100,
      allottedToday: 40,
      parts: [
        {day: '2026-11-12', count: 60},
        {day: '2026-11-13', count: 100},
        {day: '2026-11-14', count: 100},
        {day: '2026-11-15', count: 36},
      ],
    })
    expect(lockCampaignScheduleTxnDao).not.toHaveBeenCalled()
    expectNoWrite()
    expect(withTenant).toHaveBeenCalledWith(ORG_ID, expect.any(Function))
  })

  it('refuse un membre simple, sans lecture', async () => {
    await setupAuthUserMocked(plainMember)

    await expect(
      previewCampaignPlanService(ORG_ID, ALL, 'free')
    ).rejects.toBeInstanceOf(AuthorizationError)
    expectNoDaoCall()
  })
})

const PART_1 = 'part-1'
const PART_2 = 'part-2'
const MINUTE = 60 * 1000

type FakeRecipient = {
  id: string
  partId: string
  memberProfileId: string | null
  name: string | null
  email: string | null
  unsubscribed: boolean
  status: string
  claimedAt?: number
  /** L'adresse partagee par plusieurs fiches (s53, ADR 055). */
  parcelNumbers?: string[]
  accountName?: string | null
  addressProfileCount?: number
}

type FakePart = {
  id: string
  campaignId: string
  number: number
  scheduledFor: string
  recipientCount: number
  status: 'scheduled' | 'sending' | 'sent' | 'failed'
  deferredTo?: string | null
  deferredCount?: number | null
}

/**
 * Les lignes telles que la base les tiendrait : chaque DAO de la livraison
 * agit sur elles avec la condition de son instruction SQL (passage atomique
 * d'un statut a l'autre).
 */
const fakeStore = () => {
  const store = {
    recipients: [] as FakeRecipient[],
    parts: [] as FakePart[],
    campaignStatus: 'sending' as string,
  }
  const move = (id: string, from: string, to: string) => {
    const row = store.recipients.find((r) => r.id === id && r.status === from)
    if (row) row.status = to
    return row
  }
  vi.mocked(getCampaignPartDao).mockImplementation(
    async (partId) => store.parts.find((part) => part.id === partId) as never
  )
  vi.mocked(getCampaignByIdDao).mockImplementation(
    async () => campaignRow({status: store.campaignStatus}) as never
  )
  vi.mocked(getPendingPartRecipientsDao).mockImplementation(async (partId) =>
    store.recipients
      .filter((r) => r.partId === partId && r.status === 'pending')
      .map((r) => ({
        recipientId: r.id,
        memberProfileId: r.memberProfileId,
        name: r.name,
        email: r.email,
        unsubscribeToken: `token-${r.id}`,
        unsubscribed: r.unsubscribed,
        parcelNumbers: r.parcelNumbers ?? ['12'],
        accountName: r.accountName ?? null,
        addressProfileCount: r.addressProfileCount ?? 1,
        memberProfileIds: r.memberProfileId ? [r.memberProfileId] : [],
      }))
  )
  vi.mocked(claimRecipientForSendTxnDao).mockImplementation(async (id) => {
    const row = move(id, 'pending', 'sending')
    if (row) row.claimedAt = Date.now()
    return Boolean(row)
  })
  vi.mocked(markRecipientSentTxnDao).mockImplementation(async (id) =>
    move(id, 'sending', 'sent')
      ? {campaignId: CAMPAIGN_ID, sentCount: 1}
      : undefined
  )
  vi.mocked(releaseRecipientClaimTxnDao).mockImplementation(async (id) => {
    move(id, 'sending', 'pending')
  })
  vi.mocked(markRecipientToVerifyTxnDao).mockImplementation(async (id) => {
    move(id, 'sending', 'to_verify')
  })
  vi.mocked(markRecipientUnsubscribedTxnDao).mockImplementation(async (id) => {
    move(id, 'pending', 'unsubscribed')
  })
  vi.mocked(markRecipientFailedTxnDao).mockImplementation(async (id) => {
    move(id, 'pending', 'failed')
    return {id}
  })
  vi.mocked(markStaleSendingRecipientsToVerifyTxnDao).mockImplementation(
    async (partId, staleBefore) => {
      const stale = store.recipients.filter(
        (r) =>
          r.partId === partId &&
          r.status === 'sending' &&
          (r.claimedAt ?? 0) < staleBefore.getTime()
      )
      for (const row of stale) row.status = 'to_verify'
      return stale.length
    }
  )
  vi.mocked(markSendingRecipientsToVerifyTxnDao).mockImplementation(
    async (partId) => {
      const sending = store.recipients.filter(
        (r) => r.partId === partId && r.status === 'sending'
      )
      for (const row of sending) row.status = 'to_verify'
      return sending.length
    }
  )
  vi.mocked(failUnreceivedRecipientsTxnDao).mockImplementation(async () => {
    for (const row of store.recipients) {
      if (row.status === 'pending') row.status = 'failed'
    }
  })
  vi.mocked(startCampaignPartTxnDao).mockImplementation(async (partId) => {
    const part = store.parts.find((p) => p.id === partId)
    if (part && ['scheduled', 'sending'].includes(part.status)) {
      part.status = 'sending'
    }
  })
  vi.mocked(finishCampaignPartTxnDao).mockImplementation(
    async (partId, status) => {
      const part = store.parts.find((p) => p.id === partId)
      if (part) part.status = status
    }
  )
  vi.mocked(failCampaignPartsFromTxnDao).mockImplementation(
    async (_campaignId, fromNumber) => {
      for (const part of store.parts) {
        if (
          part.number >= fromNumber &&
          ['scheduled', 'sending'].includes(part.status)
        ) {
          part.status = 'failed'
        }
      }
    }
  )
  vi.mocked(countUnfinishedCampaignPartsDao).mockImplementation(
    async () =>
      store.parts.filter((p) => ['scheduled', 'sending'].includes(p.status))
        .length
  )
  vi.mocked(finishCampaignTxnDao).mockImplementation(
    async (_campaignId, status) => {
      if (store.campaignStatus !== 'sending') return undefined
      store.campaignStatus = status
      return {id: CAMPAIGN_ID}
    }
  )
  vi.mocked(markCampaignPartDeferredTxnDao).mockImplementation(
    async (partId, deferredTo) => {
      const part = store.parts.find((p) => p.id === partId)
      if (!part) return
      part.deferredTo = deferredTo
      part.deferredCount = store.recipients.filter(
        (r) => r.partId === partId && r.status === 'pending'
      ).length
    }
  )
  vi.mocked(getAllottedRecipientsByDayDao).mockImplementation(
    async (_organizationId, fromDay) => allottedOf(store, fromDay)
  )
  vi.mocked(getSlidableCampaignPartsDao).mockImplementation(
    async (_organizationId, fromDay) =>
      store.parts
        .filter(
          (p) =>
            ['scheduled', 'sending'].includes(p.status) &&
            (p.scheduledFor >= fromDay || (p.deferredTo ?? '') >= fromDay)
        )
        .map((p) => ({
          id: p.id,
          campaignId: p.campaignId,
          scheduledFor: p.scheduledFor,
          recipientCount: p.recipientCount,
          status: p.status,
          deferredTo: p.deferredTo ?? null,
        }))
  )
  vi.mocked(moveCampaignPartTxnDao).mockImplementation(
    async ({partId, day}) => {
      const part = store.parts.find((p) => p.id === partId)
      if (part?.status === 'scheduled') part.scheduledFor = day
    }
  )
  return store
}

/** Destinataires de campagne par jour, comme le plan d'envoi les compte. */
const allottedOf = (
  store: {parts: FakePart[]},
  fromDay: string
): Record<string, number> => {
  const allotted: Record<string, number> = {}
  for (const part of store.parts) {
    if (part.status === 'failed') continue
    if (part.scheduledFor >= fromDay) {
      allotted[part.scheduledFor] =
        (allotted[part.scheduledFor] ?? 0) + part.recipientCount
    }
    if (part.deferredTo && part.deferredTo >= fromDay) {
      allotted[part.deferredTo] =
        (allotted[part.deferredTo] ?? 0) + (part.deferredCount ?? 0)
    }
  }
  return allotted
}

const recipientsOf = (partId: string, count: number, from = 1) =>
  Array.from({length: count}, (_, index) => ({
    id: `r${from + index}`,
    partId,
    memberProfileId: `p${from + index}`,
    name: `Membre ${from + index}`,
    email: `m${from + index}@example.fr`,
    unsubscribed: false,
    status: 'pending',
  }))

const twoParts = (): FakePart[] => [
  {
    id: PART_1,
    campaignId: CAMPAIGN_ID,
    number: 1,
    scheduledFor: '2026-11-12',
    recipientCount: 3,
    status: 'scheduled',
  },
  {
    id: PART_2,
    campaignId: CAMPAIGN_ID,
    number: 2,
    scheduledFor: '2026-11-13',
    recipientCount: 2,
    status: 'scheduled',
  },
]

const jobFor = (
  partId: string,
  attempts = 1,
  resumedAfterStaleLock = false
) => ({
  id: `job-${partId}`,
  organizationId: ORG_ID,
  kind: 'campaign.deliver_part',
  payload: {partId, campaignId: CAMPAIGN_ID},
  attempts,
  resumedAfterStaleLock,
})

const deliver = (partId: string, attempts = 1) =>
  deliverCampaignPartService(jobFor(partId, attempts), new Date())

/** Reprise d'une tache dont le verrou, perime, a ete pris sur un detenteur mort. */
const resume = (partId: string, attempts = 2) =>
  deliverCampaignPartService(jobFor(partId, attempts, true), new Date())

const statusesOf = (store: ReturnType<typeof fakeStore>) =>
  Object.fromEntries(store.recipients.map((r) => [r.id, r.status]))

const sentTo = () =>
  vi.mocked(sendEmailService).mock.calls.map(([payload]) => payload.to)

describe('deliverCampaignPartService — livraison d’une part (s26, ADR 052)', () => {
  let store: ReturnType<typeof fakeStore>

  beforeEach(() => {
    store = fakeStore()
    store.parts = twoParts()
    store.recipients = [
      ...recipientsOf(PART_1, 3),
      ...recipientsOf(PART_2, 2, 4),
    ]
  })

  it('est le gestionnaire du planificateur pour campaign.deliver_part', () => {
    expect(campaignScheduledJobHandlers['campaign.deliver_part']).toBe(
      deliverCampaignPartService
    )
  })

  it('envoie chaque destinataire de la part, en l’ayant pris avant l’envoi, dans un scope de tenant', async () => {
    const order: string[] = []
    vi.mocked(claimRecipientForSendTxnDao).mockImplementation(async (id) => {
      order.push(`claim:${id}`)
      const row = store.recipients.find((r) => r.id === id)
      if (row?.status !== 'pending') return false
      row.status = 'sending'
      return true
    })
    vi.mocked(sendEmailService).mockImplementation(async (payload) => {
      order.push(`send:${payload.to}`)
      return {status: 'sent'}
    })

    const outcome = await deliver(PART_1)

    expect(outcome).toEqual({status: 'completed'})
    expect(order).toEqual([
      'claim:r1',
      'send:m1@example.fr',
      'claim:r2',
      'send:m2@example.fr',
      'claim:r3',
      'send:m3@example.fr',
    ])
    expect(statusesOf(store)).toMatchObject({
      r1: 'sent',
      r2: 'sent',
      r3: 'sent',
    })
    for (const [organizationId] of vi.mocked(withTenant).mock.calls) {
      expect(organizationId).toBe(ORG_ID)
    }
  })

  it('une adresse retirée entre la création et la livraison ne reçoit rien (s54, ADR 057)', async () => {
    store.recipients = [{...recipientsOf(PART_1, 1)[0], email: null}]

    await deliver(PART_1)

    expect(sendEmailService).not.toHaveBeenCalled()
    expect(claimRecipientForSendTxnDao).not.toHaveBeenCalled()
    expect(statusesOf(store)).toMatchObject({r1: 'failed'})
  })

  it('une adresse partagée reçoit {nom} = nom du compte et {parcelle} = toutes ses parcelles (s53, ADR 055)', async () => {
    store.recipients = [
      {
        ...recipientsOf(PART_1, 1)[0],
        name: 'Bernard Lefèvre',
        accountName: 'Bernard L.',
        addressProfileCount: 3,
        parcelNumbers: ['31', '12', '27'],
      },
    ]
    vi.mocked(getCampaignByIdDao).mockResolvedValue(
      campaignRow({bodyMarkdown: 'Bonjour {nom}, parcelle {parcelle}'}) as never
    )

    await deliver(PART_1)

    const [payload] = vi.mocked(sendEmailService).mock.calls[0]
    expect(payload.text).toContain('Bonjour Bernard L., parcelle 12, 27 et 31')
  })

  it('chaque envoi porte expéditeur, Reply-To, en-têtes List-Unsubscribe et URL du jeton', async () => {
    await deliver(PART_1)

    const [payload, context, options] =
      vi.mocked(sendEmailService).mock.calls[0]
    expect(payload).toMatchObject({
      to: 'm1@example.fr',
      subject: 'ASL Les Pins — Peinture du portail',
      senderName: 'ASL Les Pins',
      replyTo: 'bureau@asl-les-pins.test',
      headers: {
        'List-Unsubscribe': `<${ORIGIN}/api/campaigns/unsubscribe/token-r1>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })
    expect(payload.text).toContain(`${ORIGIN}/desinscription/token-r1`)
    expect(context).toEqual({
      scope: 'tenant',
      organizationId: ORG_ID,
      nature: 'campaign',
    })
    expect(options).toEqual({recipientType: 'client'})
  })

  it('`{date}` vaut le jour de la part, pas celui de la création', async () => {
    vi.mocked(getCampaignByIdDao).mockResolvedValue(
      campaignRow({bodyMarkdown: 'Le {date}.'}) as never
    )

    await deliver(PART_2)

    expect(vi.mocked(sendEmailService).mock.calls[0][0].text).toContain(
      'Le 13 novembre 2026.'
    )
  })

  it('un destinataire déjà en cours d’envoi n’est jamais renvoyé', async () => {
    store.recipients[0].status = 'sending'
    store.recipients[0].claimedAt = Date.now()

    await deliver(PART_1)

    expect(sentTo()).toEqual(['m2@example.fr', 'm3@example.fr'])
    expect(store.recipients[0].status).toBe('to_verify')
  })

  it('deux passages parallèles sur la même part envoient chaque email une seule fois', async () => {
    await Promise.all([deliver(PART_1), deliver(PART_1)])

    expect(sentTo().sort()).toEqual([
      'm1@example.fr',
      'm2@example.fr',
      'm3@example.fr',
    ])
  })

  it('un arrêt entre l’envoi et son enregistrement laisse la ligne à vérifier, jamais renvoyée', async () => {
    vi.mocked(markRecipientSentTxnDao).mockRejectedValueOnce(
      new Error('arrêt du processus')
    )
    await expect(deliver(PART_1)).rejects.toThrow()
    expect(store.recipients[0].status).toBe('sending')

    vi.setSystemTime(new Date(Date.now() + 16 * MINUTE))
    vi.mocked(sendEmailService).mockClear()
    await deliver(PART_1)

    expect(store.recipients[0].status).toBe('to_verify')
    expect(sentTo()).toEqual(['m2@example.fr', 'm3@example.fr'])
  })

  it('invariant : une ligne en cours d’envoi est périmée avant le verrou de sa tâche (M1)', () => {
    expect(CAMPAIGN_RECIPIENT_SENDING_STALE_MS).toBeLessThan(
      SCHEDULED_JOB_LOCK_STALE_MS
    )
  })

  it('plantage puis reprise dès le verrou périmé : la ligne prise après la pose du verrou passe à vérifier, la campagne ne se clôt pas sur une ligne en cours (M1)', async () => {
    store.parts = [{...twoParts()[0], recipientCount: 3}]
    const lockedAt = Date.now()
    vi.setSystemTime(new Date(lockedAt + 60 * 1000))
    vi.mocked(markRecipientSentTxnDao).mockRejectedValueOnce(
      new Error('arrêt du processus')
    )
    await expect(deliver(PART_1)).rejects.toThrow()
    expect(store.recipients[0].status).toBe('sending')

    vi.setSystemTime(new Date(lockedAt + SCHEDULED_JOB_LOCK_STALE_MS + 1))
    vi.mocked(sendEmailService).mockClear()
    await deliver(PART_1, 2)

    expect(store.recipients[0].status).toBe('to_verify')
    expect(sentTo()).not.toContain('m1@example.fr')
    expect(store.parts[0].status).toBe('sent')
    expect(store.campaignStatus).toBe('sent')
    expect(store.recipients.some((r) => r.status === 'sending')).toBe(false)
  })

  it('première exécution : une ligne récente n’est pas balayée au démarrage, ni renvoyée', async () => {
    store.recipients[0].status = 'sending'
    store.recipients[0].claimedAt =
      Date.now() - CAMPAIGN_RECIPIENT_SENDING_STALE_MS + MINUTE
    const atFirstSend: string[] = []
    vi.mocked(sendEmailService).mockImplementation(async () => {
      atFirstSend.push(store.recipients[0].status)
      return {status: 'sent'}
    })

    await deliver(PART_1)

    expect(atFirstSend[0]).toBe('sending')
    expect(markSendingRecipientsToVerifyTxnDao).toHaveBeenCalledTimes(1)
    expect(sentTo()).not.toContain('m1@example.fr')
  })

  it('une ligne en cours d’envoi au-delà du seuil est balayée à vérifier dès le démarrage', async () => {
    store.recipients[0].status = 'sending'
    store.recipients[0].claimedAt =
      Date.now() - CAMPAIGN_RECIPIENT_SENDING_STALE_MS - MINUTE
    const atFirstSend: string[] = []
    vi.mocked(sendEmailService).mockImplementation(async () => {
      atFirstSend.push(store.recipients[0].status)
      return {status: 'sent'}
    })

    await deliver(PART_1)

    expect(atFirstSend[0]).toBe('to_verify')
    expect(sentTo()).not.toContain('m1@example.fr')
  })

  it('une part ne se clôt jamais sur une ligne en cours d’envoi : elle passe à vérifier (M1)', async () => {
    store.recipients[0].status = 'sending'
    store.recipients[0].claimedAt = Date.now()

    await deliver(PART_1)

    expect(store.parts[0].status).toBe('sent')
    expect(store.recipients[0].status).toBe('to_verify')
    expect(
      store.recipients.filter(
        (r) => r.partId === PART_1 && r.status === 'sending'
      )
    ).toEqual([])
  })

  it('plantage 12 min après la pose du verrou, reprise dès le verrou périmé : ligne à vérifier, jamais renvoyée (M1)', async () => {
    store.parts = [{...twoParts()[0], recipientCount: 3}]
    const lockedAt = Date.now()
    store.recipients[0].status = 'sending'
    store.recipients[0].claimedAt = lockedAt + 12 * MINUTE

    vi.setSystemTime(new Date(lockedAt + SCHEDULED_JOB_LOCK_STALE_MS + 1))
    const atFirstSend: string[] = []
    vi.mocked(sendEmailService).mockImplementation(async () => {
      atFirstSend.push(store.recipients[0].status)
      return {status: 'sent'}
    })
    await resume(PART_1)

    expect(atFirstSend[0]).toBe('to_verify')
    expect(store.recipients[0].status).toBe('to_verify')
    expect(sentTo()).toEqual(['m2@example.fr', 'm3@example.fr'])
    expect(store.campaignStatus).toBe('sent')
    expect(store.recipients.some((r) => r.status === 'sending')).toBe(false)
  })

  it('un gestionnaire qui lève 12 min après le verrou, puis reprise : même issue, aucun doublon (M1)', async () => {
    store.parts = [{...twoParts()[0], recipientCount: 3}]
    const lockedAt = Date.now()
    vi.setSystemTime(new Date(lockedAt + 12 * MINUTE))
    vi.mocked(markRecipientSentTxnDao).mockRejectedValueOnce(
      new Error('base injoignable')
    )
    await expect(deliver(PART_1)).rejects.toThrow()
    expect(store.recipients[0].status).toBe('sending')

    vi.setSystemTime(new Date(lockedAt + SCHEDULED_JOB_LOCK_STALE_MS + 1))
    vi.mocked(sendEmailService).mockClear()
    await resume(PART_1)

    expect(store.recipients[0].status).toBe('to_verify')
    expect(sentTo()).toEqual(['m2@example.fr', 'm3@example.fr'])
    expect(store.recipients.some((r) => r.status === 'sending')).toBe(false)

    vi.mocked(sendEmailService).mockClear()
    await resume(PART_1, 3)
    expect(sendEmailService).not.toHaveBeenCalled()
  })

  it('un échec de composition avant tout envoi laisse la ligne en attente, jamais à vérifier (CI s26)', async () => {
    vi.mocked(getCampaignFooterTexts).mockRejectedValueOnce(
      new Error('`getTranslations` is not supported in Client Components.')
    )
    const now = new Date()

    const outcome = await deliverCampaignPartService(jobFor(PART_1), now)

    expect(outcome).toEqual({
      status: 'retry',
      runAfter: new Date(now.getTime() + 30 * MINUTE),
    })
    expect(statusesOf(store)).toMatchObject({
      r1: 'pending',
      r2: 'pending',
      r3: 'pending',
    })
    expect(sendEmailService).not.toHaveBeenCalled()
    expect(claimRecipientForSendTxnDao).not.toHaveBeenCalled()
  })

  it('un refus certain du fournisseur → ligne rendue en attente, part reprise 30 min plus tard', async () => {
    vi.mocked(sendEmailService)
      .mockResolvedValueOnce({status: 'sent'})
      .mockRejectedValueOnce(
        new EmailTransportError('brevo', 'refus', {refused: true})
      )
    const now = new Date()

    const outcome = await deliverCampaignPartService(jobFor(PART_1), now)

    expect(outcome).toEqual({
      status: 'retry',
      runAfter: new Date(now.getTime() + 30 * MINUTE),
    })
    expect(statusesOf(store)).toMatchObject({
      r1: 'sent',
      r2: 'pending',
      r3: 'pending',
    })
    expect(sendEmailService).toHaveBeenCalledTimes(2)
  })

  it('une issue inconnue (réseau) → ligne à vérifier, part reprise, tentative suivante plus tard', async () => {
    vi.mocked(sendEmailService).mockRejectedValueOnce(
      new EmailTransportError('brevo', 'injoignable')
    )
    const now = new Date()

    const outcome = await deliverCampaignPartService(jobFor(PART_1, 2), now)

    expect(outcome).toEqual({
      status: 'retry',
      runAfter: new Date(now.getTime() + 60 * MINUTE),
    })
    expect(statusesOf(store)).toMatchObject({
      r1: 'to_verify',
      r2: 'pending',
      r3: 'pending',
    })
  })

  it('la part 1 terminée ne clôt pas la campagne ; la dernière la clôt', async () => {
    await deliver(PART_1)
    expect(store.parts[0].status).toBe('sent')
    expect(store.campaignStatus).toBe('sending')
    expect(finishCampaignTxnDao).not.toHaveBeenCalled()

    await deliver(PART_2)
    expect(store.parts[1].status).toBe('sent')
    expect(store.campaignStatus).toBe('sent')
    expect(finishCampaignTxnDao).toHaveBeenCalledWith(CAMPAIGN_ID, 'sent')
  })

  it('un membre désinscrit entre deux parts ne reçoit pas la suivante', async () => {
    store.recipients[3].unsubscribed = true

    await deliver(PART_2)

    expect(sentTo()).toEqual(['m5@example.fr'])
    expect(store.recipients[3].status).toBe('unsubscribed')
  })

  it('envoi statutaire : un membre désinscrit après la création reçoit quand même sa part (s27b, ADR 064)', async () => {
    vi.mocked(getCampaignByIdDao).mockImplementation(
      async () =>
        campaignRow({
          status: store.campaignStatus,
          templateId: 'general_assembly',
          nature: 'statutaire',
        }) as never
    )
    vi.mocked(getAssociationSettingsService).mockResolvedValue({
      'contact.email': {value: 'bureau@asl-les-pins.test', isDefault: false},
      'campaign.nature.general_assembly': {
        value: 'facultative',
        isDefault: false,
      },
    } as never)
    store.recipients[3].unsubscribed = true

    await deliver(PART_2)

    expect(sentTo()).toEqual(['m4@example.fr', 'm5@example.fr'])
    expect(store.recipients[3].status).toBe('sent')
    expect(markRecipientUnsubscribedTxnDao).not.toHaveBeenCalled()
  })

  it('le pied de la livraison suit la nature figée sur la campagne, pas les réglages (s27b, critère 4)', async () => {
    vi.mocked(getCampaignByIdDao).mockImplementation(
      async () =>
        campaignRow({
          status: store.campaignStatus,
          nature: 'statutaire',
        }) as never
    )

    await deliver(PART_2)

    expect(
      vi.mocked(CampaignMail).mock.calls.map(([props]) => props.nature)
    ).toEqual(['statutaire', 'statutaire'])
    expect(
      vi.mocked(getCampaignFooterTexts).mock.calls.map((call) => call[2])
    ).toEqual(['statutaire', 'statutaire'])
    for (const [payload] of vi.mocked(sendEmailService).mock.calls) {
      expect(payload.headers).toMatchObject({
        'List-Unsubscribe': expect.stringContaining(
          '/api/campaigns/unsubscribe/'
        ),
      })
    }
  })

  it('envoi facultatif : la nature figée l’emporte sur un reclassement en statutaire depuis la création (critère 6)', async () => {
    vi.mocked(getAssociationSettingsService).mockResolvedValue({
      'contact.email': {value: 'bureau@asl-les-pins.test', isDefault: false},
      'campaign.nature.free': {value: 'statutaire', isDefault: false},
    } as never)
    store.recipients[3].unsubscribed = true

    await deliver(PART_2)

    expect(sentTo()).toEqual(['m5@example.fr'])
    expect(store.recipients[3].status).toBe('unsubscribed')
  })

  it('une fiche supprimée ou sans adresse depuis la création → ligne en échec, sans arrêter la part', async () => {
    store.recipients[0].memberProfileId = null
    store.recipients[0].email = null

    const outcome = await deliver(PART_1)

    expect(outcome).toEqual({status: 'completed'})
    expect(store.recipients[0].status).toBe('failed')
    expect(sentTo()).toEqual(['m2@example.fr', 'm3@example.fr'])
  })

  it('tentatives épuisées (3 par défaut) → part et suivantes en échec, non reçus en échec, campagne interrompue', async () => {
    vi.mocked(sendEmailService).mockRejectedValue(
      new EmailTransportError('brevo', 'refus', {refused: true})
    )

    expect((await deliver(PART_1, 1)).status).toBe('retry')
    expect((await deliver(PART_1, 2)).status).toBe('retry')
    const outcome = await deliver(PART_1, 3)

    expect(outcome).toEqual({status: 'failed'})
    expect(store.parts.map((p) => p.status)).toEqual(['failed', 'failed'])
    expect(new Set(Object.values(statusesOf(store)))).toEqual(
      new Set(['failed'])
    )
    expect(store.campaignStatus).toBe('interrupted')
  })

  it('le nombre de tentatives est un réglage du tenant', async () => {
    vi.mocked(getAssociationSettingsService).mockResolvedValue({
      'contact.email': {value: 'bureau@asl-les-pins.test'},
      'campaign.send_max_attempts': {value: 1},
    } as never)
    vi.mocked(sendEmailService).mockRejectedValue(
      new EmailTransportError('brevo', 'refus', {refused: true})
    )

    await expect(deliver(PART_1, 1)).resolves.toEqual({status: 'failed'})
  })

  it('une part déjà close n’envoie rien', async () => {
    store.parts[0].status = 'sent'

    await expect(deliver(PART_1)).resolves.toEqual({status: 'completed'})
    expect(sendEmailService).not.toHaveBeenCalled()
  })

  it('envois désactivés par les réglages → tâche rendue sans tentative, rien d’écrit', async () => {
    vi.mocked(isClientEmailEnabledService).mockResolvedValue(false)

    await expect(deliver(PART_1)).resolves.toEqual({status: 'released'})
    expect(sendEmailService).not.toHaveBeenCalled()
    expect(claimRecipientForSendTxnDao).not.toHaveBeenCalled()
    expect(store.parts[0].status).toBe('scheduled')
  })

  it('budget du jour épuisé au milieu de la part : le reste attend demain 02:00, rien en échec, aucune tentative comptée (s52, critère 6)', async () => {
    vi.mocked(sendEmailService)
      .mockResolvedValueOnce({status: 'sent'})
      .mockResolvedValueOnce({status: 'deferred', until: '2026-11-13'})
    const now = new Date()

    const outcome = await deliverCampaignPartService(jobFor(PART_1), now)

    expect(outcome).toEqual({
      status: 'deferred',
      runAfter: new Date('2026-11-13T01:00:00.000Z'),
    })
    expect(statusesOf(store)).toMatchObject({
      r1: 'sent',
      r2: 'pending',
      r3: 'pending',
    })
    expect(sendEmailService).toHaveBeenCalledTimes(2)
    expect(store.parts[0].status).not.toBe('sent')
    expect(store.parts[0].status).not.toBe('failed')
    expect(store.campaignStatus).toBe('sending')
  })

  it('après un report, le plafond des campagnes tient le lendemain : le reste part d’abord, la part suivante glisse d’un jour avec sa tâche (revue s52, n° 1)', async () => {
    vi.mocked(getAssociationSettingsService).mockResolvedValue({
      'contact.email': {value: 'bureau@asl-les-pins.test'},
      'campaign.daily_send_cap': {value: 3},
    } as never)
    vi.mocked(sendEmailService)
      .mockResolvedValueOnce({status: 'sent'})
      .mockResolvedValueOnce({status: 'deferred', until: '2026-11-13'})

    const outcome = await deliver(PART_1)

    expect(outcome).toEqual({
      status: 'deferred',
      runAfter: new Date('2026-11-13T01:00:00.000Z'),
    })
    expect(store.parts[0]).toMatchObject({
      scheduledFor: '2026-11-12',
      deferredTo: '2026-11-13',
      deferredCount: 2,
    })
    expect(store.parts[1].scheduledFor).toBe('2026-11-14')
    expect(moveCampaignPartTxnDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      partId: PART_2,
      day: '2026-11-14',
      runAfter: new Date('2026-11-14T01:00:00.000Z'),
    })
    for (const total of Object.values(allottedOf(store, '2026-11-13'))) {
      expect(total).toBeLessThanOrEqual(3)
    }
    expect(
      vi.mocked(lockCampaignScheduleTxnDao).mock.invocationCallOrder[0]
    ).toBeLessThan(
      vi.mocked(getSlidableCampaignPartsDao).mock.invocationCallOrder[0]
    )
  })

  it('après un report, la suite de la campagne glisse d’un jour ; une autre campagne qui a la place garde son jour', async () => {
    store.parts.push({
      id: 'other-part',
      campaignId: 'other-campaign',
      number: 1,
      scheduledFor: '2026-11-13',
      recipientCount: 10,
      status: 'scheduled',
    })
    vi.mocked(sendEmailService)
      .mockResolvedValueOnce({status: 'sent'})
      .mockResolvedValueOnce({status: 'deferred', until: '2026-11-13'})

    await deliver(PART_1)

    expect(store.parts[0].deferredTo).toBe('2026-11-13')
    expect(store.parts[1].scheduledFor).toBe('2026-11-14')
    expect(store.parts[2].scheduledFor).toBe('2026-11-13')
    expect(moveCampaignPartTxnDao).toHaveBeenCalledTimes(1)
  })

  it('une part servie sans report ne touche pas au plan', async () => {
    await deliver(PART_1)

    expect(markCampaignPartDeferredTxnDao).not.toHaveBeenCalled()
    expect(moveCampaignPartTxnDao).not.toHaveBeenCalled()
  })

  it('un envoi ignoré par les réglages n’est jamais compté comme reçu : ligne rendue, tâche rendue (s52)', async () => {
    vi.mocked(sendEmailService).mockResolvedValueOnce({status: 'skipped'})

    const outcome = await deliver(PART_1)

    expect(outcome).toEqual({status: 'released'})
    expect(statusesOf(store)).toMatchObject({
      r1: 'pending',
      r2: 'pending',
      r3: 'pending',
    })
    expect(markRecipientSentTxnDao).not.toHaveBeenCalled()
  })

  it('n’écrit ni adresse ni contenu dans un journal', async () => {
    vi.mocked(sendEmailService).mockRejectedValueOnce(
      new EmailTransportError('brevo', 'injoignable')
    )

    await deliver(PART_1)

    const logged = JSON.stringify(
      Object.values(logger).flatMap((fn) =>
        vi.isMockFunction(fn) ? fn.mock.calls : []
      )
    )
    expect(logged).not.toContain('@example.fr')
    expect(logged).not.toContain('Peinture')
  })
})

describe('archive (critère 8)', () => {
  beforeEach(async () => {
    await setupAuthUserMocked(board)
  })

  it('lit une page de l’archive, 25 par page', async () => {
    const page = await listCampaignsService({organizationId: ORG_ID, page: 2})

    expect(getCampaignsPageDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      limit: CAMPAIGNS_PAGE_SIZE,
      offset: CAMPAIGNS_PAGE_SIZE,
    })
    expect(CAMPAIGNS_PAGE_SIZE).toBe(25)
    expect(page).toMatchObject({page: 2, pageSize: 25, total: 1, totalPages: 1})
    expect(page.items[0]).not.toHaveProperty('authorUserId')
    expect(page.items[0]).not.toHaveProperty('organizationId')
  })

  it('lit une campagne de l’association ; celle d’une autre → not_found', async () => {
    await expect(
      getCampaignService({organizationId: ORG_ID, campaignId: CAMPAIGN_ID})
    ).resolves.toMatchObject({status: 'found', campaign: {id: CAMPAIGN_ID}})

    vi.mocked(getCampaignByIdDao).mockResolvedValue(undefined)
    await expect(
      getCampaignService({organizationId: ORG_ID, campaignId: CAMPAIGN_ID})
    ).resolves.toEqual({status: 'not_found'})
    expect(getCampaignByIdDao).toHaveBeenLastCalledWith(ORG_ID, CAMPAIGN_ID)
  })
})

describe('lectures — décomptes et parts de chaque campagne (s26)', () => {
  beforeEach(async () => {
    await setupAuthUserMocked(board)
    vi.mocked(getCampaignPartsDao).mockResolvedValue([
      {
        id: 'p1',
        campaignId: CAMPAIGN_ID,
        number: 1,
        scheduledFor: '2026-11-12',
        recipientCount: 1,
        status: 'sent',
        deferredTo: null,
      },
      {
        id: 'p2',
        campaignId: CAMPAIGN_ID,
        number: 2,
        scheduledFor: '2026-11-13',
        recipientCount: 1,
        status: 'scheduled',
        deferredTo: null,
      },
    ])
    vi.mocked(getRecipientStatusCountsDao).mockResolvedValue([
      {campaignId: CAMPAIGN_ID, partId: 'p1', status: 'sent', total: 1},
      {campaignId: CAMPAIGN_ID, partId: 'p2', status: 'pending', total: 1},
    ])
  })

  it('une campagne lue porte ses parts, ses décomptes et son état, lus dans le scope du tenant', async () => {
    const scopes: (string | undefined)[] = []
    vi.mocked(getCampaignPartsDao).mockImplementationOnce(async () => {
      scopes.push(scope.current)
      return []
    })

    const first = await getCampaignService({
      organizationId: ORG_ID,
      campaignId: CAMPAIGN_ID,
    })
    expect(scopes).toEqual([ORG_ID])
    expect(first.status).toBe('found')

    const result = await getCampaignService({
      organizationId: ORG_ID,
      campaignId: CAMPAIGN_ID,
    })
    if (result.status !== 'found') throw new Error('campagne attendue')
    expect(getCampaignPartsDao).toHaveBeenLastCalledWith([CAMPAIGN_ID])
    expect(getRecipientStatusCountsDao).toHaveBeenLastCalledWith([CAMPAIGN_ID])
    expect(result.campaign.displayState).toBe('sending')
    expect(result.campaign.recipientCounts).toMatchObject({
      received: 1,
      scheduled: 1,
    })
    expect(result.campaign.parts.map((part) => part.displayState)).toEqual([
      'sent',
      'scheduled',
    ])
  })

  it('l’archive lit les décomptes des seules campagnes de la page', async () => {
    const page = await listCampaignsService({organizationId: ORG_ID, page: 1})

    expect(getRecipientStatusCountsDao).toHaveBeenCalledWith([CAMPAIGN_ID])
    expect(page.items[0].recipientCounts.received).toBe(1)
  })
})

describe('getCampaignRecipientsService — liste paginée des destinataires (s26, critère 6)', () => {
  const read = (filter: string, page = 1) =>
    getCampaignRecipientsService({
      organizationId: ORG_ID,
      campaignId: CAMPAIGN_ID,
      filter: filter as never,
      page,
    })

  beforeEach(async () => {
    await setupAuthUserMocked(board)
    vi.mocked(getCampaignRecipientsPageDao).mockResolvedValue({
      rows: [
        {
          id: 'r1',
          name: 'Claire Aubert',
          status: 'to_verify',
          sentAt: null,
          scheduledFor: '2026-11-13',
          parcelNumbers: ['12'],
        },
        {
          id: 'r2',
          name: null,
          status: 'sent',
          sentAt: new Date('2026-11-12T13:40:00.000Z'),
          scheduledFor: '2026-11-12',
          parcelNumbers: [],
        },
      ],
      total: 27,
    })
  })

  it('la page 2 du filtre « À vérifier » : 25 par page, bornée à la campagne et à l’association', async () => {
    const result = await read('to_verify', 2)

    expect(CAMPAIGN_RECIPIENTS_PAGE_SIZE).toBe(25)
    expect(getCampaignRecipientsPageDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      campaignId: CAMPAIGN_ID,
      statuses: ['to_verify'],
      limit: 25,
      offset: 25,
    })
    expect(result).toMatchObject({
      status: 'found',
      recipients: {
        filter: 'to_verify',
        page: 2,
        pageSize: 25,
        total: 27,
        totalPages: 2,
      },
    })
  })

  it.each([
    ['all', null],
    ['received', ['sent']],
    ['scheduled', ['pending', 'sending']],
    ['failed', ['failed']],
  ])('le filtre %s lit les statuts %j', async (filter, statuses) => {
    await read(filter)

    expect(
      vi.mocked(getCampaignRecipientsPageDao).mock.calls[0][0].statuses
    ).toEqual(statuses)
  })

  it('une campagne d’une autre association → introuvable, aucune ligne lue', async () => {
    vi.mocked(getCampaignByIdDao).mockResolvedValue(undefined)

    await expect(read('all')).resolves.toEqual({status: 'not_found'})
    expect(getCampaignRecipientsPageDao).not.toHaveBeenCalled()
    expect(getCampaignByIdDao).toHaveBeenCalledWith(ORG_ID, CAMPAIGN_ID)
  })

  it('rend chaque ligne sans jeton, une fiche supprimée comprise', async () => {
    const result = await read('all')
    if (result.status !== 'found') throw new Error('liste attendue')

    expect(result.recipients.items).toEqual([
      {
        id: 'r1',
        name: 'Claire Aubert',
        parcelNumbers: ['12'],
        status: 'to_verify',
        sentAt: null,
        scheduledFor: '2026-11-13',
      },
      {
        id: 'r2',
        name: null,
        parcelNumbers: [],
        status: 'sent',
        sentAt: '2026-11-12T13:40:00.000Z',
        scheduledFor: '2026-11-12',
      },
    ])
    expect(JSON.stringify(result)).not.toMatch(/token/i)
  })

  it('un filtre inconnu ou une page hors forme → erreur de validation, sans lecture', async () => {
    await expect(read('tout')).rejects.toBeInstanceOf(ValidationParsedZodError)
    await expect(read('all', 0)).rejects.toBeInstanceOf(
      ValidationParsedZodError
    )
    expect(getCampaignRecipientsPageDao).not.toHaveBeenCalled()
  })
})

describe('canManageCampaignsService — pour les écrans', () => {
  it('le bureau peut, un membre simple ne peut pas, un identifiant hors forme non plus', async () => {
    await setupAuthUserMocked(board)
    await expect(canManageCampaignsService(ORG_ID)).resolves.toBe(true)
    await expect(canManageCampaignsService('x')).resolves.toBe(false)

    await setupAuthUserMocked(plainMember)
    await expect(canManageCampaignsService(ORG_ID)).resolves.toBe(false)

    await setupAuthUserMocked(undefined)
    await expect(canManageCampaignsService(ORG_ID)).resolves.toBe(false)
  })
})

/**
 * s27 (ADR 060) : la cible choisie — tous, impayés, un groupe — passe par un
 * seul calcul, reçu par les quatre lecteurs de la cible.
 */
describe('cible choisie — impayés et groupes (s27, ADR 060)', () => {
  const GROUP_ID = '99999999-9999-4999-8999-999999999999'
  const UNPAID = {kind: 'unpaid_members'} as const
  const GROUP = {kind: 'group', groupId: GROUP_ID} as const
  const settings = {
    'contact.email': {value: 'bureau@asl-les-pins.test', isDefault: false},
    'identity.accent_hue': {value: '195', isDefault: true},
    'billing.provider': {value: 'simule', isDefault: false},
    'billing.unpaid_statuses': {value: 'En retard', isDefault: false},
    'billing.settled_statuses': {value: 'Payée', isDefault: false},
  }
  const invoice = (memberProfileId: string, status: string) => ({
    id: `inv-${memberProfileId}-${status}`,
    memberProfileId,
    parcelId: 'p',
    parcelNumber: '12',
    meterNumber: null,
    source: 'pennylane' as const,
    year: 2026,
    issuedOn: '2026-03-15',
    dueOn: '2026-04-15',
    amountCents: 100,
    status,
    hasPdf: false,
    paymentUrl: null,
  })
  const providerOf = (
    listInvoicesOf: MemberBillingProvider['listInvoicesOf']
  ): MemberBillingProvider => ({id: 'simule', canWrite: false, listInvoicesOf})

  beforeEach(async () => {
    await setupAuthUserMocked(board)
    vi.mocked(getAssociationSettingsService).mockResolvedValue(
      settings as never
    )
    vi.mocked(resolveMemberBillingProvider).mockReturnValue(
      providerOf(async () => [
        invoice(PROFILE_A, 'En retard'),
        invoice(PROFILE_B, 'Payée'),
        invoice(PROFILE_C, 'En retard'),
        invoice(PROFILE_D, 'En retard'),
      ])
    )
    vi.mocked(getRecipientGroupByIdDao).mockResolvedValue({
      id: GROUP_ID,
      name: 'Riverains',
      profileCount: 2,
    })
    vi.mocked(getRecipientGroupMemberIdsDao).mockResolvedValue([
      PROFILE_B,
      PROFILE_C,
    ])
  })

  it('« impayés » : seules les fiches dont une facture est impayée, lues par le fournisseur actif (critères 1, 2)', async () => {
    const context = await getCampaignComposerContextService(
      ORG_ID,
      UNPAID,
      'free'
    )

    expect(context.reachableMembers).toEqual([
      {id: PROFILE_A, name: 'Claire Aubert'},
    ])
    expect(context.counts).toEqual({
      profilesWithEmail: 2,
      profilesWithoutEmail: 1,
      profiles: 3,
      recipients: 1,
      unsubscribed: 1,
      reinstated: 0,
      nature: 'facultative',
    })
    expect(resolveMemberBillingProvider).toHaveBeenCalledWith(settings)
    const provider = vi.mocked(resolveMemberBillingProvider).mock.results[0]
      .value as MemberBillingProvider
    expect(provider.id).toBe('simule')
  })

  it('changer d’implémentation de facturation ne change pas la cible (critère 2)', async () => {
    const invoices = [invoice(PROFILE_A, 'En retard')]
    vi.mocked(resolveMemberBillingProvider).mockReturnValueOnce(
      providerOf(async () => invoices)
    )
    const first = await getCampaignComposerContextService(
      ORG_ID,
      UNPAID,
      'free'
    )
    vi.mocked(resolveMemberBillingProvider).mockReturnValueOnce({
      id: 'manual',
      canWrite: true,
      listInvoicesOf: async () => invoices,
    })
    const second = await getCampaignComposerContextService(
      ORG_ID,
      UNPAID,
      'free'
    )

    expect(second.counts).toEqual(first.counts)
    expect(second.reachableMembers).toEqual(first.reachableMembers)
  })

  it('une facture « à classer » ne met pas la fiche en impayé', async () => {
    vi.mocked(resolveMemberBillingProvider).mockReturnValue(
      providerOf(async () => [invoice(PROFILE_A, 'Statut inconnu')])
    )

    const context = await getCampaignComposerContextService(
      ORG_ID,
      UNPAID,
      'free'
    )

    expect(context.counts.profiles).toBe(0)
  })

  it('une erreur du fournisseur remonte, typée, et rien n’est créé — jamais « tous »', async () => {
    vi.mocked(resolveMemberBillingProvider).mockReturnValue(
      providerOf(async () => {
        throw new Error('Pennylane indisponible')
      })
    )

    await expect(
      sendCampaignService({...sendInput, target: UNPAID})
    ).rejects.toBeInstanceOf(CampaignTargetUnavailableError)
    expectNoWrite()
  })

  it('un fournisseur sans implémentation remonte, typé, sans rien créer', async () => {
    vi.mocked(resolveMemberBillingProvider).mockImplementation(() => {
      throw new Error('Fournisseur de factures sans implementation : x')
    })

    await expect(
      getCampaignComposerContextService(ORG_ID, UNPAID, 'free')
    ).rejects.toBeInstanceOf(CampaignTargetUnavailableError)
  })

  it('« groupe » : seules ses fiches, lues sous le tenant (critère 4)', async () => {
    const context = await getCampaignComposerContextService(
      ORG_ID,
      GROUP,
      'free'
    )

    expect(context.reachableMembers).toEqual([
      {id: PROFILE_B, name: 'Paul Renaud'},
    ])
    expect(context.counts).toMatchObject({
      profilesWithEmail: 1,
      profilesWithoutEmail: 1,
      recipients: 1,
    })
    expect(getRecipientGroupMemberIdsDao).toHaveBeenCalledWith(GROUP_ID)
    expect(resolveMemberBillingProvider).not.toHaveBeenCalled()
  })

  it('un groupe d’une autre association (introuvable sous le tenant) est refusé, jamais « tous » (critère 8)', async () => {
    vi.mocked(getRecipientGroupByIdDao).mockResolvedValue(undefined)

    await expect(
      sendCampaignService({...sendInput, target: GROUP})
    ).rejects.toBeInstanceOf(NotFoundError)
    await expect(
      previewCampaignService({...content, target: GROUP})
    ).rejects.toBeInstanceOf(NotFoundError)
    await expect(
      previewCampaignPlanService(ORG_ID, GROUP, 'free')
    ).rejects.toBeInstanceOf(NotFoundError)
    expectNoWrite()
  })

  it('l’envoi à un groupe fige ses destinataires et copie son nom (ADR 060 §5)', async () => {
    await sendCampaignService({...sendInput, target: GROUP})

    const [campaign, , recipients] = vi.mocked(
      createCampaignWithRecipientsTxnDao
    ).mock.calls[0]
    expect(campaign).toMatchObject({
      targetKind: 'group',
      targetGroupId: GROUP_ID,
      targetGroupName: 'Riverains',
      recipientCount: 1,
      withoutEmailCount: 1,
      unsubscribedCount: 0,
    })
    expect(recipients.map((r) => r.memberProfileId)).toEqual([PROFILE_B])
  })

  it('l’envoi aux impayés écrit son type, sans groupe', async () => {
    await sendCampaignService({...sendInput, target: UNPAID})

    const [campaign, , recipients] = vi.mocked(
      createCampaignWithRecipientsTxnDao
    ).mock.calls[0]
    expect(campaign).toMatchObject({
      targetKind: 'unpaid_members',
      targetGroupId: null,
      targetGroupName: null,
    })
    expect(recipients.map((r) => r.memberProfileId)).toEqual([PROFILE_A])
  })

  it('un désinscrit est exclu des trois types de cible (critère 7)', async () => {
    vi.mocked(getRecipientGroupMemberIdsDao).mockResolvedValue([PROFILE_D])

    for (const target of [ALL, UNPAID, GROUP]) {
      const context = await getCampaignComposerContextService(
        ORG_ID,
        target,
        'free'
      )
      expect(
        context.reachableMembers.map((member) => member.id),
        target.kind
      ).not.toContain(PROFILE_D)
      expect(context.counts.unsubscribed, target.kind).toBe(1)
    }
  })

  it('cible vide → no_recipient, rien n’est créé', async () => {
    vi.mocked(getRecipientGroupMemberIdsDao).mockResolvedValue([PROFILE_C])

    await expect(
      sendCampaignService({...sendInput, target: GROUP})
    ).resolves.toEqual({status: 'no_recipient'})
    await expect(
      previewCampaignService({...content, target: GROUP})
    ).resolves.toEqual({status: 'no_recipient'})
    expectNoWrite()
  })

  it('l’aperçu choisit le membre dans la cible et ne cite que les parcelles de ses fiches ciblées', async () => {
    vi.mocked(getCampaignTargetRowsDao).mockResolvedValue([
      {...targetRows()[0], accountName: 'Claire A.'},
      {
        memberProfileId: PROFILE_E,
        name: 'SCI Aubert',
        email: 'claire@example.fr',
        unsubscribed: false,
        currentParcelNumbers: [],
        accountName: 'Claire A.',
        ...NO_LETTER_ADDRESS,
      },
    ])
    vi.mocked(getRecipientGroupMemberIdsDao).mockResolvedValue([PROFILE_E])
    vi.mocked(getCurrentParcelNumbersForMembersDao).mockResolvedValue({
      [PROFILE_E]: ['31'],
    })

    const result = await previewCampaignService({...content, target: GROUP})

    expect(result.status === 'ok' && result.preview.member.id).toBe(PROFILE_E)
    expect(getCurrentParcelNumbersForMembersDao).toHaveBeenCalledWith([
      PROFILE_E,
    ])
    expect(result.status === 'ok' && result.preview.text).toContain(
      'Bonjour SCI Aubert, parcelle 31,'
    )
  })

  it('l’envoi fige, par adresse, les seules fiches ciblées qu’elle représente (ADR 061)', async () => {
    vi.mocked(getCampaignTargetRowsDao).mockResolvedValue([
      {...targetRows()[0], accountName: 'Claire A.'},
      {
        memberProfileId: PROFILE_E,
        name: 'SCI Aubert',
        email: 'claire@example.fr',
        unsubscribed: false,
        currentParcelNumbers: [],
        accountName: 'Claire A.',
        ...NO_LETTER_ADDRESS,
      },
    ])

    await sendCampaignService({...sendInput, target: UNPAID})
    await sendCampaignService({
      ...sendInput,
      submissionId: OTHER_ORG_ID,
      target: ALL,
    })

    const frozenOf = (call: number) =>
      vi
        .mocked(createCampaignWithRecipientsTxnDao)
        .mock.calls[call][2].map(({email, memberProfileIds}) => ({
          email,
          memberProfileIds,
        }))
    expect(frozenOf(0)).toEqual([
      {email: 'claire@example.fr', memberProfileIds: [PROFILE_A]},
    ])
    expect(frozenOf(1)).toEqual([
      {email: 'claire@example.fr', memberProfileIds: [PROFILE_A, PROFILE_E]},
    ])
  })

  it('le courrier fige les fiches sans email de la cible choisie, groupe ou impayés (s28, ADR 065)', async () => {
    await sendCampaignService({...sendInput, target: GROUP})
    await sendCampaignService({...sendInput, target: UNPAID})
    vi.mocked(getRecipientGroupMemberIdsDao).mockResolvedValue([PROFILE_B])
    await sendCampaignService({...sendInput, target: GROUP})

    const lettersOf = (call: number) =>
      vi.mocked(createCampaignWithRecipientsTxnDao).mock.calls[call][3]
    expect(lettersOf(0)).toEqual([PROFILE_C])
    expect(lettersOf(1)).toEqual([PROFILE_C])
    expect(lettersOf(2)).toEqual([])
  })

  it('aucune adresse email dans la cible : no_recipient inchangé, rien n’est figé pour le courrier (ADR 065 §5)', async () => {
    vi.mocked(getRecipientGroupMemberIdsDao).mockResolvedValue([PROFILE_C])

    await expect(
      sendCampaignService({...sendInput, target: GROUP})
    ).resolves.toEqual({status: 'no_recipient'})
    expect(createCampaignWithRecipientsTxnDao).not.toHaveBeenCalled()
  })

  it('le plan d’envoi compte les adresses de la cible choisie', async () => {
    const plan = await previewCampaignPlanService(ORG_ID, GROUP, 'free')

    expect(plan.parts).toEqual([{day: '2026-11-12', count: 1}])
  })

  it('le composeur propose les groupes de l’association', async () => {
    vi.mocked(listRecipientGroupsDao).mockResolvedValue([
      {id: GROUP_ID, name: 'Riverains', profileCount: 2},
    ])

    const context = await getCampaignComposerContextService(ORG_ID, ALL, 'free')

    expect(context.groups).toEqual([
      {id: GROUP_ID, name: 'Riverains', profileCount: 2},
    ])
    expect(listRecipientGroupsDao).toHaveBeenCalledWith(ORG_ID)
  })

  it('refuse une cible malformée, sans lecture', async () => {
    await expect(
      sendCampaignService({
        ...sendInput,
        target: {kind: 'group', groupId: 'pas-un-uuid'},
      })
    ).rejects.toBeInstanceOf(ValidationParsedZodError)
    await expect(
      sendCampaignService({...sendInput, target: {kind: 'tous'} as never})
    ).rejects.toBeInstanceOf(ValidationParsedZodError)
    expect(getCampaignTargetRowsDao).not.toHaveBeenCalled()
  })
})

/**
 * s27b (ADR 064) : la nature de l'envoi vient des reglages du tenant, par
 * modele ; elle decide si une adresse desinscrite est reintegree, et elle est
 * figee sur la campagne a sa creation.
 */
describe('nature des envois — réintégration des désinscrits (s27b, ADR 064)', () => {
  const GROUP_ID = '99999999-9999-4999-8999-999999999999'
  const UNPAID = {kind: 'unpaid_members'} as const
  const GROUP = {kind: 'group', groupId: GROUP_ID} as const
  const baseSettings = {
    'contact.email': {value: 'bureau@asl-les-pins.test', isDefault: false},
    'identity.accent_hue': {value: '195', isDefault: true},
    'billing.provider': {value: 'simule', isDefault: false},
    'billing.unpaid_statuses': {value: 'En retard', isDefault: false},
  }
  const classify = (natures: Record<string, string>) =>
    vi.mocked(getAssociationSettingsService).mockResolvedValue({
      ...baseSettings,
      ...Object.fromEntries(
        Object.entries(natures).map(([templateId, value]) => [
          `campaign.nature.${templateId}`,
          {value, isDefault: false},
        ])
      ),
    } as never)
  const invoice = (memberProfileId: string) => ({
    id: `inv-${memberProfileId}`,
    memberProfileId,
    parcelId: 'p',
    parcelNumber: '12',
    meterNumber: null,
    source: 'pennylane' as const,
    year: 2026,
    issuedOn: '2026-03-15',
    dueOn: '2026-04-15',
    amountCents: 100,
    status: 'En retard',
    hasPdf: false,
    paymentUrl: null,
  })
  const assembly = {
    ...content,
    templateId: 'general_assembly' as const,
  }

  beforeEach(async () => {
    await setupAuthUserMocked(board)
    classify({general_assembly: 'statutaire', free: 'facultative'})
    vi.mocked(resolveMemberBillingProvider).mockReturnValue({
      id: 'simule',
      canWrite: false,
      listInvoicesOf: async () => [invoice(PROFILE_A), invoice(PROFILE_D)],
    })
    vi.mocked(getRecipientGroupByIdDao).mockResolvedValue({
      id: GROUP_ID,
      name: 'Riverains',
      profileCount: 2,
    })
    vi.mocked(getRecipientGroupMemberIdsDao).mockResolvedValue([
      PROFILE_B,
      PROFILE_D,
    ])
  })

  describe.each([
    ['tous', ALL],
    ['impayés', UNPAID],
    ['groupe', GROUP],
  ] as const)('cible « %s » (critère 3)', (_label, target) => {
    it('envoi statutaire : le désinscrit est destinataire, compté réintégré', async () => {
      const context = await getCampaignComposerContextService(
        ORG_ID,
        target,
        'general_assembly'
      )

      expect(context.reachableMembers.map((member) => member.id)).toContain(
        PROFILE_D
      )
      expect(context.counts).toMatchObject({
        unsubscribed: 0,
        reinstated: 1,
        nature: 'statutaire',
      })

      await sendCampaignService({...sendInput, ...assembly, target})
      const [campaign, , recipients] = vi.mocked(
        createCampaignWithRecipientsTxnDao
      ).mock.calls[0]
      expect(campaign).toMatchObject({
        templateId: 'general_assembly',
        nature: 'statutaire',
        unsubscribedCount: 1,
      })
      expect(recipients.map((r) => r.memberProfileId)).toContain(PROFILE_D)
    })

    it('envoi facultatif : le désinscrit est exclu, compté désinscrit', async () => {
      const context = await getCampaignComposerContextService(
        ORG_ID,
        target,
        'free'
      )

      expect(context.reachableMembers.map((member) => member.id)).not.toContain(
        PROFILE_D
      )
      expect(context.counts).toMatchObject({
        unsubscribed: 1,
        reinstated: 0,
        nature: 'facultative',
      })

      await sendCampaignService({...sendInput, target})
      const [campaign, , recipients] = vi.mocked(
        createCampaignWithRecipientsTxnDao
      ).mock.calls[0]
      expect(campaign).toMatchObject({
        templateId: 'free',
        nature: 'facultative',
        unsubscribedCount: 1,
      })
      expect(recipients.map((r) => r.memberProfileId)).not.toContain(PROFILE_D)
    })
  })

  it('un modèle sans nature configurée est facultatif (critère 2)', async () => {
    classify({})

    const context = await getCampaignComposerContextService(
      ORG_ID,
      ALL,
      'general_assembly'
    )

    expect(context.counts).toMatchObject({
      unsubscribed: 1,
      reinstated: 0,
      nature: 'facultative',
    })
  })

  it('le composeur reçoit la nature de chaque modèle, lue dans les réglages', async () => {
    const context = await getCampaignComposerContextService(ORG_ID, ALL, 'free')

    expect(context.templateNatures).toEqual({
      free: 'facultative',
      reminder: 'facultative',
      invoice: 'facultative',
      general_assembly: 'statutaire',
      post_assembly_documents: 'facultative',
      unpaid_reminder: 'facultative',
    })
  })

  it('l’aperçu et le plan d’envoi comptent la cible du modèle choisi', async () => {
    const preview = await previewCampaignService({
      ...assembly,
      memberProfileId: PROFILE_D,
    })
    expect(preview.status === 'ok' && preview.preview.member.id).toBe(PROFILE_D)
    expect(preview.status === 'ok' && preview.preview.counts).toMatchObject({
      recipients: 3,
      reinstated: 1,
      nature: 'statutaire',
    })

    const statutoryPlan = await previewCampaignPlanService(
      ORG_ID,
      ALL,
      'general_assembly'
    )
    const optionalPlan = await previewCampaignPlanService(ORG_ID, ALL, 'free')
    expect(statutoryPlan.parts).toEqual([{day: '2026-11-12', count: 3}])
    expect(optionalPlan.parts).toEqual([{day: '2026-11-12', count: 2}])
  })

  it('reclasser un modèle change la cible de l’envoi suivant, pas la nature figée du premier (critère 6)', async () => {
    classify({general_assembly: 'facultative'})
    await sendCampaignService({...sendInput, ...assembly})

    classify({general_assembly: 'statutaire'})
    await sendCampaignService({
      ...sendInput,
      ...assembly,
      submissionId: OTHER_ORG_ID,
    })

    const [first, second] = vi.mocked(createCampaignWithRecipientsTxnDao).mock
      .calls
    expect(first[0]).toMatchObject({nature: 'facultative'})
    expect(first[2].map((r) => r.memberProfileId)).not.toContain(PROFILE_D)
    expect(second[0]).toMatchObject({nature: 'statutaire'})
    expect(second[2].map((r) => r.memberProfileId)).toContain(PROFILE_D)
  })

  it('une nature glissée dans la saisie est ignorée : seule celle des réglages compte', async () => {
    await sendCampaignService({
      ...sendInput,
      nature: 'statutaire',
    } as never)

    const [campaign, , recipients] = vi.mocked(
      createCampaignWithRecipientsTxnDao
    ).mock.calls[0]
    expect(campaign).toMatchObject({nature: 'facultative'})
    expect(recipients.map((r) => r.memberProfileId)).not.toContain(PROFILE_D)
  })

  it('l’aperçu montre le pied de la nature courante du modèle (critère 4)', async () => {
    await previewCampaignService(assembly)
    await previewCampaignService(content)

    expect(
      vi.mocked(CampaignMail).mock.calls.map(([props]) => props.nature)
    ).toEqual(['statutaire', 'facultative'])
    expect(
      vi.mocked(getCampaignFooterTexts).mock.calls.map((call) => call[2])
    ).toEqual(['statutaire', 'facultative'])
  })

  it('refuse un modèle inconnu, sans lecture', async () => {
    await expect(
      getCampaignComposerContextService(ORG_ID, ALL, 'urgent' as never)
    ).rejects.toBeInstanceOf(ValidationParsedZodError)
    await expect(
      previewCampaignPlanService(ORG_ID, ALL, 'urgent' as never)
    ).rejects.toBeInstanceOf(ValidationParsedZodError)
    expect(getCampaignTargetRowsDao).not.toHaveBeenCalled()
  })
})

describe('campagnes étiquetées pour leurs statistiques (s30, ADR 068)', () => {
  beforeEach(async () => {
    await setupAuthUserMocked(board)
  })

  it('deux parts livrées : chaque email porte le même tag de campagne (critère 2)', async () => {
    const store = fakeStore()
    store.parts = twoParts()
    store.recipients = [
      ...recipientsOf(PART_1, 3),
      ...recipientsOf(PART_2, 2, 4),
    ]

    await deliver(PART_1)
    await deliver(PART_2)

    const tags = vi
      .mocked(sendEmailService)
      .mock.calls.map(([payload]) => payload.tags)
    expect(tags).toHaveLength(5)
    for (const tag of tags) expect(tag).toEqual([`campaign-${CAMPAIGN_ID}`])
  })

  it('la campagne créée est suivie : ses statistiques pourront être lues', async () => {
    await sendCampaignService(sendInput)

    const [campaign] = vi.mocked(createCampaignWithRecipientsTxnDao).mock
      .calls[0]
    expect(campaign).toMatchObject({statsTracked: true})
  })
})

describe('getCampaignStatisticsService — ouvertures et clics (s30, ADR 068)', () => {
  const NOW = new Date('2026-11-12T13:32:00.000Z')
  const TAG_QUERY = {
    tag: `campaign-${CAMPAIGN_ID}`,
    startDate: '2026-11-11',
    endDate: '2026-11-12',
  }
  const consolidated = {
    status: 'found' as const,
    requests: 302,
    delivered: 300,
    uniqueOpens: 154,
    uniqueClicks: 42,
  }
  const sentCampaign = (overrides: Record<string, unknown> = {}) =>
    campaignRow({
      status: 'sent',
      sentCount: 302,
      statsTracked: true,
      statsUniqueOpens: null,
      statsUniqueClicks: null,
      statsReadAt: null,
      finishedAt: new Date('2026-11-12T13:40:00Z'),
      ...overrides,
    }) as never
  const read = () =>
    getCampaignStatisticsService(
      {organizationId: ORG_ID, campaignId: CAMPAIGN_ID},
      NOW
    )

  beforeEach(async () => {
    await setupAuthUserMocked(board)
    vi.mocked(getCampaignByIdDao).mockResolvedValue(sentCampaign())
    vi.mocked(readEmailTagStatisticsService).mockResolvedValue(consolidated)
    vi.mocked(saveCampaignStatisticsTxnDao).mockResolvedValue()
  })

  it('[ORGANIZATION ADMIN] le bureau lit les chiffres consolidés de sa campagne (critère 1)', async () => {
    await expect(read()).resolves.toEqual({
      status: 'found',
      statistics: {
        state: 'available',
        sentCount: 302,
        uniqueOpens: 154,
        uniqueClicks: 42,
        openRate: 51,
        clickRate: 14,
        readAt: NOW.toISOString(),
        fromSnapshot: false,
      },
    })
    expect(readEmailTagStatisticsService).toHaveBeenCalledWith(TAG_QUERY)
  })

  it('[SUPER_ADMIN] le SuperAdmin hors imitation lit aussi', async () => {
    await setupAuthUserMocked(userTestSuperAdmin)

    await expect(read()).resolves.toMatchObject({status: 'found'})
  })

  it('la campagne est lue sous le tenant avant tout appel au fournisseur', async () => {
    const order: string[] = []
    vi.mocked(getCampaignByIdDao).mockImplementation(async () => {
      order.push(`campaign:${scope.current}`)
      return sentCampaign()
    })
    vi.mocked(readEmailTagStatisticsService).mockImplementation(async () => {
      order.push(`provider:${scope.current}`)
      return consolidated
    })

    await read()

    expect(order).toEqual([`campaign:${ORG_ID}`, 'provider:undefined'])
    expect(getCampaignByIdDao).toHaveBeenCalledWith(ORG_ID, CAMPAIGN_ID)
  })

  it('une campagne d’une autre association est introuvable, le fournisseur jamais appelé (critère 4)', async () => {
    vi.mocked(getCampaignByIdDao).mockResolvedValue(undefined)

    await expect(read()).resolves.toEqual({status: 'not_found'})
    expect(readEmailTagStatisticsService).not.toHaveBeenCalled()
    expect(saveCampaignStatisticsTxnDao).not.toHaveBeenCalled()
  })

  it('consolidé : le relevé est écrit sous le tenant', async () => {
    const scopes: (string | undefined)[] = []
    vi.mocked(saveCampaignStatisticsTxnDao).mockImplementation(async () => {
      scopes.push(scope.current)
    })

    await read()

    expect(saveCampaignStatisticsTxnDao).toHaveBeenCalledWith(CAMPAIGN_ID, {
      uniqueOpens: 154,
      uniqueClicks: 42,
      readAt: NOW,
    })
    expect(scopes).toEqual([ORG_ID])
  })

  it('pas encore consolidé : « pas encore », aucun relevé écrit (critère 3)', async () => {
    vi.mocked(readEmailTagStatisticsService).mockResolvedValue({
      ...consolidated,
      requests: 12,
    })

    await expect(read()).resolves.toEqual({
      status: 'found',
      statistics: {state: 'pending_provider'},
    })
    expect(saveCampaignStatisticsTxnDao).not.toHaveBeenCalled()
  })

  it('fournisseur en échec : indisponible, journalisé sans le message, rien écrit', async () => {
    vi.mocked(readEmailTagStatisticsService).mockRejectedValue(
      new EmailTransportError('brevo', 'Brevo injoignable secret-detail')
    )

    await expect(read()).resolves.toEqual({
      status: 'found',
      statistics: {state: 'unavailable', reason: 'unreachable'},
    })
    expect(saveCampaignStatisticsTxnDao).not.toHaveBeenCalled()
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(
      'secret-detail'
    )
    expect(logger.error).toHaveBeenCalled()
  })

  it('fournisseur en échec avec un relevé : le relevé conservé, sans réécriture', async () => {
    vi.mocked(getCampaignByIdDao).mockResolvedValue(
      sentCampaign({
        statsUniqueOpens: 150,
        statsUniqueClicks: 40,
        statsReadAt: new Date('2026-11-12T10:00:00Z'),
      })
    )
    vi.mocked(readEmailTagStatisticsService).mockRejectedValue(
      new EmailTransportError('brevo', 'Brevo injoignable')
    )

    await expect(read()).resolves.toMatchObject({
      status: 'found',
      statistics: {
        state: 'available',
        uniqueOpens: 150,
        uniqueClicks: 40,
        readAt: '2026-11-12T10:00:00.000Z',
        fromSnapshot: true,
      },
    })
    expect(saveCampaignStatisticsTxnDao).not.toHaveBeenCalled()
  })

  it('campagne en cours : dernier jour d’envoi lu des parts, fournisseur non appelé', async () => {
    vi.mocked(getCampaignByIdDao).mockResolvedValue(
      sentCampaign({status: 'sending', sentCount: 100, finishedAt: null})
    )
    vi.mocked(getCampaignPartsDao).mockResolvedValue([
      {
        id: 'p1',
        campaignId: CAMPAIGN_ID,
        number: 1,
        scheduledFor: '2026-11-12',
        recipientCount: 100,
        status: 'sent',
        deferredTo: '2026-11-15',
      },
      {
        id: 'p2',
        campaignId: CAMPAIGN_ID,
        number: 2,
        scheduledFor: '2026-11-14',
        recipientCount: 100,
        status: 'scheduled',
        deferredTo: null,
      },
    ])

    await expect(read()).resolves.toEqual({
      status: 'found',
      statistics: {state: 'pending_sending', lastSendDay: '2026-11-15'},
    })
    expect(getCampaignPartsDao).toHaveBeenCalledWith([CAMPAIGN_ID])
    expect(readEmailTagStatisticsService).not.toHaveBeenCalled()
  })

  it('campagne antérieure à s30 (non suivie) : indisponible, fournisseur non appelé', async () => {
    vi.mocked(getCampaignByIdDao).mockResolvedValue(
      sentCampaign({statsTracked: false})
    )

    await expect(read()).resolves.toEqual({
      status: 'found',
      statistics: {state: 'unavailable', reason: 'untracked'},
    })
    expect(readEmailTagStatisticsService).not.toHaveBeenCalled()
  })

  it('à 00:30 à Paris (23:30 UTC la veille) : Brevo lit jusqu’au jour UTC, jamais « demain »', async () => {
    await getCampaignStatisticsService(
      {organizationId: ORG_ID, campaignId: CAMPAIGN_ID},
      new Date('2026-11-12T23:30:00.000Z')
    )

    expect(readEmailTagStatisticsService).toHaveBeenCalledWith(TAG_QUERY)
  })

  it('identifiant hors forme : erreur de validation, aucune lecture', async () => {
    await expect(
      getCampaignStatisticsService(
        {organizationId: ORG_ID, campaignId: 'pas-un-uuid'},
        NOW
      )
    ).rejects.toBeInstanceOf(ValidationParsedZodError)
    expect(getCampaignByIdDao).not.toHaveBeenCalled()
    expect(readEmailTagStatisticsService).not.toHaveBeenCalled()
  })
})
