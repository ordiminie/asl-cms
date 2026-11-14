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
import {sendMagicLinkEmailService} from '@/services/email-service'

describe('sendMagicLinkEmailService — objet, pré-en-tête et version texte', () => {
  const url =
    'https://asl-les-pins.test/api/auth/magic-link/verify?token=abc&callbackURL=%2Fdashboard'

  beforeEach(() => {
    memoryTransport.messages.length = 0
    vi.mocked(getEmailTransport).mockReturnValue(memoryTransport)
  })

  it('envoie l’email de l’association par le transport', async () => {
    await sendMagicLinkEmailService({
      organizationId: '11111111-1111-4111-8111-111111111111',
      email: 'membre@exemple.test',
      url,
      association: {name: 'ASL Les Pins', hue: 195},
      locale: 'fr',
    })

    expect(memoryTransport.messages).toHaveLength(1)
    const [sent] = memoryTransport.messages
    expect(sent.to).toBe('membre@exemple.test')
    expect(sent.subject).toMatch(/ASL Les Pins — votre lien de connexion$/)
    expect(sent.html).toContain('ASL Les Pins')
    expect(sent.text).toContain(url)
    expect(sent.text).toContain('20 minutes')
    expect(sent.text).toContain('ASL Les Pins')
    expect(sent.text).not.toContain('<strong>')
  })

  it('écrit objet, texte et HTML dans la locale reçue, même sans cookie de locale', async () => {
    await sendMagicLinkEmailService({
      organizationId: '11111111-1111-4111-8111-111111111111',
      email: 'membre@exemple.test',
      url,
      association: {name: 'ASL Les Pins', hue: 195},
      locale: 'fr',
    })

    const [sent] = memoryTransport.messages
    expect(sent.subject).toMatch(/ASL Les Pins — votre lien de connexion$/)
    expect(sent.text).toContain('Votre lien de connexion')
    expect(sent.text).toContain("Vous n'avez pas demandé ce lien ?")
    expect(sent.html).toContain('Ouvrir mon espace')
    expect(sent.html).toContain('lang="fr"')
    expect(sent.subject).not.toMatch(/sign-in link/)
  })
})
