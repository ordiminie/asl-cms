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
  getBooleanSettingService: vi.fn(() => Promise.resolve(true)),
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
  createDeferredEmailTxnDao: vi.fn(),
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

import {getEmailTransport} from '@/lib/emails/transport'
import {sendMemberEmailConfirmationEmailService} from '@/services/email-service'

describe('sendMemberEmailConfirmationEmailService — le lien de confirmation (s54, écran 2)', () => {
  const url = 'https://clos-fleuri.test/confirmer-adresse/Xk3abc'
  const send = () =>
    sendMemberEmailConfirmationEmailService({
      organizationId: '11111111-1111-4111-8111-111111111111',
      email: 'marc@exemple.test',
      url,
      association: {name: 'Clos-Fleuri', hue: 195},
      authorName: 'Claire Dubois',
      profileName: 'Jean Dubois',
      parcelNumbers: ['21'],
      expiresAt: new Date('2026-11-23T10:00:00Z'),
      locale: 'fr',
    })

  beforeEach(() => {
    memoryTransport.messages.length = 0
    vi.mocked(getEmailTransport).mockReturnValue(memoryTransport)
  })

  it('envoie à l’adresse à confirmer, objet préfixé par l’association, texte brut complet avec l’URL', async () => {
    const result = await send()

    expect(result).toEqual({status: 'sent'})
    expect(memoryTransport.messages).toHaveLength(1)
    const [sent] = memoryTransport.messages
    expect(sent.to).toBe('marc@exemple.test')
    expect(sent.subject).toMatch(/Clos-Fleuri — Confirmez votre adresse email$/)
    expect(sent.text).toContain(url)
    expect(sent.text).toContain('Claire Dubois a ajouté cette adresse')
    expect(sent.text).toContain('Ce lien vaut jusqu’au 23 novembre 2026.')
  })
})
