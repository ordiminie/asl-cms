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
  lockCampaignScheduleTxnDao,
  markRecipientFailedTxnDao,
  markRecipientSentTxnDao,
  markRecipientToVerifyTxnDao,
  markRecipientUnsubscribedTxnDao,
  markSendingRecipientsToVerifyTxnDao,
  markStaleSendingRecipientsToVerifyTxnDao,
  releaseRecipientClaimTxnDao,
  startCampaignPartTxnDao,
} from '@/db/repositories/campaign-repository'
import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {enqueueScheduledJobTxnDao} from '@/db/repositories/scheduled-job-repository'
import {withTenant} from '@/db/tenant-scope'
import CampaignMail from '@/lib/emails/campaign-email'
import {EmailTransportError} from '@/lib/emails/transport/email-transport'
import {logger} from '@/lib/logger'

import {getAssociationSettingsService} from '../association-settings-service'
import {getActingContext} from '../authentication/auth-service'
import {
  campaignScheduledJobHandlers,
  canManageCampaignsService,
  deliverCampaignPartService,
  getCampaignComposerContextService,
  getCampaignRecipientsService,
  getCampaignService,
  listCampaignsService,
  previewCampaignPlanService,
  previewCampaignService,
  sendCampaignService,
} from '../campaign-service'
import {isClientEmailEnabledService, sendEmailService} from '../email-service'
import {AuthorizationError} from '../errors/authorization-error'
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
}

const sendInput = {...content, submissionId: SUBMISSION_ID}

const targetRows = () => [
  {
    memberProfileId: PROFILE_A,
    name: 'Claire Aubert',
    email: 'claire@example.fr',
    unsubscribed: false,
  },
  {
    memberProfileId: PROFILE_B,
    name: 'Paul Renaud',
    email: 'paul@example.fr',
    unsubscribed: false,
  },
  {
    memberProfileId: PROFILE_C,
    name: 'Sans Email',
    email: null,
    unsubscribed: false,
  },
  {
    memberProfileId: PROFILE_D,
    name: 'Désinscrite',
    email: 'd@example.fr',
    unsubscribed: true,
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
  targetKind: 'all_members',
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
  vi.mocked(sendEmailService).mockResolvedValue()
  vi.mocked(getCampaignPartsDao).mockResolvedValue([])
  vi.mocked(getRecipientStatusCountsDao).mockResolvedValue([])
  vi.mocked(getCampaignRecipientsPageDao).mockResolvedValue({
    rows: [],
    total: 0,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

const calls: [string, () => Promise<unknown>][] = [
  [
    'lire le contexte du composeur',
    () => getCampaignComposerContextService(ORG_ID),
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
      getCampaignComposerContextService(ORG_ID)
    ).resolves.toMatchObject({associationName: 'ASL Les Pins'})
  })
})

describe('getCampaignComposerContextService — décompte avant l’envoi (critère 2)', () => {
  beforeEach(async () => {
    await setupAuthUserMocked(board)
  })

  it('distingue destinataires, sans email et désinscrits, et la somme fait le total', async () => {
    const context = await getCampaignComposerContextService(ORG_ID)

    expect(context.counts).toEqual({
      recipients: 2,
      withoutEmail: 1,
      unsubscribed: 1,
      total: 4,
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
      {memberProfileId: PROFILE_C, name: 'X', email: null, unsubscribed: false},
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
        runAfter: new Date('2026-11-12T23:00:00.000Z'),
      }),
      expect.objectContaining({
        idempotencyKey: 'part-3',
        runAfter: new Date('2026-11-13T23:00:00.000Z'),
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

    const plan = await previewCampaignPlanService(ORG_ID)

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

    await expect(previewCampaignPlanService(ORG_ID)).rejects.toBeInstanceOf(
      AuthorizationError
    )
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
}

type FakePart = {
  id: string
  campaignId: string
  number: number
  scheduledFor: string
  recipientCount: number
  status: 'scheduled' | 'sending' | 'sent' | 'failed'
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
        parcelNumbers: ['12'],
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
  return store
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

  it('chaque envoi porte expéditeur, Reply-To, en-têtes List-Unsubscribe et URL du jeton', async () => {
    await deliver(PART_1)

    const [payload, options] = vi.mocked(sendEmailService).mock.calls[0]
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

  it('un refus certain du fournisseur → ligne rendue en attente, part reprise 30 min plus tard', async () => {
    vi.mocked(sendEmailService)
      .mockResolvedValueOnce()
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
      },
      {
        id: 'p2',
        campaignId: CAMPAIGN_ID,
        number: 2,
        scheduledFor: '2026-11-13',
        recipientCount: 1,
        status: 'scheduled',
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
