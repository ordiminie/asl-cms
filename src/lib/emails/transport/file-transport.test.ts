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

describe('createMemoryTransport', () => {
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
