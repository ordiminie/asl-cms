import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {createMemoryTransport} from '@/lib/emails/transport/memory-transport'

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

const scope = vi.hoisted(() => ({
  current: undefined as string | undefined,
  opened: 0,
  id: 0,
}))
vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (organizationId: string, callback: () => unknown) => {
    scope.opened += 1
    const previous = {current: scope.current, id: scope.id}
    scope.current = organizationId
    scope.id = scope.opened
    try {
      return await callback()
    } finally {
      scope.current = previous.current
      scope.id = previous.id
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
}))
vi.mock('@/db/repositories/scheduled-job-repository', () => ({
  enqueueScheduledJobTxnDao: vi.fn(),
}))
vi.mock('@/services/association-settings-service', () => ({
  getAssociationSettingsService: vi.fn(),
}))

import {Html, Text} from 'react-email'

import {createDeferredEmailTxnDao} from '@/db/repositories/deferred-email-repository'
import {
  claimReportableSendTxnDao,
  countLoginSendTxnDao,
  refundReportableSendTxnDao,
} from '@/db/repositories/email-send-budget-repository'
import {enqueueScheduledJobTxnDao} from '@/db/repositories/scheduled-job-repository'
import {withTenant} from '@/db/tenant-scope'
import {EmailTransportError} from '@/lib/emails/transport'
import {getEmailTransport} from '@/lib/emails/transport'
import {getBooleanSettingService} from '@/services/app-settings-service'
import {getAssociationSettingsService} from '@/services/association-settings-service'
import {
  readEmailTagStatisticsService,
  sendEmailService,
  sendSimpleEmailService,
} from '@/services/email-service'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  EMAIL_DAILY_SEND_LIMIT_SETTING_KEY,
  EMAIL_LOGIN_RESERVE_SETTING_KEY,
  resolveSettings,
} from '@/services/types/domain/association-settings-types'
import type {EmailSendContext} from '@/services/types/domain/email-send-types'
import {EMAIL_DELIVER_DEFERRED_JOB_KIND} from '@/services/types/domain/scheduled-job-types'

const PLATFORM: EmailSendContext = {
  scope: 'platform',
  nature: 'account_security',
}

describe('sendEmailService — tout envoi passe par EmailTransport', () => {
  beforeEach(() => {
    memoryTransport.messages.length = 0
    vi.mocked(getEmailTransport).mockReturnValue(memoryTransport)
  })

  it('rend le gabarit en HTML et confie le message au transport', async () => {
    await sendEmailService(
      {
        to: 'membre@exemple.test',
        subject: 'Objet',
        text: 'Version texte',
        react: (
          <Html>
            <Text>Bonjour depuis le gabarit</Text>
          </Html>
        ),
      },
      PLATFORM,
      {recipientType: 'system'}
    )

    expect(memoryTransport.messages).toHaveLength(1)
    const [sent] = memoryTransport.messages
    expect(sent.to).toBe('membre@exemple.test')
    expect(sent.subject).toMatch(/Objet$/)
    expect(sent.text).toBe('Version texte')
    expect(sent.from).toBeTruthy()
    expect(sent.html).toContain('Bonjour depuis le gabarit')
  })

  it('accepte un gabarit asynchrone (promesse d’élément)', async () => {
    const template = async () => (
      <Html>
        <Text>Gabarit asynchrone</Text>
      </Html>
    )

    await sendEmailService(
      {
        to: 'a@exemple.test',
        subject: 'Objet',
        text: 'Texte',
        react: template(),
      },
      PLATFORM,
      {recipientType: 'system'}
    )

    expect(memoryTransport.messages[0].html).toContain('Gabarit asynchrone')
  })

  it('envoie un email texte seul sans HTML', async () => {
    await sendSimpleEmailService({
      to: 'a@exemple.test',
      subject: 'Objet',
      text: 'Texte seul',
    })

    expect(memoryTransport.messages).toHaveLength(1)
    expect(memoryTransport.messages[0].text).toBe('Texte seul')
    expect(memoryTransport.messages[0].html).toBeUndefined()
  })

  it('laisse remonter l’échec du transport tel quel', async () => {
    vi.mocked(getEmailTransport).mockReturnValue({
      ...memoryTransport,
      send: vi.fn(() =>
        Promise.reject(new EmailTransportError('brevo', 'refus'))
      ),
    })

    await expect(
      sendEmailService(
        {to: 'a@exemple.test', subject: 'Objet', text: 'Texte'},
        PLATFORM,
        {recipientType: 'system'}
      )
    ).rejects.toBeInstanceOf(EmailTransportError)
  })
})

