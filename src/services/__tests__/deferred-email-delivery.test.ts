import {createHash} from 'node:crypto'

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {createMemoryTransport} from '@/lib/emails/transport/memory-transport'

/**
 * Rejeu d'un email reporte faute de budget (s52, ADR 053 §4, critere 5 et 7).
 * La table `deferred_email` est simulee par un magasin en memoire qui applique
 * les memes transitions que le repository (`pending → sending` atomique,
 * suppression, `to_verify`, rendue).
 */
const memoryTransport = createMemoryTransport()

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
const scope = vi.hoisted(() => ({current: undefined as string | undefined}))
vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (organizationId: string, callback: () => unknown) => {
    const previous = scope.current
    scope.current = organizationId
    try {
      return await callback()
    } finally {
      scope.current = previous
    }
  }),
}))
vi.mock('@/db/repositories/email-send-budget-repository', () => ({
  claimReportableSendTxnDao: vi.fn(),
  countLoginSendTxnDao: vi.fn(),
  refundReportableSendTxnDao: vi.fn(),
}))
vi.mock('@/db/repositories/deferred-email-repository', () => ({
  createDeferredEmailTxnDao: vi.fn(),
  claimDeferredEmailForSendTxnDao: vi.fn(),
  deleteDeferredEmailTxnDao: vi.fn(),
  markDeferredEmailFailedTxnDao: vi.fn(),
  markDeferredEmailToVerifyTxnDao: vi.fn(),
  releaseDeferredEmailTxnDao: vi.fn(),
}))
vi.mock('@/db/repositories/contact-message-repository', () => ({
  markContactMessageNotificationFailedDao: vi.fn(),
}))
vi.mock('@/db/repositories/incident-report-repository', () => ({
  markIncidentReportNotificationFailedDao: vi.fn(),
}))
vi.mock('@/db/repositories/member-question-repository', () => ({
  markMemberQuestionNotificationFailedDao: vi.fn(),
}))
vi.mock('@/db/repositories/scheduled-job-repository', () => ({
  enqueueScheduledJobTxnDao: vi.fn(),
}))
vi.mock('@/services/association-settings-service', () => ({
  getAssociationSettingsService: vi.fn(),
}))
vi.mock('@/db/repositories/member-profile-email-repository', () => ({
  getMemberProfileEmailByIdDao: vi.fn(),
  getMemberProfileEmailsByTokenHashDao: vi.fn(),
  updateMemberProfileEmailDao: vi.fn(),
}))

import {markContactMessageNotificationFailedDao} from '@/db/repositories/contact-message-repository'
import {
  claimDeferredEmailForSendTxnDao,
  deleteDeferredEmailTxnDao,
  markDeferredEmailFailedTxnDao,
  markDeferredEmailToVerifyTxnDao,
  releaseDeferredEmailTxnDao,
} from '@/db/repositories/deferred-email-repository'
import {
  claimReportableSendTxnDao,
  refundReportableSendTxnDao,
} from '@/db/repositories/email-send-budget-repository'
import {markIncidentReportNotificationFailedDao} from '@/db/repositories/incident-report-repository'
import {
  getMemberProfileEmailByIdDao,
  getMemberProfileEmailsByTokenHashDao,
  updateMemberProfileEmailDao,
} from '@/db/repositories/member-profile-email-repository'
import {markMemberQuestionNotificationFailedDao} from '@/db/repositories/member-question-repository'
import {EmailTransportError, getEmailTransport} from '@/lib/emails/transport'
import {logger} from '@/lib/logger'
import {getAssociationSettingsService} from '@/services/association-settings-service'
import {
  deliverDeferredEmailService,
  emailScheduledJobHandlers,
} from '@/services/email-service'
import {
  CONFIRMATION_EXPIRY_PLACEHOLDER,
  CONFIRMATION_TOKEN_PLACEHOLDER,
} from '@/services/member-email-token'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  CAMPAIGN_SEND_MAX_ATTEMPTS_SETTING_KEY,
  resolveSettings,
} from '@/services/types/domain/association-settings-types'
import {
  EMAIL_DELIVER_DEFERRED_JOB_KIND,
  ScheduledJob,
} from '@/services/types/domain/scheduled-job-types'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const DEFERRED_ID = '22222222-2222-4222-8222-222222222222'
const NOW = new Date('2026-11-15T09:00:00.000Z')
const SECRET_TEXT = 'Message de Claire : fuite au 12 chemin des Pins'
const REFERENCE_ID = '33333333-3333-4333-8333-333333333333'

