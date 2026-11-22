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
import {EmailTransportError, getEmailTransport} from '@/lib/emails/transport'
import {sendMemberQuestionNotificationEmailService} from '@/services/email-service'

const QUESTION_ID = '33333333-3333-4333-8333-333333333333'
const QUESTION_URL = `https://amis-etang.test/bureau/questions/${QUESTION_ID}`

const notification = (overrides: Record<string, unknown> = {}) => ({
  organizationId: '11111111-1111-4111-8111-111111111111',
  questionId: QUESTION_ID,
  to: 'voirie@amis-etang.test',
  locale: 'fr' as const,
  association: {name: "Les Amis de l'Étang", hue: 195 as const},
  questionUrl: QUESTION_URL,
  question: {
    categoryName: 'Voirie',
    memberName: 'Lucie Moreau',
    memberEmail: 'lucie.moreau@exemple.fr' as string | null,
    body: 'Quand le chemin sera-t-il refait ?\nIl y a des trous.',
    createdAt: new Date('2026-11-14T09:42:00Z'),
  },
  ...overrides,
})

const withoutDevPrefix = (subject: string) => subject.replace(/^\[DEV\] /, '')

describe('sendMemberQuestionNotificationEmailService — avertir le bureau (s23)', () => {
  beforeEach(() => {
    memoryTransport.messages.length = 0
    vi.mocked(getEmailTransport).mockReturnValue(memoryTransport)
    vi.mocked(claimReportableSendTxnDao).mockResolvedValue(true)
    vi.mocked(createDeferredEmailTxnDao).mockClear()
  })

  it('part vers l’adresse reçue, une seule fois, jamais vers EMAIL_TO (system)', async () => {
    await sendMemberQuestionNotificationEmailService(notification())

    expect(memoryTransport.messages).toHaveLength(1)
    const [sent] = memoryTransport.messages
    expect(sent.to).toBe('voirie@amis-etang.test')
    expect(sent.to).not.toBe(env.EMAIL_TO)
  })

  it('titre l’objet du nom de l’association puis du sujet, en 60 caractères au plus', async () => {
    await sendMemberQuestionNotificationEmailService(notification())

    const subject = withoutDevPrefix(memoryTransport.messages[0].subject)
    expect(subject).toBe("Les Amis de l'Étang — Question : Voirie")
    expect(subject.length).toBeLessThanOrEqual(60)
  })

  it('tronque le sujet d’abord, l’objet commençant toujours par l’association', async () => {
    await sendMemberQuestionNotificationEmailService(
      notification({
        question: {
          ...notification().question,
          categoryName: 'Chemins, fossés et accotements du lotissement',
        },
      })
    )

    const subject = withoutDevPrefix(memoryTransport.messages[0].subject)
    expect(subject.startsWith("Les Amis de l'Étang — Question : Chemins")).toBe(
      true
    )
    expect(subject.endsWith('…')).toBe(true)
    expect(subject.length).toBeLessThanOrEqual(60)
  })

  it('écrit une version texte complète : sujet, membre, email, date, question, lien', async () => {
    await sendMemberQuestionNotificationEmailService(notification())

    const {text} = memoryTransport.messages[0]
    expect(text).toContain('Nouvelle question d’un membre')
    expect(text).toContain('Sujet : Voirie')
    expect(text).toContain('Lucie Moreau')
    expect(text).toContain('lucie.moreau@exemple.fr')
    expect(text).toContain('14 novembre 2026')
    expect(text).toContain('Il y a des trous.')
    expect(text).toContain(QUESTION_URL)
    expect(text).toMatch(/répondez directement au membre/i)
    expect(text).not.toMatch(/<[a-z]/i)
  })

  it('dirige la réponse vers le membre (replyTo)', async () => {
    await sendMemberQuestionNotificationEmailService(notification())

    expect(memoryTransport.messages[0].replyTo).toBe('lucie.moreau@exemple.fr')
  })

  it('sans adresse email du membre : pas de replyTo, l’absence est dite', async () => {
    await sendMemberQuestionNotificationEmailService(
      notification({
        question: {...notification().question, memberEmail: null},
      })
    )

    const [sent] = memoryTransport.messages
    expect(sent.replyTo).toBeUndefined()
    expect(sent.text).toContain('Sans adresse email')
  })

  it('pose un pré-en-tête de 90 caractères au plus', async () => {
    await sendMemberQuestionNotificationEmailService(
      notification({
        question: {...notification().question, memberName: 'a'.repeat(200)},
      })
    )

    const {html} = memoryTransport.messages[0]
    const preview = html
      ?.match(/<div[^>]*display:none[^>]*>([^<]*)/)?.[1]
      ?.trim()
    expect(preview).toBeTruthy()
    expect(preview?.length).toBeLessThanOrEqual(90)
  })

  it('décompte le budget du tenant, notification au bureau désignant la question : reportée, elle est conservée (s52)', async () => {
    vi.mocked(claimReportableSendTxnDao).mockResolvedValue(false)

    await sendMemberQuestionNotificationEmailService(notification())

    expect(memoryTransport.messages).toHaveLength(0)
    expect(createDeferredEmailTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: '11111111-1111-4111-8111-111111111111',
        nature: 'board_notification',
        recipient: 'voirie@amis-etang.test',
        replyTo: 'lucie.moreau@exemple.fr',
        referenceType: 'member_question',
        referenceId: QUESTION_ID,
      })
    )
  })

  it('laisse remonter un échec du transport au service appelant', async () => {
    vi.mocked(getEmailTransport).mockReturnValue({
      ...memoryTransport,
      send: vi.fn(() =>
        Promise.reject(new EmailTransportError('brevo', 'refus'))
      ),
    })

    await expect(
      sendMemberQuestionNotificationEmailService(notification())
    ).rejects.toThrow(EmailTransportError)
  })
})
