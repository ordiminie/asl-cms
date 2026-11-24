import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (_organizationId: string, callback: () => unknown) =>
    callback()
  ),
}))
vi.mock('@/db/repositories/campaign-repository', () => ({
  getCampaignPartDao: vi.fn(),
  getCampaignByIdDao: vi.fn(),
  getPendingPartRecipientsDao: vi.fn(),
  claimRecipientForSendTxnDao: vi.fn(),
  markRecipientSentTxnDao: vi.fn(),
  markRecipientSettledTxnDao: vi.fn(),
  markRecipientSupersededTxnDao: vi.fn(),
  markClaimedRecipientFailedTxnDao: vi.fn(),
  releaseRecipientClaimTxnDao: vi.fn(),
  markRecipientToVerifyTxnDao: vi.fn(),
  markRecipientFailedTxnDao: vi.fn(),
  markRecipientUnsubscribedTxnDao: vi.fn(),
  markStaleSendingRecipientsToVerifyTxnDao: vi.fn(),
  markSendingRecipientsToVerifyTxnDao: vi.fn(),
  startCampaignPartTxnDao: vi.fn(),
  finishCampaignPartTxnDao: vi.fn(),
  countUnfinishedCampaignPartsDao: vi.fn(),
  finishCampaignTxnDao: vi.fn(),
  failCampaignPartsFromTxnDao: vi.fn(),
  failUnreceivedRecipientsTxnDao: vi.fn(),
  lockCampaignScheduleTxnDao: vi.fn(),
  markCampaignPartDeferredTxnDao: vi.fn(),
  getAllottedRecipientsByDayDao: vi.fn(),
  getSlidableCampaignPartsDao: vi.fn(),
  moveCampaignPartTxnDao: vi.fn(),
}))
vi.mock('@/db/repositories/member-invitation-state-repository', () => ({
  getInvitationStatesByEmailsDao: vi.fn(),
  markInvitedTxnDao: vi.fn(),
}))
vi.mock('@/db/repositories/unpaid-reminder-repository', () => ({
  listUnpaidRemindersDao: vi.fn(),
}))
vi.mock('@/db/repositories/organization-repository', () => ({
  getOrganizationByIdDao: vi.fn(),
}))
vi.mock('@/db/repositories/scheduled-job-repository', () => ({
  enqueueScheduledJobTxnDao: vi.fn(),
}))
vi.mock('@/db/repositories/recipient-group-repository', () => ({
  getRecipientGroupByIdDao: vi.fn(),
  getRecipientGroupMemberIdsDao: vi.fn(),
  listRecipientGroupsDao: vi.fn(),
}))
vi.mock('@/lib/better-auth/invitation-link', () => ({
  issueInvitationLink: vi.fn(),
  revokeInvitationLink: vi.fn(),
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
  getCampaignFooterTexts: vi.fn(async () => ({
    associationName: 'ASL Les Pins',
    legalName: null,
    legalMentions: null,
    reason: 'Motif.',
    statutoryNotice: null,
    unsubscribeLabel: 'Ne plus recevoir ces campagnes',
    notice: 'Phrase.',
  })),
}))

import {getTranslations} from 'next-intl/server'

import {
  claimRecipientForSendTxnDao,
  countUnfinishedCampaignPartsDao,
  getAllottedRecipientsByDayDao,
  getCampaignByIdDao,
  getCampaignPartDao,
  getPendingPartRecipientsDao,
  getSlidableCampaignPartsDao,
  markCampaignPartDeferredTxnDao,
  markClaimedRecipientFailedTxnDao,
  markRecipientSentTxnDao,
  markRecipientSupersededTxnDao,
  markRecipientToVerifyTxnDao,
  markRecipientUnsubscribedTxnDao,
  releaseRecipientClaimTxnDao,
} from '@/db/repositories/campaign-repository'
import {
  getInvitationStatesByEmailsDao,
  markInvitedTxnDao,
} from '@/db/repositories/member-invitation-state-repository'
import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {
  issueInvitationLink,
  revokeInvitationLink,
} from '@/lib/better-auth/invitation-link'
import CampaignMail from '@/lib/emails/campaign-email'
import {EmailTransportError} from '@/lib/emails/transport/email-transport'
import {logger} from '@/lib/logger'

