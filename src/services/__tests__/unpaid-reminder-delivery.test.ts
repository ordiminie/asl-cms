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
  markRecipientSentTxnDao,
  markRecipientSettledTxnDao,
  releaseRecipientClaimTxnDao,
} from '@/db/repositories/campaign-repository'
import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {listUnpaidRemindersDao} from '@/db/repositories/unpaid-reminder-repository'

import {getAssociationSettingsService} from '../association-settings-service'
import {resolveMemberBillingProvider} from '../billing/resolve-member-billing-provider'
import {deliverCampaignPartService} from '../campaign-service'
import {isClientEmailEnabledService, sendEmailService} from '../email-service'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  resolveSettings,
} from '../types/domain/association-settings-types'
import type {MemberInvoice} from '../types/domain/member-invoice-types'
import type {ScheduledJob} from '../types/domain/scheduled-job-types'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const CAMPAIGN_ID = '33333333-3333-4333-8333-333333333333'
const PART_ID = '44444444-4444-4444-8444-444444444444'
const PROFILE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PROFILE_A2 = 'abababab-abab-4bab-8bab-abababababab'
const PROFILE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const DUE = '2026-03-31'
const NOW = new Date('2026-04-24T08:00:00.000Z')

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
  {key: 'billing.unpaid_statuses', value: 'En attente'},
  {key: 'billing.settled_statuses', value: 'Payée'},
  {key: 'billing.invoice_subject', value: 'Facture {année}'},
])

const invoice = (
  memberProfileId: string,
  overrides: Partial<MemberInvoice> = {}
): MemberInvoice => ({
  id: `inv-${memberProfileId.slice(0, 4)}`,
  memberProfileId,
  parcelId: null,
  parcelNumber: '12',
  meterNumber: null,
  source: 'site',
  year: 2026,
  issuedOn: '2026-02-15',
  dueOn: DUE,
  amountCents: 32000,
  status: 'En attente',
  hasPdf: false,
  paymentUrl: null,
  ...overrides,
})

const provider = {id: 'manual', canWrite: true, listInvoicesOf: vi.fn()}

const reminderCampaign = (templateId = 'unpaid_reminder') => ({
  id: CAMPAIGN_ID,
  organizationId: ORG_ID,
  subject: 'Facture impayée',
  preheader: null,
  bodyMarkdown: 'Bonjour {nom},\n\n{factures}\n\nMerci.',
  templateId,
  nature: 'statutaire' as const,
  status: 'sending' as const,
  sendDate: '2026-04-21',
})

const pending = (
  recipientId: string,
  memberProfileIds: string[],
  email = `${recipientId}@example.fr`
) => ({
  recipientId,
  memberProfileId: memberProfileIds[0],
  name: 'Claire Aubert',
  email,
  unsubscribeToken: `token-${recipientId}`,
  unsubscribed: false,
  parcelNumbers: ['12'],
  accountName: null,
  addressProfileCount: memberProfileIds.length,
  memberProfileIds,
})

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
  vi.mocked(resolveMemberBillingProvider).mockReturnValue(provider)
  vi.mocked(getCampaignPartDao).mockResolvedValue({
    id: PART_ID,
    campaignId: CAMPAIGN_ID,
    number: 1,
    scheduledFor: '2026-04-21',
    recipientCount: 1,
    status: 'sending',
  })
  vi.mocked(getCampaignByIdDao).mockResolvedValue(reminderCampaign() as never)
  vi.mocked(listUnpaidRemindersDao).mockResolvedValue([
    {
      dueOn: DUE,
      rank: 1,
      campaignId: CAMPAIGN_ID,
      campaignStatus: 'sending',
      lastSentOn: null,
    },
  ])
  vi.mocked(claimRecipientForSendTxnDao).mockResolvedValue(true)
  vi.mocked(markRecipientSentTxnDao).mockResolvedValue({
    campaignId: CAMPAIGN_ID,
    sentCount: 1,
  })
  vi.mocked(markRecipientSettledTxnDao).mockResolvedValue({id: 'r1'})
  vi.mocked(countUnfinishedCampaignPartsDao).mockResolvedValue(0)
  vi.mocked(sendEmailService).mockResolvedValue({status: 'sent'})
  vi.mocked(getAllottedRecipientsByDayDao).mockResolvedValue({})
  vi.mocked(getSlidableCampaignPartsDao).mockResolvedValue([])
})

const sentPayloads = () =>
  vi.mocked(sendEmailService).mock.calls.map(([payload]) => payload)

