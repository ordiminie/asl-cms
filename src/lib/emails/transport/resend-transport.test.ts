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

  it('transmet les en-têtes et l’adresse de réponse au SDK', async () => {
    sendMock.mockResolvedValue({data: {id: '1'}, error: null})

    await createResendTransport({apiKey: 're_test'}).send({
      ...message,
      headers: {'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'},
      replyTo: 'bureau@asl-les-pins.test',
    })

    expect(sendMock.mock.calls[0][0]).toMatchObject({
      headers: {'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'},
      replyTo: 'bureau@asl-les-pins.test',
    })
  })

  it('n’ajoute aucun champ nouveau quand ils sont absents', async () => {
    sendMock.mockResolvedValue({data: {id: '1'}, error: null})

    await createResendTransport({apiKey: 're_test'}).send(message)

    expect(Object.keys(sendMock.mock.calls[0][0]).sort()).toEqual(
      ['from', 'to', 'subject', 'html', 'text'].sort()
    )
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

  it('une erreur rendue par le SDK est un refus certain (s26)', async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: {name: 'validation_error', message: 'refused'},
    })

    await expect(
      createResendTransport({apiKey: 're_test'}).send(message)
    ).rejects.toMatchObject({refused: true})
  })

  it('une exception du SDK n’est pas un refus certain (s26)', async () => {
    sendMock.mockRejectedValue(new Error('network'))

    await expect(
      createResendTransport({apiKey: 're_test'}).send(message)
    ).rejects.toMatchObject({refused: false})
  })
})