type StoredDeferred = {
  id: string
  organizationId: string
  nature: string
  recipient: string
  subject: string
  textBody: string
  htmlBody: string | null
  headers: Record<string, string> | null
  replyTo: string | null
  senderName: string | null
  sendOn: string
  status: 'pending' | 'sending' | 'to_verify' | 'failed'
  attempts: number
  referenceType: string | null
  referenceId: string | null
  createdAt: Date
  updatedAt: Date
}

const store = {rows: new Map<string, StoredDeferred>()}

const storedRow = (
  status: StoredDeferred['status'] = 'pending'
): StoredDeferred => ({
  id: DEFERRED_ID,
  organizationId: ORG_ID,
  nature: 'board_notification',
  recipient: 'bureau@asl-les-pins.test',
  subject: 'Nouveau message',
  textBody: SECRET_TEXT,
  htmlBody: `<p>${SECRET_TEXT}</p>`,
  headers: null,
  replyTo: 'claire@example.fr',
  senderName: 'ASL Les Pins',
  sendOn: '2026-11-15',
  status,
  attempts: 0,
  referenceType: 'contact_message',
  referenceId: REFERENCE_ID,
  createdAt: NOW,
  updatedAt: NOW,
})

const jobOf = (overrides: Partial<ScheduledJob> = {}): ScheduledJob => ({
  id: 'job',
  organizationId: ORG_ID,
  kind: EMAIL_DELIVER_DEFERRED_JOB_KIND,
  payload: {deferredEmailId: DEFERRED_ID},
  attempts: 1,
  resumedAfterStaleLock: false,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({toFake: ['Date']})
  vi.setSystemTime(NOW)
  memoryTransport.messages.length = 0
  vi.mocked(getEmailTransport).mockReturnValue(memoryTransport)
  vi.mocked(getAssociationSettingsService).mockResolvedValue(
    resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
  )
  vi.mocked(claimReportableSendTxnDao).mockResolvedValue(true)
  store.rows = new Map([[DEFERRED_ID, storedRow()]])

  vi.mocked(claimDeferredEmailForSendTxnDao).mockImplementation(async (id) => {
    expect(scope.current).toBe(ORG_ID)
    const row = store.rows.get(id)
    if (row?.status !== 'pending') return undefined
    row.status = 'sending'
    return {...row}
  })
  vi.mocked(deleteDeferredEmailTxnDao).mockImplementation(async (id) => {
    store.rows.delete(id)
  })
  vi.mocked(markDeferredEmailToVerifyTxnDao).mockImplementation(async (id) => {
    const row = store.rows.get(id)
    if (row?.status === 'sending') row.status = 'to_verify'
  })
  vi.mocked(markDeferredEmailFailedTxnDao).mockImplementation(async (id) => {
    expect(scope.current).toBe(ORG_ID)
    const row = store.rows.get(id)
    if (row?.status !== 'sending') return
    Object.assign(row, {
      status: 'failed',
      recipient: '',
      subject: '',
      textBody: '',
      htmlBody: null,
      replyTo: null,
      senderName: null,
    })
  })
  vi.mocked(releaseDeferredEmailTxnDao).mockImplementation(
    async ({id, sendOn, countAttempt}) => {
      const row = store.rows.get(id)
      if (row?.status !== 'sending') return
      row.status = 'pending'
      row.sendOn = sendOn
      if (countAttempt) row.attempts += 1
    }
  )
})

afterEach(() => {
  vi.useRealTimers()
})

