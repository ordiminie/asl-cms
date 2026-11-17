import {beforeEach, describe, expect, it, vi} from 'vitest'

import {createMemoryTransport} from '@/lib/emails/transport/memory-transport'

const memoryTransport = createMemoryTransport()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}))
vi.mock('@/lib/emails/transport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/emails/transport')>()),
  getEmailTransport: vi.fn(() => memoryTransport),
}))
vi.mock('@/services/app-settings-service', () => ({
  getBooleanSettingService: vi.fn(() => Promise.resolve(false)),
  getStringSettingService: vi.fn(() => Promise.resolve('')),
}))
vi.mock('@/services/subscription-service', () => ({
  getPlanByPriceIdService: vi.fn(),
}))
vi.mock('@/lib/stripe/stripe-utils', () => ({
  getFormattedPriceFromSubscription: vi.fn(),
  getSubscriptionDetails: vi.fn(),
}))
vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn((_organizationId: string, callback: () => unknown) =>
    callback()
  ),
}))
vi.mock('@/db/repositories/email-send-budget-repository', () => ({
  claimReportableSendTxnDao: vi.fn(async () => true),
  countLoginSendTxnDao: vi.fn(async () => undefined),
  refundReportableSendTxnDao: vi.fn(async () => undefined),
}))
vi.mock('@/db/repositories/deferred-email-repository', () => ({
  createDeferredEmailTxnDao: vi.fn(async () => ({id: 'deferred-1'})),
}))
vi.mock('@/db/repositories/scheduled-job-repository', () => ({
  enqueueScheduledJobTxnDao: vi.fn(),
}))
vi.mock('@/services/association-settings-service', async () => {
  const settings =
    await import('@/services/types/domain/association-settings-types')
  return {
    getAssociationSettingsService: vi.fn(async () =>
      settings.resolveSettings(settings.ASSOCIATION_SETTINGS_REGISTRY, [])
    ),
  }
})

import {createDeferredEmailTxnDao} from '@/db/repositories/deferred-email-repository'
import {claimReportableSendTxnDao} from '@/db/repositories/email-send-budget-repository'
import {env} from '@/env'
import {getEmailTransport} from '@/lib/emails/transport'
import {sendInvoiceStatusAlertEmailService} from '@/services/email-service'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const ALERT_ID = '77777777-7777-4777-8777-777777777777'
const SETTINGS_URL = 'https://clos-fleuri.test/bureau/reglages'

const alert = (overrides: Record<string, unknown> = {}) => ({
  organizationId: ORG_ID,
  alertId: ALERT_ID,
  to: 'presidente@clos-fleuri.test',
  locale: 'fr' as const,
  association: {name: 'Clos-Fleuri', hue: 195 as const},
  status: 'Relance 9',
  invoiceCount: 3,
  settingsUrl: SETTINGS_URL,
  ...overrides,
})

const withoutDevPrefix = (subject: string) => subject.replace(/^\[DEV\] /, '')

describe('sendInvoiceStatusAlertEmailService — un statut de facture est à classer (s19, écran 4)', () => {
  beforeEach(() => {
    memoryTransport.messages.length = 0
    vi.mocked(getEmailTransport).mockReturnValue(memoryTransport)
    vi.mocked(claimReportableSendTxnDao).mockResolvedValue(true)
    vi.mocked(createDeferredEmailTxnDao).mockClear()
  })

  it('part vers le destinataire paramétré, une seule fois, jamais vers EMAIL_TO', async () => {
    await sendInvoiceStatusAlertEmailService(alert())

    expect(memoryTransport.messages).toHaveLength(1)
    expect(memoryTransport.messages[0].to).toBe('presidente@clos-fleuri.test')
    expect(memoryTransport.messages[0].to).not.toBe(env.EMAIL_TO)
  })

  it('objet préfixé du nom de l’association, 60 caractères au plus', async () => {
    await sendInvoiceStatusAlertEmailService(alert())

    const subject = withoutDevPrefix(memoryTransport.messages[0].subject)
    expect(subject).toBe('ASL Clos-Fleuri — un statut de facture est à classer')
    expect(subject.length).toBeLessThanOrEqual(60)
  })

  it('texte brut : le statut entre guillemets, la conséquence, le nombre de factures, le lien vers les réglages', async () => {
    await sendInvoiceStatusAlertEmailService(alert())

    const {text, html} = memoryTransport.messages[0]
    expect(text).toContain('« Relance 9 »')
    expect(text).toMatch(/ni comme réglées, ni comme impayées/)
    expect(text).toContain('3 factures')
    expect(text).toContain(SETTINGS_URL)
    expect(text).not.toMatch(/<[a-z]/i)
    expect(html).toContain('Relance 9')
    expect(html).toContain(SETTINGS_URL)
  })

  it('une seule facture : au singulier', async () => {
    await sendInvoiceStatusAlertEmailService(alert({invoiceCount: 1}))

    expect(memoryTransport.messages[0].text).toContain('1 facture ')
  })

  it('décompte le budget du tenant ; reportée, elle désigne l’alerte (s52)', async () => {
    vi.mocked(claimReportableSendTxnDao).mockResolvedValue(false)

    const result = await sendInvoiceStatusAlertEmailService(alert())

    expect(result.status).toBe('deferred')
    expect(memoryTransport.messages).toHaveLength(0)
    expect(createDeferredEmailTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        nature: 'board_notification',
        recipient: 'presidente@clos-fleuri.test',
        referenceType: 'invoice_status',
        referenceId: ALERT_ID,
      })
    )
  })
})
