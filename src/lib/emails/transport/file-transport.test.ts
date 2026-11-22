import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {createFileTransport} from './file-transport'
import {createMemoryTransport} from './memory-transport'

const message = {
  from: 'contact@asl-les-pins.test',
  to: 'membre@exemple.test',
  subject: 'Objet',
  html: '<p>Bonjour</p>',
  text: 'Bonjour',
}

describe('createFileTransport', () => {
  let dir: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'outbox-test-'))
  })

  afterEach(async () => {
    await fs.rm(dir, {recursive: true, force: true})
  })

  it('écrit chaque message en JSON dans le répertoire, créé au besoin', async () => {
    const outbox = path.join(dir, 'nested', 'outbox')
    const transport = createFileTransport(outbox)

    await transport.send(message)
    await transport.send({...message, to: 'autre@exemple.test'})

    const files = (await fs.readdir(outbox)).sort()
    expect(files).toHaveLength(2)
    expect(files.every((file) => file.endsWith('.json'))).toBe(true)

    const written = await Promise.all(
      files.map(async (file) =>
        JSON.parse(await fs.readFile(path.join(outbox, file), 'utf8'))
      )
    )
    expect(written.map((entry) => entry.to).sort()).toEqual([
      'autre@exemple.test',
      'membre@exemple.test',
    ])
    expect(written[0]).toMatchObject({
      from: message.from,
      subject: message.subject,
      html: message.html,
      text: message.text,
    })
  })
})

describe('createFileTransport — en-têtes', () => {
  let dir: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'outbox-test-'))
  })

  afterEach(async () => {
    await fs.rm(dir, {recursive: true, force: true})
  })

  it('écrit les en-têtes et l’adresse de réponse, que les e2e lisent', async () => {
    await createFileTransport(dir).send({
      ...message,
      headers: {'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'},
      replyTo: 'bureau@asl-les-pins.test',
    })

    const [file] = await fs.readdir(dir)
    const written = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'))
    expect(written.headers).toEqual({
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    })
    expect(written.replyTo).toBe('bureau@asl-les-pins.test')
  })
})

describe('createMemoryTransport', () => {
  it('garde les en-têtes et l’adresse de réponse', async () => {
    const transport = createMemoryTransport()

    await transport.send({
      ...message,
      headers: {'X-Test': '1'},
      replyTo: 'bureau@asl-les-pins.test',
    })

    expect(transport.messages[0]).toMatchObject({
      headers: {'X-Test': '1'},
      replyTo: 'bureau@asl-les-pins.test',
    })
  })

  it('garde les messages envoyés, dans l’ordre', async () => {
    const transport = createMemoryTransport()

    await transport.send(message)
    await transport.send({...message, subject: 'Second'})

    expect(transport.messages.map((sent) => sent.subject)).toEqual([
      'Objet',
      'Second',
    ])
  })
})

const statisticsQuery = {
  tag: 'campaign-0d9a2c1e-5b7f-4e8a-9c3d-2f1e0a9b8c7d',
  startDate: '2026-11-11',
  endDate: '2026-11-21',
}

describe('readTagStatistics — transports sans statistiques (s30, ADR 068)', () => {
  it('le transport fichier ne sait pas lire de statistiques', async () => {
    await expect(
      createFileTransport(os.tmpdir()).readTagStatistics(statisticsQuery)
    ).resolves.toEqual({status: 'unsupported'})
  })

  it('le transport mémoire répond « non pris en charge » par défaut', async () => {
    await expect(
      createMemoryTransport().readTagStatistics(statisticsQuery)
    ).resolves.toEqual({status: 'unsupported'})
  })

  it('le transport mémoire rend les statistiques amorcées et trace ses requêtes', async () => {
    const transport = createMemoryTransport()
    const found = {
      status: 'found' as const,
      requests: 302,
      delivered: 300,
      uniqueOpens: 154,
      uniqueClicks: 42,
    }
    transport.setTagStatistics(found)

    await expect(transport.readTagStatistics(statisticsQuery)).resolves.toEqual(
      found
    )
    expect(transport.statisticsQueries).toEqual([statisticsQuery])
  })
})