describe('deliverDeferredEmailService — rejeu d’un email reporté (s52)', () => {
  it('est le gestionnaire de la tâche email.deliver_deferred', () => {
    expect(emailScheduledJobHandlers[EMAIL_DELIVER_DEFERRED_JOB_KIND]).toBe(
      deliverDeferredEmailService
    )
  })

  it('le lendemain, sans action : repasse par le budget du jour, part tel qu’il a été rendu, puis la ligne est purgée (critère 5, 7)', async () => {
    const outcome = await deliverDeferredEmailService(jobOf(), NOW)

    expect(outcome).toEqual({status: 'completed'})
    expect(claimReportableSendTxnDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      day: '2026-11-15',
      allowance: 200,
    })
    expect(memoryTransport.messages).toHaveLength(1)
    const [sent] = memoryTransport.messages
    expect(sent).toMatchObject({
      to: 'bureau@asl-les-pins.test',
      subject: 'Nouveau message',
      text: SECRET_TEXT,
      html: `<p>${SECRET_TEXT}</p>`,
      replyTo: 'claire@example.fr',
    })
    expect(sent.from).toMatch(/^ASL Les Pins </)
    expect(store.rows.has(DEFERRED_ID)).toBe(false)
  })

  it('double exécution : un seul envoi (critère 5)', async () => {
    const first = await deliverDeferredEmailService(jobOf(), NOW)
    const second = await deliverDeferredEmailService(jobOf(), NOW)

    expect(first).toEqual({status: 'completed'})
    expect(second).toEqual({status: 'completed'})
    expect(memoryTransport.messages).toHaveLength(1)
  })

  it('deux exécutions simultanées : un seul envoi (critère 5)', async () => {
    await Promise.all([
      deliverDeferredEmailService(jobOf(), NOW),
      deliverDeferredEmailService(jobOf(), NOW),
    ])

    expect(memoryTransport.messages).toHaveLength(1)
  })

  it('reprise après un verrou périmé : une ligne en cours d’envoi passe à vérifier, jamais renvoyée', async () => {
    store.rows.set(DEFERRED_ID, storedRow('sending'))

    const outcome = await deliverDeferredEmailService(
      jobOf({resumedAfterStaleLock: true}),
      NOW
    )

    expect(outcome).toEqual({status: 'completed'})
    expect(store.rows.get(DEFERRED_ID)?.status).toBe('to_verify')
    expect(memoryTransport.messages).toHaveLength(0)
  })

  it('ligne absente (déjà partie, association supprimée) : tâche close, rien envoyé', async () => {
    store.rows.clear()

    await expect(deliverDeferredEmailService(jobOf(), NOW)).resolves.toEqual({
      status: 'completed',
    })
    expect(memoryTransport.messages).toHaveLength(0)
  })

  it('budget de nouveau épuisé : ligne rendue pour le lendemain, tâche reportée à 02:00 sans tentative comptée', async () => {
    vi.mocked(claimReportableSendTxnDao).mockResolvedValue(false)

    const outcome = await deliverDeferredEmailService(jobOf(), NOW)

    expect(outcome).toEqual({
      status: 'deferred',
      runAfter: new Date('2026-11-16T01:00:00.000Z'),
    })
    expect(store.rows.get(DEFERRED_ID)).toMatchObject({
      status: 'pending',
      sendOn: '2026-11-16',
      attempts: 0,
    })
    expect(memoryTransport.messages).toHaveLength(0)
  })

  it('refus certain du fournisseur : unité rendue, ligne rendue en attente, nouvelle tentative plus tard', async () => {
    vi.mocked(getEmailTransport).mockReturnValue({
      send: vi.fn(() =>
        Promise.reject(
          new EmailTransportError('brevo', 'refus', {refused: true})
        )
      ),
    })

    const outcome = await deliverDeferredEmailService(jobOf(), NOW)

    expect(outcome).toEqual({
      status: 'retry',
      runAfter: new Date(NOW.getTime() + 30 * 60 * 1000),
    })
    expect(refundReportableSendTxnDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      day: '2026-11-15',
    })
    expect(store.rows.get(DEFERRED_ID)).toMatchObject({
      status: 'pending',
      attempts: 1,
    })
  })

  it('issue inconnue : à vérifier, jamais renvoyé, et rien du contenu dans le journal (critère 7)', async () => {
    vi.mocked(getEmailTransport).mockReturnValue({
      send: vi.fn(() => Promise.reject(new Error(`réseau ${SECRET_TEXT}`))),
    })

    const outcome = await deliverDeferredEmailService(jobOf(), NOW)

    expect(outcome).toEqual({status: 'completed'})
    expect(store.rows.get(DEFERRED_ID)?.status).toBe('to_verify')
    const logged = JSON.stringify(
      Object.values(vi.mocked(logger)).flatMap((fn) =>
        vi.isMockFunction(fn) ? fn.mock.calls : []
      )
    )
    expect(logged).not.toContain(SECRET_TEXT)
    expect(logged).not.toContain('bureau@asl-les-pins.test')
  })

  const refusingTransport = () =>
    vi.mocked(getEmailTransport).mockReturnValue({
      send: vi.fn(() =>
        Promise.reject(
          new EmailTransportError('brevo', 'refus', {refused: true})
        )
      ),
    })

  it('refus certain à la dernière tentative (campaign.send_max_attempts, 3 par défaut) : la tâche échoue, la ligne passe en échec, adresse et contenu effacés (revue n° 2)', async () => {
    refusingTransport()

    const outcome = await deliverDeferredEmailService(jobOf({attempts: 3}), NOW)

    expect(outcome).toEqual({status: 'failed'})
    const row = store.rows.get(DEFERRED_ID)
    expect(row?.status).toBe('failed')
    expect(JSON.stringify(row)).not.toContain(SECRET_TEXT)
    expect(JSON.stringify(row)).not.toContain('bureau@asl-les-pins.test')
    expect(refundReportableSendTxnDao).toHaveBeenCalledTimes(1)
  })

  it('le nombre de tentatives est le réglage de l’association, jamais une valeur en dur (ADR 010)', async () => {
    refusingTransport()
    vi.mocked(getAssociationSettingsService).mockResolvedValue(
      resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
        {key: CAMPAIGN_SEND_MAX_ATTEMPTS_SETTING_KEY, value: '5'},
      ])
    )

    const third = await deliverDeferredEmailService(jobOf({attempts: 3}), NOW)
    expect(third).toMatchObject({status: 'retry'})
    expect(store.rows.get(DEFERRED_ID)?.status).toBe('pending')

    const fifth = await deliverDeferredEmailService(jobOf({attempts: 5}), NOW)
    expect(fifth).toEqual({status: 'failed'})
    expect(store.rows.get(DEFERRED_ID)?.status).toBe('failed')
  })

  it('une nouvelle tentative possible ne pose pas le témoin d’échec du message', async () => {
    refusingTransport()

    await deliverDeferredEmailService(jobOf({attempts: 1}), NOW)

    expect(markContactMessageNotificationFailedDao).not.toHaveBeenCalled()
  })

  it('notification d’un message de contact en échec définitif : le témoin notification_failed du message est posé, comme à l’envoi direct (revue n° 7)', async () => {
    refusingTransport()
    vi.mocked(markContactMessageNotificationFailedDao).mockImplementation(
      async () => {
        expect(scope.current).toBe(ORG_ID)
      }
    )

    await deliverDeferredEmailService(jobOf({attempts: 3}), NOW)

    expect(markContactMessageNotificationFailedDao).toHaveBeenCalledWith(
      REFERENCE_ID
    )
    expect(markIncidentReportNotificationFailedDao).not.toHaveBeenCalled()
  })

  it('notification d’un signalement à vérifier (issue inconnue) : le témoin du signalement est posé', async () => {
    store.rows.set(DEFERRED_ID, {
      ...storedRow(),
      referenceType: 'incident_report',
    })
    vi.mocked(getEmailTransport).mockReturnValue({
      send: vi.fn(() => Promise.reject(new Error('délai dépassé'))),
    })

    await deliverDeferredEmailService(jobOf(), NOW)

    expect(markIncidentReportNotificationFailedDao).toHaveBeenCalledWith(
      REFERENCE_ID
    )
    expect(markContactMessageNotificationFailedDao).not.toHaveBeenCalled()
  })

  it('notification d’une question de membre en échec définitif : le témoin de la question est posé (s23)', async () => {
    store.rows.set(DEFERRED_ID, {
      ...storedRow(),
      referenceType: 'member_question',
    })
    refusingTransport()
    vi.mocked(markMemberQuestionNotificationFailedDao).mockImplementation(
      async () => {
        expect(scope.current).toBe(ORG_ID)
      }
    )

    await deliverDeferredEmailService(jobOf({attempts: 3}), NOW)

    expect(markMemberQuestionNotificationFailedDao).toHaveBeenCalledWith(
      REFERENCE_ID
    )
    expect(markContactMessageNotificationFailedDao).not.toHaveBeenCalled()
    expect(markIncidentReportNotificationFailedDao).not.toHaveBeenCalled()
  })
})