describe('livraison d’une relance d’impayé (s29, ADR 070 §3, §9)', () => {
  it('une facture réglée pendant un report : la ligne passe `settled`, rien ne part', async () => {
    vi.mocked(getPendingPartRecipientsDao).mockResolvedValue([
      pending('r1', [PROFILE_A]),
    ])
    provider.listInvoicesOf.mockResolvedValue([
      invoice(PROFILE_A, {status: 'Payée'}),
    ])

    const outcome = await deliverCampaignPartService(job, NOW)

    expect(provider.listInvoicesOf).toHaveBeenCalledWith(ORG_ID, [PROFILE_A])
    expect(markRecipientSettledTxnDao).toHaveBeenCalledWith('r1')
    expect(claimRecipientForSendTxnDao).not.toHaveBeenCalled()
    expect(sendEmailService).not.toHaveBeenCalled()
    expect(outcome).toEqual({status: 'completed'})
  })

  it('une facture impayée d’une autre échéance ne relance pas celle-ci', async () => {
    vi.mocked(getPendingPartRecipientsDao).mockResolvedValue([
      pending('r1', [PROFILE_A]),
    ])
    provider.listInvoicesOf.mockResolvedValue([
      invoice(PROFILE_A, {dueOn: '2025-03-31'}),
    ])

    await deliverCampaignPartService(job, NOW)

    expect(markRecipientSettledTxnDao).toHaveBeenCalledWith('r1')
    expect(sendEmailService).not.toHaveBeenCalled()
  })

  it('deux factures de l’adresse regroupées dans une seule relance, {factures} en liste', async () => {
    vi.mocked(getPendingPartRecipientsDao).mockResolvedValue([
      pending('r1', [PROFILE_A, PROFILE_A2], 'foyer@example.fr'),
    ])
    provider.listInvoicesOf.mockResolvedValue([
      invoice(PROFILE_A, {parcelNumber: '12', amountCents: 32000}),
      invoice(PROFILE_A2, {
        id: 'inv-2',
        parcelNumber: '14',
        amountCents: 18500,
      }),
    ])

    await deliverCampaignPartService(job, NOW)

    expect(sendEmailService).toHaveBeenCalledOnce()
    const [payload] = sentPayloads()
    expect(payload.to).toBe('foyer@example.fr')
    expect(payload.text).toContain(
      '- Facture 2026, parcelle 12 : 320,00 €, à régler avant le 31/03/2026'
    )
    expect(payload.text).toContain(
      '- Facture 2026, parcelle 14 : 185,00 €, à régler avant le 31/03/2026'
    )
    expect(payload.text).not.toContain('{factures}')
    expect(markRecipientSentTxnDao).toHaveBeenCalledWith('r1')
  })

  it('hors requête (planificateur) : la ligne sans parcelle est traduite depuis messages/fr.json', async () => {
    vi.mocked(getPendingPartRecipientsDao).mockResolvedValue([
      pending('r1', [PROFILE_A]),
    ])
    provider.listInvoicesOf.mockResolvedValue([
      invoice(PROFILE_A, {parcelNumber: null, amountCents: 32000}),
    ])

    const outcome = await deliverCampaignPartService(job, NOW)

    const [payload] = sentPayloads()
    expect(payload.text).toContain(
      '- Facture 2026 : 320,00 €, à régler avant le 31/03/2026'
    )
    expect(markRecipientSentTxnDao).toHaveBeenCalledWith('r1')
    expect(outcome).toEqual({status: 'completed'})
  })

  it('reportée faute de budget : la ligne est rendue en attente, jamais perdue (critère 5)', async () => {
    vi.mocked(getPendingPartRecipientsDao).mockResolvedValue([
      pending('r1', [PROFILE_A]),
    ])
    provider.listInvoicesOf.mockResolvedValue([invoice(PROFILE_A)])
    vi.mocked(sendEmailService).mockResolvedValue({
      status: 'deferred',
      until: '2026-04-25',
    })

    const outcome = await deliverCampaignPartService(job, NOW)

    expect(sendEmailService).toHaveBeenCalledWith(
      expect.anything(),
      {scope: 'tenant', organizationId: ORG_ID, nature: 'campaign'},
      {recipientType: 'client'}
    )
    expect(releaseRecipientClaimTxnDao).toHaveBeenCalledWith('r1')
    expect(markRecipientSettledTxnDao).not.toHaveBeenCalled()
    expect(outcome.status).toBe('deferred')
  })

  it('factures illisibles à l’envoi : rien ne part, la part sera retentée', async () => {
    vi.mocked(getPendingPartRecipientsDao).mockResolvedValue([
      pending('r1', [PROFILE_A]),
    ])
    provider.listInvoicesOf.mockRejectedValue(new Error('Pennylane 503'))

    const outcome = await deliverCampaignPartService(job, NOW)

    expect(sendEmailService).not.toHaveBeenCalled()
    expect(markRecipientSettledTxnDao).not.toHaveBeenCalled()
    expect(outcome.status).toBe('retry')
  })

  it('une campagne manuelle ne relit aucune facture', async () => {
    vi.mocked(getCampaignByIdDao).mockResolvedValue(
      reminderCampaign('reminder') as never
    )
    vi.mocked(getPendingPartRecipientsDao).mockResolvedValue([
      pending('r1', [PROFILE_B]),
    ])

    await deliverCampaignPartService(job, NOW)

    expect(provider.listInvoicesOf).not.toHaveBeenCalled()
    expect(listUnpaidRemindersDao).not.toHaveBeenCalled()
    expect(sendEmailService).toHaveBeenCalledOnce()
  })
})