describe('sendEmailService — en-têtes, réponse et nom d’expéditeur (s25)', () => {
  beforeEach(() => {
    memoryTransport.messages.length = 0
    vi.mocked(getEmailTransport).mockReturnValue(memoryTransport)
  })

  it('compose l’expéditeur « Nom <adresse> » et passe en-têtes et réponse', async () => {
    await sendEmailService(
      {
        to: 'membre@exemple.test',
        subject: 'Objet',
        text: 'Texte',
        senderName: 'ASL Les Pins',
        replyTo: 'bureau@asl-les-pins.test',
        headers: {'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'},
      },
      PLATFORM,
      {recipientType: 'client'}
    )

    const [sent] = memoryTransport.messages
    expect(sent.from).toMatch(/^ASL Les Pins <[^<>\s]+@[^<>\s]+>$/)
    expect(sent.replyTo).toBe('bureau@asl-les-pins.test')
    expect(sent.headers).toEqual({
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    })
  })

  it('n’ajoute ni en-têtes ni réponse sans demande', async () => {
    await sendEmailService(
      {to: 'a@exemple.test', subject: 'Objet', text: 'Texte'},
      PLATFORM,
      {recipientType: 'system'}
    )

    expect(memoryTransport.messages[0]).not.toHaveProperty('headers')
    expect(memoryTransport.messages[0]).not.toHaveProperty('replyTo')
    expect(memoryTransport.messages[0].from).not.toContain('<')
  })
})

describe('isClientEmailEnabledService', () => {
  it('reflète l’interrupteur des envois aux membres', async () => {
    const {getBooleanSettingService} =
      await import('@/services/app-settings-service')
    const {isClientEmailEnabledService} =
      await import('@/services/email-service')

    vi.mocked(getBooleanSettingService).mockResolvedValue(true)
    await expect(isClientEmailEnabledService()).resolves.toBe(true)

    vi.mocked(getBooleanSettingService).mockImplementation(async (key) =>
      key === 'email.enabled_for_clients' ? false : true
    )
    await expect(isClientEmailEnabledService()).resolves.toBe(false)
    vi.mocked(getBooleanSettingService).mockResolvedValue(true)
  })
})

