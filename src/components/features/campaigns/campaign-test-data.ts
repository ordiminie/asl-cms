import type {
  CampaignDTO,
  CampaignListPageDTO,
} from '@/services/types/domain/campaign-types'

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
