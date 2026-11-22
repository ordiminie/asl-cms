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

describe('createBrevoTransport — étiquettes (s30, ADR 068)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('transmet les étiquettes de l’email dans le corps', async () => {
    fetchMock.mockResolvedValue(new Response('{}', {status: 201}))

    await createBrevoTransport({apiKey: 'k'}).send({
      ...message,
      tags: ['campaign-0d9a2c1e-5b7f-4e8a-9c3d-2f1e0a9b8c7d'],
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.tags).toEqual(['campaign-0d9a2c1e-5b7f-4e8a-9c3d-2f1e0a9b8c7d'])
  })

  it('n’ajoute pas de champ `tags` à un email sans étiquette', async () => {
    fetchMock.mockResolvedValue(new Response('{}', {status: 201}))

    await createBrevoTransport({apiKey: 'k'}).send(message)

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).not.toHaveProperty('tags')
  })
})

describe('createBrevoTransport — statistiques d’un tag (s30, ADR 068)', () => {
  const fetchMock = vi.fn()
  const query = {
    tag: 'campaign-0d9a2c1e-5b7f-4e8a-9c3d-2f1e0a9b8c7d',
    startDate: '2026-11-11',
    endDate: '2026-11-21',
  }

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('interroge l’agrégat du tag, sur la plage demandée, avec la clé', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          range: '2026-11-11|2026-11-21',
          requests: 302,
          delivered: 300,
          opens: 410,
          uniqueOpens: 154,
          clicks: 60,
          uniqueClicks: 42,
        }),
        {status: 200}
      )
    )

    const result = await createBrevoTransport({
      apiKey: 'xkeysib-test',
    }).readTagStatistics(query)

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(
      'https://api.brevo.com/v3/smtp/statistics/aggregatedReport?tag=campaign-0d9a2c1e-5b7f-4e8a-9c3d-2f1e0a9b8c7d&startDate=2026-11-11&endDate=2026-11-21'
    )
    expect(init.method).toBe('GET')
    expect(init.headers).toEqual({
      'api-key': 'xkeysib-test',
      accept: 'application/json',
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(result).toEqual({
      status: 'found',
      requests: 302,
      delivered: 300,
      uniqueOpens: 154,
      uniqueClicks: 42,
    })
  })

  it('encode le tag dans l’URL', async () => {
    fetchMock.mockResolvedValue(new Response('{}', {status: 200}))

    await createBrevoTransport({apiKey: 'k'}).readTagStatistics({
      ...query,
      tag: 'a b&c=d',
    })

    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.searchParams.get('tag')).toBe('a b&c=d')
    expect(fetchMock.mock.calls[0][0]).not.toContain('a b&c=d')
  })

  it('lit 0 pour un champ absent de la réponse', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({requests: 12}), {status: 200})
    )

    await expect(
      createBrevoTransport({apiKey: 'k'}).readTagStatistics(query)
    ).resolves.toEqual({
      status: 'found',
      requests: 12,
      delivered: 0,
      uniqueOpens: 0,
      uniqueClicks: 0,
    })
  })

  it('Brevo injoignable : EmailTransportError, sans refus certain', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    const error = await createBrevoTransport({apiKey: 'xkeysib-secret'})
      .readTagStatistics(query)
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(EmailTransportError)
    expect(error).toMatchObject({refused: false})
    expect(String((error as Error).message)).not.toContain('xkeysib-secret')
  })

  it('réponse non 2xx : EmailTransportError refusée, sans la clé', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"code":"unauthorized"}', {status: 401})
    )

    const error = await createBrevoTransport({apiKey: 'xkeysib-secret'})
      .readTagStatistics(query)
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(EmailTransportError)
    expect(error).toMatchObject({refused: true})
    expect(String((error as Error).message)).not.toContain('xkeysib-secret')
  })
})
