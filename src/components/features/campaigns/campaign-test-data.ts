import type {
  CampaignDTO,
  CampaignListPageDTO,
  CampaignPartDTO,
  CampaignRecipientDTO,
  CampaignRecipientsPageDTO,
} from '@/services/types/domain/campaign-types'

export const partOf = (
  number: number,
  day: string,
  recipientCount: number,
  overrides: Partial<CampaignPartDTO> = {}
): CampaignPartDTO => ({
  number,
  day,
  recipientCount,
  receivedCount: recipientCount,
  toVerifyCount: 0,
  displayState: 'sent',
  ...overrides,
})

/** La campagne de 296 membres en trois parts, part 3 programmee (ecran 2a). */
export const spreadCampaignOf = (
  id: string,
  overrides: Partial<CampaignDTO> = {}
): CampaignDTO =>
  campaignOf(id, {
    status: 'sending',
    displayState: 'sending',
    sentCount: 200,
    finishedAt: null,
    recipientCounts: {
      received: 200,
      scheduled: 96,
      sending: 0,
      toVerify: 0,
      failed: 0,
      unsubscribed: 0,
    },
    parts: [
      partOf(1, '2026-11-12', 100),
      partOf(2, '2026-11-13', 100),
      partOf(3, '2026-11-14', 96, {
        receivedCount: 0,
        displayState: 'scheduled',
      }),
    ],
    ...overrides,
  })

export const recipientOf = (
  id: string,
  overrides: Partial<CampaignRecipientDTO> = {}
): CampaignRecipientDTO => ({
  id,
  name: `Membre ${id}`,
  parcelNumbers: ['A-0102'],
  status: 'sent',
  sentAt: '2026-11-12T13:40:00.000Z',
  scheduledFor: '2026-11-12',
  ...overrides,
})

export const recipientsPageOf = (
  items: CampaignRecipientDTO[],
  overrides: Partial<CampaignRecipientsPageDTO> = {}
): CampaignRecipientsPageDTO => ({
  items,
  filter: 'all',
  page: 1,
  pageSize: 25,
  total: items.length,
  totalPages: 1,
  ...overrides,
})

export const campaignOf = (
  id: string,
  overrides: Partial<CampaignDTO> = {}
): CampaignDTO => ({
  id,
  subject: `Objet ${id}`,
  preheader: 'Merci de laisser le passage libre.',
  bodyMarkdown: 'Bonjour {nom},\n\nVotre parcelle **{parcelle}**.',
  templateId: 'free',
  targetKind: 'all_members',
  recipientCount: 296,
  withoutEmailCount: 71,
  unsubscribedCount: 15,
  sentCount: 296,
  status: 'sent',
  displayState: 'sent',
  recipientCounts: {
    received: 296,
    scheduled: 0,
    sending: 0,
    toVerify: 0,
    failed: 0,
    unsubscribed: 0,
  },
  parts: [partOf(1, '2026-11-12', 296)],
  sendDate: '2026-11-12',
  authorName: 'Marie Delorme',
  createdAt: '2026-11-12T13:32:00.000Z',
  updatedAt: '2026-11-12T13:40:00.000Z',
  finishedAt: '2026-11-12T13:40:00.000Z',
  ...overrides,
})

export const campaignListOf = (
  items: CampaignDTO[],
  overrides: Partial<CampaignListPageDTO> = {}
): CampaignListPageDTO => ({
  items,
  page: 1,
  pageSize: 25,
  total: items.length,
  totalPages: 1,
  ...overrides,
})
