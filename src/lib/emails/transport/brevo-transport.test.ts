import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {createBrevoTransport} from './brevo-transport'
import {EmailTransportError} from './email-transport'

const message = {
  from: 'contact@asl-les-pins.test',
  to: 'membre@exemple.test',
  subject: 'ASL Les Pins — votre lien de connexion',
  html: '<p>Bonjour</p>',
  text: 'Bonjour',
}

describe('createBrevoTransport', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('envoie la requête exacte de l’API transactionnelle de Brevo', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"messageId":"1"}', {status: 201})
    )

    await createBrevoTransport({apiKey: 'xkeysib-test'}).send(message)

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({
      'api-key': 'xkeysib-test',
      'content-type': 'application/json',
      accept: 'application/json',
    })
    expect(JSON.parse(init.body)).toEqual({
      sender: {email: 'contact@asl-les-pins.test'},
      to: [{email: 'membre@exemple.test'}],
      subject: 'ASL Les Pins — votre lien de connexion',
      htmlContent: '<p>Bonjour</p>',
      textContent: 'Bonjour',
    })
  })

  it('lit le nom d’expéditeur écrit « Nom <adresse> »', async () => {
    fetchMock.mockResolvedValue(new Response('{}', {status: 201}))

    await createBrevoTransport({apiKey: 'k'}).send({
      ...message,
      from: 'ASL Les Pins <contact@asl-les-pins.test>',
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.sender).toEqual({
      name: 'ASL Les Pins',
      email: 'contact@asl-les-pins.test',
    })
  })

  it('transmet les en-têtes et l’adresse de réponse quand ils sont fournis', async () => {
    fetchMock.mockResolvedValue(new Response('{}', {status: 201}))

    await createBrevoTransport({apiKey: 'k'}).send({
      ...message,
      headers: {
        'List-Unsubscribe': '<https://asl.test/api/campaigns/unsubscribe/x>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      replyTo: 'bureau@asl-les-pins.test',
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.headers).toEqual({
      'List-Unsubscribe': '<https://asl.test/api/campaigns/unsubscribe/x>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    })
    expect(body.replyTo).toEqual({email: 'bureau@asl-les-pins.test'})
  })

  it('n’ajoute ni en-têtes ni réponse quand ils sont absents', async () => {
    fetchMock.mockResolvedValue(new Response('{}', {status: 201}))

    await createBrevoTransport({apiKey: 'k'}).send(message)

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(Object.keys(body).sort()).toEqual(
      ['sender', 'to', 'subject', 'htmlContent', 'textContent'].sort()
    )
  })

  it('lève une EmailTransportError sur une réponse non 2xx', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"code":"unauthorized"}', {status: 401})
    )

    await expect(
      createBrevoTransport({apiKey: 'k'}).send(message)
    ).rejects.toBeInstanceOf(EmailTransportError)
  })

  it('une réponse non 2xx est un refus certain : l’email n’est pas parti (s26)', async () => {
    fetchMock.mockResolvedValue(new Response('{}', {status: 429}))

    await expect(
      createBrevoTransport({apiKey: 'k'}).send(message)
    ).rejects.toMatchObject({refused: true})
  })

  it('lève une EmailTransportError quand le réseau échoue', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    await expect(
      createBrevoTransport({apiKey: 'k'}).send(message)
    ).rejects.toBeInstanceOf(EmailTransportError)
  })

  it('un réseau en échec n’est pas un refus certain : l’issue est inconnue (s26)', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    await expect(
      createBrevoTransport({apiKey: 'k'}).send(message)
    ).rejects.toMatchObject({refused: false})
  })
})