describe('sendEmailService — le budget quotidien se tient dans l’adaptateur (s52, ADR 053)', () => {
  const ORG_ID = '11111111-1111-4111-8111-111111111111'
  const DEFERRED_ID = '44444444-4444-4444-8444-444444444444'
  const REPORT_ID = '55555555-5555-4555-8555-555555555555'
  const NOW = new Date('2026-11-14T15:00:00.000Z')

  /**
   * L'emetteur de test du critere 1 : un envoi d'association qui n'est pas
   * une campagne. Il ne sait rien du budget ; l'adaptateur le decompte.
   */
  const sendTestBoardNotification = (to = 'bureau@asl-les-pins.test') =>
    sendEmailService(
      {
        to,
        subject: 'Nouveau signalement',
        text: 'Une fuite rue des Pins',
        senderName: 'ASL Les Pins',
        react: (
          <Html>
            <Text>Une fuite rue des Pins</Text>
          </Html>
        ),
      },
      {
        scope: 'tenant',
        organizationId: ORG_ID,
        nature: 'board_notification',
        reference: {type: 'incident_report', id: REPORT_ID},
      },
      {recipientType: 'system'}
    )

  const loginContext: EmailSendContext = {
    scope: 'tenant',
    organizationId: ORG_ID,
    nature: 'login',
  }

  beforeEach(() => {
    vi.useFakeTimers({toFake: ['Date']})
    vi.setSystemTime(NOW)
    memoryTransport.messages.length = 0
    vi.mocked(getEmailTransport).mockReturnValue(memoryTransport)
    vi.mocked(getBooleanSettingService).mockResolvedValue(true)
    vi.mocked(withTenant).mockClear()
    vi.mocked(claimReportableSendTxnDao).mockReset()
    vi.mocked(countLoginSendTxnDao).mockReset()
    vi.mocked(refundReportableSendTxnDao).mockReset()
    vi.mocked(createDeferredEmailTxnDao).mockReset()
    vi.mocked(enqueueScheduledJobTxnDao).mockReset()
    vi.mocked(getAssociationSettingsService).mockResolvedValue(
      resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
    )
    vi.mocked(createDeferredEmailTxnDao).mockResolvedValue({id: DEFERRED_ID})
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('un émetteur qui n’est pas une campagne consomme le budget de son association, sous son scope (critère 1)', async () => {
    vi.mocked(claimReportableSendTxnDao).mockImplementation(async () => {
      expect(scope.current).toBe(ORG_ID)
      return true
    })

    const result = await sendTestBoardNotification()

    expect(result).toEqual({status: 'sent'})
    expect(claimReportableSendTxnDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      day: '2026-11-14',
      allowance: 200,
    })
    expect(memoryTransport.messages).toHaveLength(1)
  })

  it('la marge des reportables suit la limite et la réserve de l’association', async () => {
    vi.mocked(getAssociationSettingsService).mockResolvedValue(
      resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
        {key: EMAIL_DAILY_SEND_LIMIT_SETTING_KEY, value: '50'},
        {key: EMAIL_LOGIN_RESERVE_SETTING_KEY, value: '10'},
      ])
    )
    vi.mocked(claimReportableSendTxnDao).mockResolvedValue(true)

    await sendTestBoardNotification()

    expect(claimReportableSendTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({allowance: 40})
    )
  })

  it('budget épuisé : rien ne part, le message rendu est conservé et sa tâche créée dans la même transaction (critère 4)', async () => {
    vi.mocked(claimReportableSendTxnDao).mockResolvedValue(false)
    const scopes: Record<string, number> = {}
    vi.mocked(createDeferredEmailTxnDao).mockImplementation(async () => {
      scopes.create = scope.id
      return {id: DEFERRED_ID}
    })
    vi.mocked(enqueueScheduledJobTxnDao).mockImplementation(async () => {
      scopes.enqueue = scope.id
      return {id: 'job'}
    })

    const result = await sendTestBoardNotification()

    expect(result).toEqual({status: 'deferred', until: '2026-11-15'})
    expect(memoryTransport.messages).toHaveLength(0)
    expect(createDeferredEmailTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        nature: 'board_notification',
        recipient: 'bureau@asl-les-pins.test',
        subject: expect.stringMatching(/Nouveau signalement$/),
        textBody: 'Une fuite rue des Pins',
        htmlBody: expect.stringContaining('Une fuite rue des Pins'),
        senderName: 'ASL Les Pins',
        sendOn: '2026-11-15',
        referenceType: 'incident_report',
        referenceId: REPORT_ID,
      })
    )
    expect(enqueueScheduledJobTxnDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      kind: EMAIL_DELIVER_DEFERRED_JOB_KIND,
      idempotencyKey: DEFERRED_ID,
      runAfter: new Date('2026-11-15T01:00:00.000Z'),
      payload: {deferredEmailId: DEFERRED_ID},
    })
    expect(scopes.create).toBeGreaterThan(0)
    expect(scopes.enqueue).toBe(scopes.create)
  })

  it('le lien de connexion part même budget épuisé, et il est décompté (critère 3)', async () => {
    vi.mocked(claimReportableSendTxnDao).mockResolvedValue(false)
    vi.mocked(countLoginSendTxnDao).mockImplementation(async () => {
      expect(scope.current).toBe(ORG_ID)
    })

    const result = await sendEmailService(
      {to: 'membre@asl.test', subject: 'Votre lien', text: 'https://lien'},
      loginContext,
      {recipientType: 'system'}
    )

    expect(result).toEqual({status: 'sent'})
    expect(countLoginSendTxnDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      day: '2026-11-14',
    })
    expect(claimReportableSendTxnDao).not.toHaveBeenCalled()
    expect(createDeferredEmailTxnDao).not.toHaveBeenCalled()
    expect(memoryTransport.messages).toHaveLength(1)
  })

  it('un email de plateforme ne touche le budget d’aucune association (critère 8)', async () => {
    const result = await sendEmailService(
      {to: 'admin@plateforme.test', subject: 'Abonnement', text: 'Texte'},
      {scope: 'platform', nature: 'billing'}
    )

    expect(result).toEqual({status: 'sent'})
    expect(withTenant).not.toHaveBeenCalled()
    expect(claimReportableSendTxnDao).not.toHaveBeenCalled()
    expect(countLoginSendTxnDao).not.toHaveBeenCalled()
    expect(memoryTransport.messages).toHaveLength(1)
  })

  it('un refus certain du fournisseur rend l’unité décomptée, puis remonte', async () => {
    vi.mocked(claimReportableSendTxnDao).mockResolvedValue(true)
    vi.mocked(getEmailTransport).mockReturnValue({
      ...memoryTransport,
      send: vi.fn(() =>
        Promise.reject(
          new EmailTransportError('brevo', 'refus', {refused: true})
        )
      ),
    })

    await expect(sendTestBoardNotification()).rejects.toBeInstanceOf(
      EmailTransportError
    )
    expect(refundReportableSendTxnDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      day: '2026-11-14',
    })
  })

  it('une issue inconnue garde l’unité décomptée (le budget est un majorant)', async () => {
    vi.mocked(claimReportableSendTxnDao).mockResolvedValue(true)
    vi.mocked(getEmailTransport).mockReturnValue({
      ...memoryTransport,
      send: vi.fn(() => Promise.reject(new Error('réseau'))),
    })

    await expect(sendTestBoardNotification()).rejects.toThrow('réseau')
    expect(refundReportableSendTxnDao).not.toHaveBeenCalled()
  })

  it('une campagne refusée par le budget n’est pas copiée : sa ligne de destinataire est sa file (ADR 053 §5)', async () => {
    vi.mocked(claimReportableSendTxnDao).mockResolvedValue(false)

    const result = await sendEmailService(
      {to: 'membre@asl.test', subject: 'Convocation', text: 'Texte'},
      {scope: 'tenant', organizationId: ORG_ID, nature: 'campaign'}
    )

    expect(result).toEqual({status: 'deferred', until: '2026-11-15'})
    expect(createDeferredEmailTxnDao).not.toHaveBeenCalled()
    expect(enqueueScheduledJobTxnDao).not.toHaveBeenCalled()
    expect(memoryTransport.messages).toHaveLength(0)
  })

  it('envois désactivés par les réglages : ignoré, aucun compteur touché', async () => {
    vi.mocked(getBooleanSettingService).mockResolvedValue(false)

    const result = await sendEmailService(
      {to: 'membre@asl.test', subject: 'Convocation', text: 'Texte'},
      {scope: 'tenant', organizationId: ORG_ID, nature: 'campaign'}
    )

    expect(result).toEqual({status: 'skipped'})
    expect(claimReportableSendTxnDao).not.toHaveBeenCalled()
    expect(memoryTransport.messages).toHaveLength(0)
  })

  it('la portée est obligatoire : un appel sans contexte ne compile pas', () => {
    const callWithoutContext = () =>
      // @ts-expect-error -- le contexte d'envoi est obligatoire (ADR 053 §1)
      sendEmailService({to: 'a@exemple.test', subject: 'Objet', text: 'T'})
    const callWithOptionsOnly = () =>
      sendEmailService(
        {to: 'a@exemple.test', subject: 'Objet', text: 'T'},
        // @ts-expect-error -- les options seules ne sont pas une portée
        {recipientType: 'system'}
      )
    expect(callWithoutContext).toBeTypeOf('function')
    expect(callWithOptionsOnly).toBeTypeOf('function')
  })
})

