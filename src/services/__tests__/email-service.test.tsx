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

import {createTranslator} from 'next-intl'
import {getTranslations} from 'next-intl/server'
import {Html, Text} from 'react-email'

import {EmailTransportError} from '@/lib/emails/transport'
import {getEmailTransport} from '@/lib/emails/transport'
import {
  sendEmailService,
  sendMagicLinkEmailService,
  sendSimpleEmailService,
} from '@/services/email-service'

import messages from '../../../messages/fr.json'

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
      {to: 'a@exemple.test', subject: 'Objet', text: 'Texte', react: template()},
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

describe('sendMagicLinkEmailService — objet, pré-en-tête et version texte', () => {
  const url =
    'https://asl-les-pins.test/api/auth/magic-link/verify?token=abc&callbackURL=%2Fdashboard'

  beforeEach(() => {
    memoryTransport.messages.length = 0
    vi.mocked(getEmailTransport).mockReturnValue(memoryTransport)
    vi.mocked(getTranslations).mockImplementation((async (
      namespace: string
    ) =>
      createTranslator({
        locale: 'fr',
        messages,
        namespace: namespace as never,
      })) as never)
  })

  it('envoie l’email de l’association par le transport', async () => {
    await sendMagicLinkEmailService({
      email: 'membre@exemple.test',
      url,
      association: {name: 'ASL Les Pins', hue: 195},
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
})