describe('deliverDeferredEmailService — lien de confirmation reporté (s54, revue M1)', () => {
  const PENDING_ID = '44444444-4444-4444-8444-444444444444'
  const OTHER_PENDING_ID = '55555555-5555-4555-8555-555555555555'
  const OLD_HASH = 'a'.repeat(64)
  const LINK = 'https://clos-fleuri.test/confirmer-adresse/'
  const sha256 = (value: string) =>
    createHash('sha256').update(value).digest('hex')

  const pending = (overrides: Record<string, unknown> = {}) => ({
    id: PENDING_ID,
    organizationId: ORG_ID,
    memberProfileId: 'profile-1',
    email: 'Marc@Exemple.test',
    role: 'additional',
    status: 'pending',
    origin: 'site',
    addedByUserId: 'claire',
    replacesEmailId: null,
    confirmationTokenHash: OLD_HASH,
    expiresAt: new Date('2026-11-21T09:00:00.000Z'),
    unsubscribedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  })

  beforeEach(() => {
    store.rows = new Map([
      [
        DEFERRED_ID,
        {
          ...storedRow(),
          nature: 'member_email_confirmation',
          recipient: 'marc@exemple.test',
          subject: 'Clos-Fleuri — Confirmez votre adresse email',
          textBody: `Ouvrez ce lien :\n${LINK}${CONFIRMATION_TOKEN_PLACEHOLDER}\n\nCe lien vaut jusqu’au ${CONFIRMATION_EXPIRY_PLACEHOLDER}.`,
          htmlBody: `<a href="${LINK}${CONFIRMATION_TOKEN_PLACEHOLDER}">Confirmer</a><p>${CONFIRMATION_EXPIRY_PLACEHOLDER}</p>`,
          replyTo: null,
          referenceType: 'member_profile_email',
          referenceId: PENDING_ID,
        },
      ],
    ])
    vi.mocked(getMemberProfileEmailByIdDao).mockResolvedValue(
      pending() as never
    )
    vi.mocked(getMemberProfileEmailsByTokenHashDao).mockResolvedValue([
      pending(),
      pending({id: OTHER_PENDING_ID, memberProfileId: 'profile-2'}),
    ] as never)
  })

  it('au rejeu, un jeton neuf : son hash remplace celui des attentes du lien, l’échéance part de l’envoi réel, le lien envoyé fonctionne', async () => {
    const outcome = await deliverDeferredEmailService(jobOf(), NOW)

    expect(outcome).toEqual({status: 'completed'})
    expect(memoryTransport.messages).toHaveLength(1)
    const [sent] = memoryTransport.messages
    const token = sent.text.match(/confirmer-adresse\/([A-Za-z0-9_-]{43})/)?.[1]
    expect(token).toBeDefined()
    expect(sent.html).toContain(`${LINK}${token}`)
    expect(sent.text).toContain('Ce lien vaut jusqu’au 22 novembre 2026.')
    expect(sent.text).not.toContain(CONFIRMATION_TOKEN_PLACEHOLDER)
    expect(sent.html).not.toContain(CONFIRMATION_EXPIRY_PLACEHOLDER)

    const expiresAt = new Date('2026-11-22T09:00:00.000Z')
    expect(getMemberProfileEmailsByTokenHashDao).toHaveBeenCalledWith(OLD_HASH)
    expect(updateMemberProfileEmailDao).toHaveBeenCalledTimes(2)
    for (const id of [PENDING_ID, OTHER_PENDING_ID]) {
      expect(updateMemberProfileEmailDao).toHaveBeenCalledWith(id, {
        confirmationTokenHash: sha256(token ?? ''),
        expiresAt,
      })
    }
    expect(sha256(token ?? '')).not.toBe(OLD_HASH)
    expect(store.rows.has(DEFERRED_ID)).toBe(false)
  })

  it.each([
    ['annulée', undefined],
    ['déjà active', pending({status: 'active', confirmationTokenHash: null})],
    ['corrigée vers une autre adresse', pending({email: 'autre@exemple.test'})],
    ['échue', pending({expiresAt: new Date('2026-11-01T00:00:00.000Z')})],
  ])(
    'attente %s : rien ne part, l’unité est rendue, la ligne est purgée',
    async (_label, row) => {
      vi.mocked(getMemberProfileEmailByIdDao).mockResolvedValue(row as never)

      const outcome = await deliverDeferredEmailService(jobOf(), NOW)

      expect(outcome).toEqual({status: 'completed'})
      expect(memoryTransport.messages).toHaveLength(0)
      expect(updateMemberProfileEmailDao).not.toHaveBeenCalled()
      expect(refundReportableSendTxnDao).toHaveBeenCalledWith({
        organizationId: ORG_ID,
        day: '2026-11-15',
      })
      expect(store.rows.has(DEFERRED_ID)).toBe(false)
    }
  )
})