describe('sendEmailService — étiquettes du fournisseur (s30, ADR 068)', () => {
  beforeEach(() => {
    memoryTransport.messages.length = 0
    vi.mocked(getEmailTransport).mockReturnValue(memoryTransport)
  })

  it('un envoi étiqueté arrive étiqueté au transport', async () => {
    await sendEmailService(
      {
        to: 'membre@exemple.test',
        subject: 'Objet',
        text: 'Texte',
        tags: ['campaign-0d9a2c1e-5b7f-4e8a-9c3d-2f1e0a9b8c7d'],
      },
      PLATFORM,
      {recipientType: 'system'}
    )

    expect(memoryTransport.messages[0].tags).toEqual([
      'campaign-0d9a2c1e-5b7f-4e8a-9c3d-2f1e0a9b8c7d',
    ])
  })

  it('un envoi sans étiquette n’a pas de `tags`', async () => {
    await sendEmailService(
      {to: 'membre@exemple.test', subject: 'Objet', text: 'Texte'},
      PLATFORM,
      {recipientType: 'system'}
    )

    expect(memoryTransport.messages[0]).not.toHaveProperty('tags')
  })
})

describe('readEmailTagStatisticsService — lecture par le transport actif (s30)', () => {
  const query = {
    tag: 'campaign-0d9a2c1e-5b7f-4e8a-9c3d-2f1e0a9b8c7d',
    startDate: '2026-11-11',
    endDate: '2026-11-21',
  }

  beforeEach(() => {
    memoryTransport.statisticsQueries.length = 0
    memoryTransport.setTagStatistics({status: 'unsupported'})
    vi.mocked(getEmailTransport).mockReturnValue(memoryTransport)
  })

  afterEach(() => {
    memoryTransport.setTagStatistics({status: 'unsupported'})
  })

  it('rend l’agrégat du transport pour la requête reçue', async () => {
    const found = {
      status: 'found' as const,
      requests: 302,
      delivered: 300,
      uniqueOpens: 154,
      uniqueClicks: 42,
    }
    memoryTransport.setTagStatistics(found)

    await expect(readEmailTagStatisticsService(query)).resolves.toEqual(found)
    expect(memoryTransport.statisticsQueries).toEqual([query])
  })

  it('un transport sans statistiques le dit', async () => {
    await expect(readEmailTagStatisticsService(query)).resolves.toEqual({
      status: 'unsupported',
    })
  })
})
