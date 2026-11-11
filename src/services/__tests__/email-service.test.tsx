import {beforeEach, describe, expect, it, vi} from 'vitest'

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

import {Html, Text} from 'react-email'

import {EmailTransportError} from '@/lib/emails/transport'
import {getEmailTransport} from '@/lib/emails/transport'
import {
  sendEmailService,
  sendSimpleEmailService,
} from '@/services/email-service'

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
      send: vi.fn(() =>
        Promise.reject(new EmailTransportError('brevo', 'refus'))
      ),
    })

    await expect(
      sendEmailService(
        {to: 'a@exemple.test', subject: 'Objet', text: 'Texte'},
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
