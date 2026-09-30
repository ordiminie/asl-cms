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
import {sendIncidentReportNotificationEmailService} from '@/services/email-service'

const REPORT_URL =
  'https://amis-etang.test/bureau/signalements/33333333-3333-4333-8333-333333333333'

const notification = (overrides: Record<string, unknown> = {}) => ({
  to: 'bureau@amis-etang.test',
  locale: 'fr' as const,
  association: {name: "Les Amis de l'Étang", hue: 195 as const},
  reportUrl: REPORT_URL,
  report: {
    categoryName: "Fuite d'eau" as string | null,
    location: 'Chemin des Pins, devant la parcelle 47',
    description: 'L’eau sort de la chaussée.\nÇa coule fort.',
    reporterName: null,
    reporterEmail: null,
    reporterPhone: '06 12 34 56 78',
    createdAt: new Date('2026-09-29T05:42:00Z'),
  },
  ...overrides,
})

const withoutDevPrefix = (subject: string) => subject.replace(/^\[DEV\] /, '')

describe('sendIncidentReportNotificationEmailService — avertir le bureau', () => {
  beforeEach(() => {
    memoryTransport.messages.length = 0
    vi.mocked(getEmailTransport).mockReturnValue(memoryTransport)
  })

  it('part vers l’adresse reçue, jamais vers EMAIL_TO, même interrupteurs coupés (system)', async () => {
    await sendIncidentReportNotificationEmailService(notification())

    expect(memoryTransport.messages).toHaveLength(1)
    const [sent] = memoryTransport.messages
    expect(sent.to).toBe('bureau@amis-etang.test')
    expect(sent.to).not.toBe(env.EMAIL_TO)
  })

  it('titre l’objet du nom de l’association puis de la catégorie, en 60 caractères au plus', async () => {
    await sendIncidentReportNotificationEmailService(notification())

    const subject = withoutDevPrefix(memoryTransport.messages[0].subject)
    expect(subject).toBe("Les Amis de l'Étang — Signalement : Fuite d'eau")
    expect(subject.length).toBeLessThanOrEqual(60)
  })

  it('dit « Nouveau signalement » sans catégorie', async () => {
    await sendIncidentReportNotificationEmailService(
      notification({report: {...notification().report, categoryName: null}})
    )

    const subject = withoutDevPrefix(memoryTransport.messages[0].subject)
    expect(subject).toBe("Les Amis de l'Étang — Nouveau signalement")
  })

  it('tronque la catégorie d’abord, l’objet commençant toujours par l’association', async () => {
    await sendIncidentReportNotificationEmailService(
      notification({
        report: {
          ...notification().report,
          categoryName: 'Chemins, fossés et accotements du lotissement',
        },
      })
    )

    const subject = withoutDevPrefix(memoryTransport.messages[0].subject)
    expect(
      subject.startsWith("Les Amis de l'Étang — Signalement : Chemins")
    ).toBe(true)
    expect(subject.endsWith('…')).toBe(true)
    expect(subject.length).toBeLessThanOrEqual(60)
  })

  it('tient les 60 caractères même pour un nom d’association long', async () => {
    await sendIncidentReportNotificationEmailService(
      notification({
        association: {
          name: 'Association syndicale libre du lotissement des Grands Pins',
          hue: 150,
        },
      })
    )

    const subject = withoutDevPrefix(memoryTransport.messages[0].subject)
    expect(subject.startsWith('Association syndicale')).toBe(true)
    expect(subject.length).toBeLessThanOrEqual(60)
  })

  it('écrit une version texte complète, coordonnées absentes dites, URL en clair', async () => {
    await sendIncidentReportNotificationEmailService(notification())

    const {text} = memoryTransport.messages[0]
    expect(text).toContain('Nouveau signalement depuis le site')
    expect(text).toContain("Fuite d'eau")
    expect(text).toContain('Chemin des Pins, devant la parcelle 47')
    expect(text).toContain('Ça coule fort.')
    expect(text).toContain('06 12 34 56 78')
    expect(text).toContain('non renseigné')
    expect(text).toContain(REPORT_URL)
    expect(text).not.toMatch(/<[a-z]/i)
  })

  it('pose un pré-en-tête de 90 caractères au plus', async () => {
    await sendIncidentReportNotificationEmailService(
      notification({
        report: {...notification().report, location: 'a'.repeat(200)},
      })
    )

    const {html} = memoryTransport.messages[0]
    const preview = html
      ?.match(/<div[^>]*display:none[^>]*>([^<]*)/)?.[1]
      ?.trim()
    expect(preview).toBeTruthy()
    expect(preview?.length).toBeLessThanOrEqual(90)
  })

  it('laisse remonter un échec du transport au service appelant', async () => {
    vi.mocked(getEmailTransport).mockReturnValue({
      send: vi.fn(() =>
        Promise.reject(new EmailTransportError('brevo', 'refus'))
      ),
    })

    await expect(
      sendIncidentReportNotificationEmailService(notification())
    ).rejects.toThrow(EmailTransportError)
  })
})