import {getAssociationSettingsService} from '../association-settings-service'
import {deliverCampaignPartService} from '../campaign-service'
import {isClientEmailEnabledService, sendEmailService} from '../email-service'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  resolveSettings,
} from '../types/domain/association-settings-types'
import type {ScheduledJob} from '../types/domain/scheduled-job-types'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const CAMPAIGN_ID = '33333333-3333-4333-8333-333333333333'
const PART_ID = '44444444-4444-4444-8444-444444444444'
const CREATED = new Date('2026-11-24T08:00:00.000Z')
const NOW = new Date('2026-11-25T08:00:00.000Z')
const TEXT = 'Bonjour {nom},\n\nVenez voir **le site** <b>ici</b>.'

const job: ScheduledJob = {
  id: 'job',
  organizationId: ORG_ID,
  kind: 'campaign.deliver_part',
  payload: {partId: PART_ID, campaignId: CAMPAIGN_ID},
  attempts: 1,
  resumedAfterStaleLock: false,
}

const settings = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
  {key: 'contact.email', value: 'bureau@asl-les-pins.test'},
  {key: 'invitation.link_days', value: '7'},
])

const launchCampaign = (overrides: Record<string, unknown> = {}) => ({
  id: CAMPAIGN_ID,
  organizationId: ORG_ID,
  subject: 'Votre espace membre vous attend',
  preheader: 'Un espace personnel vous est ouvert.',
  bodyMarkdown: TEXT,
  templateId: 'member_invitation_launch',
  nature: 'statutaire' as const,
  status: 'sending' as const,
  sendDate: '2026-11-24',
  createdAt: CREATED,
  ...overrides,
})

const pending = (recipientId: string, overrides = {}) => ({
  recipientId,
  memberProfileId: `profile-${recipientId}`,
  name: 'Claire Aubert',
  email: `${recipientId}@example.fr`,
  unsubscribeToken: `unsub-${recipientId}`,
  unsubscribed: false,
  parcelNumbers: ['12'],
  accountName: null,
  addressProfileCount: 1,
  memberProfileIds: [`profile-${recipientId}`],
  ...overrides,
})

const stateOf = (
  recipientId: string,
  overrides: {lastInvitedAt?: Date | null; firstSignedInAt?: Date | null} = {}
) => ({
  email: `${recipientId}@example.fr`,
  userId: `user-${recipientId}`,
  lastInvitedAt: null,
  firstSignedInAt: null,
  ...overrides,
})

const tokenOf = (n: number) => `secret-token-${n}`
const urlOf = (n: number) =>
  `https://asl-les-pins.test/api/auth/magic-link/verify?token=${tokenOf(n)}`

const deliver = () => deliverCampaignPartService(job, NOW)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getTranslations).mockRejectedValue(
    new Error('next-intl/server : hors d’une requête Next')
  )
  vi.mocked(isClientEmailEnabledService).mockResolvedValue(true)
  vi.mocked(getAssociationSettingsService).mockResolvedValue(settings)
  vi.mocked(getOrganizationByIdDao).mockResolvedValue({
    id: ORG_ID,
    name: 'ASL Les Pins',
    domain: 'asl-les-pins.test',
    identityLogoKey: null,
  } as never)
  vi.mocked(getCampaignPartDao).mockResolvedValue({
    id: PART_ID,
    campaignId: CAMPAIGN_ID,
    number: 1,
    scheduledFor: '2026-11-24',
    recipientCount: 2,
    status: 'sending',
  })
  vi.mocked(getCampaignByIdDao).mockResolvedValue(launchCampaign() as never)
  vi.mocked(getPendingPartRecipientsDao).mockResolvedValue([
    pending('r1'),
    pending('r2'),
  ])
  vi.mocked(getInvitationStatesByEmailsDao).mockResolvedValue([
    stateOf('r1'),
    stateOf('r2'),
  ])
  let issued = 0
  vi.mocked(issueInvitationLink).mockImplementation(async () => {
    issued += 1
    return {url: urlOf(issued), token: tokenOf(issued)}
  })
  vi.mocked(revokeInvitationLink).mockResolvedValue()
  vi.mocked(claimRecipientForSendTxnDao).mockResolvedValue(true)
  vi.mocked(markRecipientSentTxnDao).mockResolvedValue({
    campaignId: CAMPAIGN_ID,
    sentCount: 1,
  })
  vi.mocked(countUnfinishedCampaignPartsDao).mockResolvedValue(0)
  vi.mocked(sendEmailService).mockResolvedValue({status: 'sent'})
  vi.mocked(getAllottedRecipientsByDayDao).mockResolvedValue({})
  vi.mocked(getSlidableCampaignPartsDao).mockResolvedValue([])
})

