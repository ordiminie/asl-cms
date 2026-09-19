import {randomUUID} from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import {EmailTransport, EmailTransportError} from './email-transport'

/**
 * Transport de developpement et de bout en bout : chaque message est ecrit en
 * JSON dans `dir`, rien ne part. C'est la boite de sortie que lisent les e2e.
 */
export const createFileTransport = (dir: string): EmailTransport => ({
  send: async (message) => {
    const sentAt = new Date().toISOString()
    const fileName = `${sentAt.replace(/[:.]/g, '-')}-${randomUUID()}.json`
    try {
      await fs.mkdir(dir, {recursive: true})
      await fs.writeFile(
        path.join(dir, fileName),
        JSON.stringify({...message, sentAt}, null, 2),
        'utf8'
      )
    } catch (error) {
      throw new EmailTransportError('file', 'Boite de sortie inaccessible', {
        cause: error,
      })
    }
  },
})
