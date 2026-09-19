import {beforeEach, describe, expect, it, vi} from 'vitest'

const sendMock = vi.fn()

vi.mock('resend', () => ({
  Resend: vi.fn(function Resend() {
    return {emails: {send: sendMock}}
  }),
}))

import {Resend} from 'resend'

import {EmailTransportError} from './email-transport'
import {createResendTransport} from './resend-transport'

const message = {
  from: 'contact@asl-les-pins.test',
  to: 'membre@exemple.test',
  subject: 'Objet',
  html: '<p>Bonjour</p>',
  text: 'Bonjour',
}

describe('createResendTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('confie le message au SDK Resend avec la clé fournie', async () => {
    sendMock.mockResolvedValue({data: {id: '1'}, error: null})

    await createResendTransport({apiKey: 're_test'}).send(message)

    expect(Resend).toHaveBeenCalledWith('re_test')
    expect(sendMock).toHaveBeenCalledWith({
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    })
  })

  it('traduit l’erreur renvoyée par le SDK en EmailTransportError', async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: {name: 'validation_error', message: 'refused'},
    })

    await expect(
      createResendTransport({apiKey: 're_test'}).send(message)
    ).rejects.toBeInstanceOf(EmailTransportError)
  })

  it('traduit une exception du SDK en EmailTransportError', async () => {
    sendMock.mockRejectedValue(new Error('network'))

    await expect(
      createResendTransport({apiKey: 're_test'}).send(message)
    ).rejects.toBeInstanceOf(EmailTransportError)
  })
})