const mailInvitations = () =>
  vi
    .mocked(CampaignMail)
    .mock.calls.map(([props]) => props.invitation as {url: string} | undefined)

describe('livraison d’une invitation : un lien par destinataire, né après la prise (ADR 072 §3)', () => {
  it('ordre épinglé : prise, puis émission, puis composition, puis envoi', async () => {
    vi.mocked(getPendingPartRecipientsDao).mockResolvedValue([pending('r1')])

    await expect(deliver()).resolves.toEqual({status: 'completed'})

    const claim = vi.mocked(claimRecipientForSendTxnDao).mock
      .invocationCallOrder[0]
    const issue = vi.mocked(issueInvitationLink).mock.invocationCallOrder[0]
    const compose = vi.mocked(CampaignMail).mock.invocationCallOrder[0]
    const send = vi.mocked(sendEmailService).mock.invocationCallOrder[0]
    expect(claim).toBeLessThan(issue)
    expect(issue).toBeLessThan(compose)
    expect(compose).toBeLessThan(send)
    expect(issueInvitationLink).toHaveBeenCalledWith({
      organization: {id: ORG_ID, domain: 'asl-les-pins.test'},
      email: 'r1@example.fr',
      expiresInDays: 7,
    })
  })

  it('deux destinataires reçoivent deux URL distinctes ; objet préfixé une seule fois ; texte littéral', async () => {
    await deliver()

    expect(mailInvitations().map((invitation) => invitation?.url)).toEqual([
      urlOf(1),
      urlOf(2),
    ])
    const [first] = vi.mocked(CampaignMail).mock.calls[0]
    expect(first.bodyHtml).toBe('')
    expect(first.invitation).toEqual({
      url: urlOf(1),
      expiresOn: '2 décembre 2026',
      text: TEXT,
    })
    const payloads = vi
      .mocked(sendEmailService)
      .mock.calls.map(([payload]) => payload)
    expect(payloads.map((payload) => payload.to)).toEqual([
      'r1@example.fr',
      'r2@example.fr',
    ])
    expect(payloads[0].subject).toBe(
      'ASL Les Pins — Votre espace membre vous attend'
    )
    expect(payloads[0].text).toContain(`Ouvrir mon espace : ${urlOf(1)}`)
    expect(payloads[0].text).toContain('Bonjour {nom},')
    expect(payloads[0].text).toContain('**le site** <b>ici</b>')
    expect(payloads[1].text).toContain(urlOf(2))
    expect(payloads[0].headers).toHaveProperty('List-Unsubscribe')
    expect(vi.mocked(sendEmailService).mock.calls[0].slice(1)).toEqual([
      {scope: 'tenant', organizationId: ORG_ID, nature: 'campaign'},
      {recipientType: 'client'},
    ])
  })

  it('« invitée le » s’écrit au seul départ réel, avec le compte de l’adresse', async () => {
    vi.mocked(sendEmailService)
      .mockResolvedValueOnce({status: 'sent'})
      .mockResolvedValueOnce({status: 'deferred', until: '2026-11-26'})

    await deliver()

    expect(markInvitedTxnDao).toHaveBeenCalledTimes(1)
    expect(markInvitedTxnDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      userId: 'user-r1',
      at: NOW,
    })
    expect(
      vi.mocked(markRecipientSentTxnDao).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(markInvitedTxnDao).mock.invocationCallOrder[0])
  })

  it('prise perdue : aucun lien n’est émis, donc aucun n’est révoqué', async () => {
    vi.mocked(claimRecipientForSendTxnDao).mockResolvedValue(false)

    await expect(deliver()).resolves.toEqual({status: 'completed'})
    expect(issueInvitationLink).not.toHaveBeenCalled()
    expect(revokeInvitationLink).not.toHaveBeenCalled()
    expect(sendEmailService).not.toHaveBeenCalled()
  })

  it('budget épuisé : le jeton émis est révoqué, la ligne libérée, la part glisse (C9)', async () => {
    vi.mocked(getPendingPartRecipientsDao).mockResolvedValue([pending('r1')])
    vi.mocked(sendEmailService).mockResolvedValue({
      status: 'deferred',
      until: '2026-11-26',
    })

    const outcome = await deliver()

    expect(outcome.status).toBe('deferred')
    expect(revokeInvitationLink).toHaveBeenCalledWith(tokenOf(1))
    expect(releaseRecipientClaimTxnDao).toHaveBeenCalledWith('r1')
    expect(markCampaignPartDeferredTxnDao).toHaveBeenCalled()
    expect(markInvitedTxnDao).not.toHaveBeenCalled()
  })

  it('envois coupés pendant la part : le jeton est révoqué, la ligne libérée', async () => {
    vi.mocked(getPendingPartRecipientsDao).mockResolvedValue([pending('r1')])
    vi.mocked(sendEmailService).mockResolvedValue({status: 'skipped'})

    await expect(deliver()).resolves.toEqual({status: 'released'})
    expect(revokeInvitationLink).toHaveBeenCalledWith(tokenOf(1))
    expect(releaseRecipientClaimTxnDao).toHaveBeenCalledWith('r1')
  })

  it('refus certain du fournisseur : révocation et libération, la part compte une tentative', async () => {
    vi.mocked(getPendingPartRecipientsDao).mockResolvedValue([pending('r1')])
    vi.mocked(sendEmailService).mockRejectedValue(
      new EmailTransportError('brevo', 'refusé', {refused: true})
    )

    const outcome = await deliver()

    expect(outcome.status).toBe('retry')
    expect(revokeInvitationLink).toHaveBeenCalledWith(tokenOf(1))
    expect(releaseRecipientClaimTxnDao).toHaveBeenCalledWith('r1')
    expect(markRecipientToVerifyTxnDao).not.toHaveBeenCalled()
  })

  it('issue inconnue : la ligne passe à vérifier, le lien n’est pas révoqué', async () => {
    vi.mocked(getPendingPartRecipientsDao).mockResolvedValue([pending('r1')])
    vi.mocked(sendEmailService).mockRejectedValue(new Error('délai dépassé'))

    await deliver()

    expect(markRecipientToVerifyTxnDao).toHaveBeenCalledWith('r1')
    expect(revokeInvitationLink).not.toHaveBeenCalled()
  })

  it('échec de composition : le jeton émis est révoqué, la ligne libérée, la part s’arrête', async () => {
    vi.mocked(getPendingPartRecipientsDao).mockResolvedValue([pending('r1')])
    vi.mocked(CampaignMail).mockRejectedValueOnce(new Error('gabarit'))

    const outcome = await deliver()

    expect(outcome.status).toBe('retry')
    expect(revokeInvitationLink).toHaveBeenCalledWith(tokenOf(1))
    expect(releaseRecipientClaimTxnDao).toHaveBeenCalledWith('r1')
    expect(sendEmailService).not.toHaveBeenCalled()
  })

  it('lien non émis (compte hors de l’association) : la ligne passe en échec seule, le destinataire suivant est servi (ADR 072 §4)', async () => {
    vi.mocked(issueInvitationLink)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({url: urlOf(9), token: tokenOf(9)})

    await expect(deliver()).resolves.toEqual({status: 'completed'})
    expect(markClaimedRecipientFailedTxnDao).toHaveBeenCalledWith('r1')
    expect(sendEmailService).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendEmailService).mock.calls[0][0].to).toBe(
      'r2@example.fr'
    )
  })

  it('adresse active sans compte : aucun lien demandé, ligne en échec, la part continue', async () => {
    vi.mocked(getInvitationStatesByEmailsDao).mockResolvedValue([stateOf('r2')])

    await expect(deliver()).resolves.toEqual({status: 'completed'})
    expect(markClaimedRecipientFailedTxnDao).toHaveBeenCalledWith('r1')
    expect(issueInvitationLink).toHaveBeenCalledTimes(1)
    expect(sendEmailService).toHaveBeenCalledTimes(1)
  })
})

