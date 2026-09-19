import os from 'node:os'
import path from 'node:path'

import {describe, expect, it, vi} from 'vitest'

vi.mock('./brevo-transport', () => ({
  createBrevoTransport: vi.fn(() => ({kind: 'brevo', send: vi.fn()})),
}))
vi.mock('./resend-transport', () => ({
  createResendTransport: vi.fn(() => ({kind: 'resend', send: vi.fn()})),
}))
vi.mock('./file-transport', () => ({
  createFileTransport: vi.fn(() => ({kind: 'file', send: vi.fn()})),
}))

import {createBrevoTransport} from './brevo-transport'
import {createFileTransport} from './file-transport'
import {resolveEmailTransport} from './get-email-transport'
import {createResendTransport} from './resend-transport'

const kindOf = (transport: unknown) => (transport as {kind?: string}).kind

describe('resolveEmailTransport', () => {
  it('choisit Brevo avec sa clé', () => {
    const transport = resolveEmailTransport({
      EMAIL_TRANSPORT: 'brevo',
      BREVO_API_KEY: 'xkeysib-1',
      NEXT_PUBLIC_NODE_ENV: 'production',
    })

    expect(kindOf(transport)).toBe('brevo')
    expect(createBrevoTransport).toHaveBeenCalledWith({apiKey: 'xkeysib-1'})
  })

  it('exige BREVO_API_KEY quand le transport est brevo', () => {
    expect(() =>
      resolveEmailTransport({
        EMAIL_TRANSPORT: 'brevo',
        NEXT_PUBLIC_NODE_ENV: 'production',
      })
    ).toThrow(/BREVO_API_KEY/)
  })

  it('choisit Resend avec sa clé, et l’exige', () => {
    const transport = resolveEmailTransport({
      EMAIL_TRANSPORT: 'resend',
      RESEND_API_KEY: 're_1',
      NEXT_PUBLIC_NODE_ENV: 'production',
    })
    expect(kindOf(transport)).toBe('resend')
    expect(createResendTransport).toHaveBeenCalledWith({apiKey: 're_1'})

    expect(() =>
      resolveEmailTransport({
        EMAIL_TRANSPORT: 'resend',
        NEXT_PUBLIC_NODE_ENV: 'production',
      })
    ).toThrow(/RESEND_API_KEY/)
  })

  it('n’exige aucune clé de fournisseur pour le transport fichier', () => {
    const transport = resolveEmailTransport({
      EMAIL_TRANSPORT: 'file',
      EMAIL_OUTBOX_DIR: '/tmp/outbox-ci',
      NEXT_PUBLIC_NODE_ENV: 'production',
    })

    expect(kindOf(transport)).toBe('file')
    expect(createFileTransport).toHaveBeenCalledWith('/tmp/outbox-ci')
  })

  it('écrit dans un répertoire temporaire quand EMAIL_OUTBOX_DIR est absent', () => {
    resolveEmailTransport({
      EMAIL_TRANSPORT: 'file',
      NEXT_PUBLIC_NODE_ENV: 'development',
    })

    expect(createFileTransport).toHaveBeenLastCalledWith(
      path.join(os.tmpdir(), 'asl-cms-email-outbox')
    )
  })

  it('prend le transport fichier par défaut hors production', () => {
    const transport = resolveEmailTransport({
      NEXT_PUBLIC_NODE_ENV: 'development',
    })

    expect(kindOf(transport)).toBe('file')
  })

  it('refuse de choisir un défaut en production', () => {
    expect(() =>
      resolveEmailTransport({NEXT_PUBLIC_NODE_ENV: 'production'})
    ).toThrow(/EMAIL_TRANSPORT/)
  })

  it('rend un transport mémoire pour les tests', async () => {
    const transport = resolveEmailTransport({
      EMAIL_TRANSPORT: 'memory',
      NEXT_PUBLIC_NODE_ENV: 'test',
    })

    await transport.send({
      from: 'a@exemple.test',
      to: 'b@exemple.test',
      subject: 'Objet',
      text: 'Texte',
    })
    expect(transport).toHaveProperty('messages')
  })
})
