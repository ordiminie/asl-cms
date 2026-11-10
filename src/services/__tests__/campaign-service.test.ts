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
  getPendingRecipientsDao: vi.fn(),
  markRecipientSentTxnDao: vi.fn(),
  markRecipientFailedTxnDao: vi.fn(),
  finishCampaignTxnDao: vi.fn(),
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
  createCampaignWithRecipientsTxnDao,
  finishCampaignTxnDao,
  getCampaignByIdDao,
  getCampaignsPageDao,
  getCampaignTargetRowsDao,
  getCurrentParcelNumbersForMembersDao,
  getPendingRecipientsDao,
  markRecipientFailedTxnDao,
  markRecipientSentTxnDao,
} from '@/db/repositories/campaign-repository'
import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {withTenant} from '@/db/tenant-scope'
import CampaignMail from '@/lib/emails/campaign-email'
import {logger} from '@/lib/logger'

import {getAssociationSettingsService} from '../association-settings-service'
import {getActingContext} from '../authentication/auth-service'
import {
  canManageCampaignsService,
  deliverCampaignService,
  getCampaignComposerContextService,
  getCampaignService,
  listCampaignsService,
  previewCampaignService,
  sendCampaignService,
} from '../campaign-service'
import {isClientEmailEnabledService, sendEmailService} from '../email-service'
import {AuthorizationError} from '../errors/authorization-error'
import {ValidationParsedZodError} from '../errors/validation-error'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {CAMPAIGNS_PAGE_SIZE} from '../types/domain/campaign-types'
import {OrganizationRole} from '../types/domain/organization-types'
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

const pending = (count: number) =>
  Array.from({length: count}, (_, index) => ({
    recipientId: `r${index + 1}`,
    memberProfileId: `p${index + 1}`,
    name: `Membre ${index + 1}`,
    email: `m${index + 1}@example.fr`,
    unsubscribeToken: `token-${index + 1}`,
    parcelNumbers: ['12', '14'],
  }))

const writeDaos = () => [
  createCampaignWithRecipientsTxnDao,
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
    getPendingRecipientsDao,
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
  vi.mocked(createCampaignWithRecipientsTxnDao).mockResolvedValue({
    campaign: campaignRow() as never,
    created: true,
  })
  vi.mocked(getCampaignByIdDao).mockResolvedValue(campaignRow() as never)
  vi.mocked(getCampaignsPageDao).mockResolvedValue({
    rows: [campaignRow() as never],
    total: 1,
  })
  vi.mocked(getPendingRecipientsDao).mockResolvedValue(pending(2))
  vi.mocked(markRecipientSentTxnDao).mockResolvedValue({
    campaignId: CAMPAIGN_ID,
    sentCount: 1,
  })
  vi.mocked(markRecipientFailedTxnDao).mockResolvedValue({id: 'r'})
  vi.mocked(finishCampaignTxnDao).mockResolvedValue({id: CAMPAIGN_ID})
  vi.mocked(sendEmailService).mockResolvedValue()
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
    const [campaign, recipients] = vi.mocked(createCampaignWithRecipientsTxnDao)
      .mock.calls[0]
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
    expect(getPendingRecipientsDao).not.toHaveBeenCalled()
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
    })

    const result = await sendCampaignService(sendInput)

    expect(result).toEqual({
      status: 'created',
      campaignId: CAMPAIGN_ID,
      deliver: null,
    })
    expect(createCampaignWithRecipientsTxnDao).toHaveBeenCalledTimes(1)
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

    const [campaign, recipients] = vi.mocked(createCampaignWithRecipientsTxnDao)
      .mock.calls[0]
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

describe('deliverCampaignService — livraison, arrêt au premier échec', () => {
  it('N envois → N lignes sent, campagne sent, un withTenant court par destinataire', async () => {
    vi.mocked(getPendingRecipientsDao).mockResolvedValue(pending(3))

    await deliverCampaignService(ORG_ID, CAMPAIGN_ID)

    expect(sendEmailService).toHaveBeenCalledTimes(3)
    expect(markRecipientSentTxnDao).toHaveBeenCalledTimes(3)
    expect(finishCampaignTxnDao).toHaveBeenCalledWith(CAMPAIGN_ID, 'sent')
    expect(markRecipientFailedTxnDao).not.toHaveBeenCalled()
    expect(vi.mocked(withTenant).mock.calls.length).toBeGreaterThanOrEqual(5)
    for (const [organizationId] of vi.mocked(withTenant).mock.calls) {
      expect(organizationId).toBe(ORG_ID)
    }
  })

  it('chaque envoi porte expéditeur, Reply-To, en-têtes List-Unsubscribe et URL du jeton', async () => {
    vi.mocked(getPendingRecipientsDao).mockResolvedValue(pending(1))

    await deliverCampaignService(ORG_ID, CAMPAIGN_ID)

    const [payload, options] = vi.mocked(sendEmailService).mock.calls[0]
    expect(payload).toMatchObject({
      to: 'm1@example.fr',
      subject: 'ASL Les Pins — Peinture du portail',
      senderName: 'ASL Les Pins',
      replyTo: 'bureau@asl-les-pins.test',
      headers: {
        'List-Unsubscribe': `<${ORIGIN}/api/campaigns/unsubscribe/token-1>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })
    expect(payload.text).toContain(`${ORIGIN}/desinscription/token-1`)
    expect(payload.text).toContain('Bonjour Membre 1')
    expect(options).toEqual({recipientType: 'client'})
    expect(vi.mocked(CampaignMail).mock.calls[0][0]).toMatchObject({
      heading: 'Peinture du portail',
      unsubscribeUrl: `${ORIGIN}/desinscription/token-1`,
    })
  })

  it('échec au 3ᵉ → interrupted, 2 sent, 1 failed, restants pending, rien après l’échec', async () => {
    vi.mocked(getPendingRecipientsDao).mockResolvedValue(pending(5))
    vi.mocked(sendEmailService)
      .mockResolvedValueOnce()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('quota'))

    await deliverCampaignService(ORG_ID, CAMPAIGN_ID)

    expect(sendEmailService).toHaveBeenCalledTimes(3)
    expect(markRecipientSentTxnDao).toHaveBeenCalledTimes(2)
    expect(markRecipientFailedTxnDao).toHaveBeenCalledTimes(1)
    expect(markRecipientFailedTxnDao).toHaveBeenCalledWith('r3')
    expect(finishCampaignTxnDao).toHaveBeenCalledTimes(1)
    expect(finishCampaignTxnDao).toHaveBeenCalledWith(
      CAMPAIGN_ID,
      'interrupted'
    )
  })

  it('campagne absente ou déjà close → aucune livraison', async () => {
    vi.mocked(getCampaignByIdDao).mockResolvedValue(
      campaignRow({status: 'sent'}) as never
    )

    await deliverCampaignService(ORG_ID, CAMPAIGN_ID)

    expect(sendEmailService).not.toHaveBeenCalled()
    expect(finishCampaignTxnDao).not.toHaveBeenCalled()
  })

  it('envoi coupé entre-temps par les réglages → interrupted sans aucun « envoyé »', async () => {
    vi.mocked(isClientEmailEnabledService).mockResolvedValue(false)

    await deliverCampaignService(ORG_ID, CAMPAIGN_ID)

    expect(sendEmailService).not.toHaveBeenCalled()
    expect(markRecipientSentTxnDao).not.toHaveBeenCalled()
    expect(finishCampaignTxnDao).toHaveBeenCalledWith(
      CAMPAIGN_ID,
      'interrupted'
    )
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