describe('livraison d’une invitation : nature et écarts (C3, ADR 072 §5)', () => {
  it('statutaire : un désinscrit reçoit l’invitation', async () => {
    vi.mocked(getPendingPartRecipientsDao).mockResolvedValue([
      pending('r1', {unsubscribed: true}),
    ])

    await deliver()

    expect(markRecipientUnsubscribedTxnDao).not.toHaveBeenCalled()
    expect(sendEmailService).toHaveBeenCalledTimes(1)
  })

  it('facultative : un désinscrit passe `unsubscribed`, aucun lien n’est émis', async () => {
    vi.mocked(getCampaignByIdDao).mockResolvedValue(
      launchCampaign({
        nature: 'facultative',
        templateId: 'member_invitation_reminder',
      }) as never
    )
    vi.mocked(getPendingPartRecipientsDao).mockResolvedValue([
      pending('r1', {unsubscribed: true}),
    ])

    await deliver()

    expect(markRecipientUnsubscribedTxnDao).toHaveBeenCalledWith('r1')
    expect(issueInvitationLink).not.toHaveBeenCalled()
  })

  it.each([
    ['connectée depuis', {firstSignedInAt: NOW}],
    ['réinvitée après la création', {lastInvitedAt: NOW}],
  ])(
    'adresse %s : `superseded`, ni prise, ni lien, ni envoi',
    async (_label, traces) => {
      vi.mocked(getPendingPartRecipientsDao).mockResolvedValue([pending('r1')])
      vi.mocked(getInvitationStatesByEmailsDao).mockResolvedValue([
        stateOf('r1', traces),
      ])

      await expect(deliver()).resolves.toEqual({status: 'completed'})
      expect(markRecipientSupersededTxnDao).toHaveBeenCalledWith('r1')
      expect(claimRecipientForSendTxnDao).not.toHaveBeenCalled()
      expect(issueInvitationLink).not.toHaveBeenCalled()
      expect(sendEmailService).not.toHaveBeenCalled()
    }
  )

  it('invitée avant la création : la ligne part', async () => {
    vi.mocked(getPendingPartRecipientsDao).mockResolvedValue([pending('r1')])
    vi.mocked(getInvitationStatesByEmailsDao).mockResolvedValue([
      stateOf('r1', {lastInvitedAt: new Date('2026-11-20T08:00:00.000Z')}),
    ])

    await deliver()

    expect(markRecipientSupersededTxnDao).not.toHaveBeenCalled()
    expect(sendEmailService).toHaveBeenCalledTimes(1)
  })
})

