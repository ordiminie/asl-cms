/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {expect} from '@playwright/test'

/**
 * La boîte d'envoi du transport `file` (CI : `EMAIL_TRANSPORT=file`), sur le
 * patron de `member-invitations.spec.ts` : un fichier JSON par email, hérité
 * par le sous-processus du planificateur.
 */

export type OutboxMessage = {to: string; subject?: string; text: string}

const outboxDir = () =>
  process.env.EMAIL_OUTBOX_DIR ?? path.join(os.tmpdir(), 'asl-cms-email-outbox')

export const outboxFiles = (): Set<string> => {
  const dir = outboxDir()
  return new Set(
    fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((file) => file.endsWith('.json'))
      : []
  )
}

export const newMessagesTo = (
  before: Set<string>,
  to: string
): OutboxMessage[] =>
  [...outboxFiles()]
    .filter((file) => !before.has(file))
    .map(
      (file) =>
        JSON.parse(
          fs.readFileSync(path.join(outboxDir(), file), 'utf8')
        ) as OutboxMessage
    )
    .filter((message) => message.to.toLowerCase() === to.toLowerCase())

/** L'URL du lien de connexion, en clair dans la version texte. */
export const loginLinkOf = (message: OutboxMessage) => {
  const link = message.text.match(
    /https?:\/\/\S+\/magic-link\/verify\?\S+/
  )?.[0]
  expect(link, 'la version texte porte l’URL en clair').toBeTruthy()
  return link as string
}

/** Le jeton de désinscription du pied de campagne (s25). */
export const unsubscribeTokenOf = (message: OutboxMessage) => {
  const token = message.text.match(/\/desinscription\/([A-Za-z0-9_-]{43})/)?.[1]
  expect(token, 'le pied porte le lien de désinscription').toBeTruthy()
  return token as string
}
