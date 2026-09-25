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

import {env} from '@/env'
import {EmailTransportError, getEmailTransport} from '@/lib/emails/transport'
import {sendContactMessageNotificationEmailService} from '@/services/email-service'

const MESSAGE_URL =
  'https://amis-etang.test/bureau/messages/33333333-3333-4333-8333-333333333333'

const notification = (overrides: Record<string, unknown> = {}) => ({
  to: 'bureau@amis-etang.test',
  locale: 'fr' as const,
  association: {name: "Les Amis de l'Étang", hue: 195 as const},
  messageUrl: MESSAGE_URL,
  message: {
    senderName: 'Claire Meunier',
    senderEmail: 'claire.meunier@example.fr',
    subject: "Analyse d'eau du forage",
    body: 'Bonjour,\nQuand paraît la prochaine analyse ?',
    createdAt: new Date('2026-09-02T12:32:00Z'),
  },
  ...overrides,
})

const withoutDevPrefix = (subject: string) => subject.replace(/^\[DEV\] /, '')

describe('sendContactMessageNotificationEmailService — avertir le bureau', () => {
  beforeEach(() => {
    memoryTransport.messages.length = 0
    vi.mocked(getEmailTransport).mockReturnValue(memoryTransport)
  })

  it('part vers l’adresse reçue des paramètres, jamais vers EMAIL_TO', async () => {
    await sendContactMessageNotificationEmailService(notification())

    expect(memoryTransport.messages).toHaveLength(1)
    const [sent] = memoryTransport.messages
    expect(sent.to).toBe('bureau@amis-etang.test')
    expect(sent.to).not.toBe(env.EMAIL_TO)
  })

  it('part même quand les interrupteurs d’envoi de l’application sont coupés (system)', async () => {
    await sendContactMessageNotificationEmailService(notification())

    expect(memoryTransport.messages).toHaveLength(1)
  })

  it('préfixe l’objet du nom de l’association, en 60 caractères au plus', async () => {
    await sendContactMessageNotificationEmailService(notification())

    const subject = withoutDevPrefix(memoryTransport.messages[0].subject)
    expect(subject).toBe("Les Amis de l'Étang — Nouveau message depuis le site")
    expect(subject.length).toBeLessThanOrEqual(60)
  })

  it('tient les 60 caractères même pour un nom d’association long', async () => {
    await sendContactMessageNotificationEmailService(
      notification({
        association: {
          name: 'Association syndicale libre du lotissement des Grands Pins',
          hue: 150,
        },
      })
    )

    const subject = withoutDevPrefix(memoryTransport.messages[0].subject)
    expect(subject.startsWith('Association syndicale')).toBe(true)
    expect(subject.endsWith('… — Nouveau message depuis le site')).toBe(true)
    expect(subject.length).toBeLessThanOrEqual(60)
  })

  it('écrit une version texte complète, URL et adresse du visiteur en clair', async () => {
    await sendContactMessageNotificationEmailService(notification())

    const {text} = memoryTransport.messages[0]
    expect(text).toContain('Nouveau message depuis le site')
    expect(text).toContain('claire.meunier@example.fr')
    expect(text).toContain("Analyse d'eau du forage")
    expect(text).toContain('Quand paraît la prochaine analyse ?')
    expect(text).toContain(MESSAGE_URL)
    expect(text).not.toMatch(/<[a-z]/i)
  })

  it('rend le HTML dans la locale reçue, sans cookie de locale', async () => {
    await sendContactMessageNotificationEmailService(notification())

    const {html} = memoryTransport.messages[0]
    expect(html).toContain('lang="fr"')
    expect(html).toContain('Ouvrir le message dans le back-office')
  })

  it('pose un pré-en-tête de 90 caractères au plus qui ne répète pas l’objet', async () => {
    await sendContactMessageNotificationEmailService(
      notification({
        message: {
          ...notification().message,
          subject: 'a'.repeat(200),
        },
      })
    )

    const {html} = memoryTransport.messages[0]
    const preview = html
      ?.match(/<div[^>]*display:none[^>]*>([^<]*)/)?.[1]
      ?.replace(/&#x27;|&#39;/g, "'")
      .trim()
    expect(preview).toBeTruthy()
    expect(preview?.length).toBeLessThanOrEqual(90)
    expect(preview).toContain('Claire Meunier')
    expect(preview).not.toContain('Nouveau message depuis le site')
  })

  it('laisse remonter un échec du transport au service appelant', async () => {
    vi.mocked(getEmailTransport).mockReturnValue({
      send: vi.fn(() =>
        Promise.reject(new EmailTransportError('brevo', 'refus'))
      ),
    })

    await expect(
      sendContactMessageNotificationEmailService(notification())
    ).rejects.toThrow(EmailTransportError)
  })
})