describe('livraison d’une invitation : rien ne conserve le lien (ADR 072 §8)', () => {
  it('aucune URL ni aucun jeton dans les journaux ni dans les arguments des DAO', async () => {
    vi.mocked(sendEmailService)
      .mockRejectedValueOnce(
        new EmailTransportError('brevo', 'refusé', {refused: true})
      )
      .mockResolvedValue({status: 'sent'})

    await deliver()

    const secrets = [tokenOf(1), tokenOf(2), 'magic-link/verify']
    const logged = JSON.stringify([
      vi.mocked(logger.error).mock.calls,
      vi.mocked(logger.info).mock.calls,
      vi.mocked(logger.warn).mock.calls,
      vi.mocked(logger.debug).mock.calls,
    ])
    const daoArgs = JSON.stringify([
      vi.mocked(claimRecipientForSendTxnDao).mock.calls,
      vi.mocked(markRecipientSentTxnDao).mock.calls,
      vi.mocked(releaseRecipientClaimTxnDao).mock.calls,
      vi.mocked(markInvitedTxnDao).mock.calls,
      vi.mocked(markClaimedRecipientFailedTxnDao).mock.calls,
    ])
    for (const secret of secrets) {
      expect(logged).not.toContain(secret)
      expect(daoArgs).not.toContain(secret)
    }
    expect(TEXT).not.toContain('token')
  })
})

describe('campagne ordinaire inchangée', () => {
  it('un modèle du composeur n’émet aucun lien et ne lit aucune trace', async () => {
    vi.mocked(getCampaignByIdDao).mockResolvedValue(
      launchCampaign({
        templateId: 'free',
        bodyMarkdown: 'Bonjour {nom}',
      }) as never
    )
    vi.mocked(getPendingPartRecipientsDao).mockResolvedValue([pending('r1')])

    await deliver()

    expect(issueInvitationLink).not.toHaveBeenCalled()
    expect(getInvitationStatesByEmailsDao).not.toHaveBeenCalled()
    expect(vi.mocked(CampaignMail).mock.calls[0][0].invitation).toBeUndefined()
    expect(sendEmailService).toHaveBeenCalledTimes(1)
  })
})
