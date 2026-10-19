import {readFileSync} from 'node:fs'
import path from 'node:path'

import {describe, expect, it} from 'vitest'

import {clientSchema, serverSchema} from '@/env-schemas'

/** Cles lues hors du schema : posee par Next et systemd, ou lues par next.config.ts. */
const isReadElsewhere = (key: string) =>
  key === 'NODE_ENV' || key.startsWith('SENTRY_')

const template = readFileSync(
  path.join(import.meta.dirname, 'env.production.example'),
  'utf8'
)

/** Affectations actives du gabarit, commentaires exclus. */
const entries = new Map(
  template
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separator = line.indexOf('=')
      return [line.slice(0, separator), line.slice(separator + 1)] as const
    })
)

const schemaKeys = [...Object.keys(serverSchema), ...Object.keys(clientSchema)]

describe('ops/env.production.example — gabarit de l’environnement de production', () => {
  it.each(schemaKeys)('déclare %s', (key) => {
    expect(entries.has(key)).toBe(true)
  })

  it('ne porte aucune clé hors schéma', () => {
    const unknown = [...entries.keys()].filter(
      (key) => !schemaKeys.includes(key) && !isReadElsewhere(key)
    )
    expect(unknown).toEqual([])
  })

  it('fige NEXT_PUBLIC_NODE_ENV à production (lue au build)', () => {
    expect(entries.get('NEXT_PUBLIC_NODE_ENV')).toBe('production')
  })

  it('place LOCAL_STORAGE_ROOT dans shared/, par un chemin absolu', () => {
    const root = entries.get('LOCAL_STORAGE_ROOT') ?? ''
    expect(path.isAbsolute(root)).toBe(true)
    expect(root).toBe('/srv/asl-cms/shared/storage')
  })

  it('porte les valeurs de production attendues', () => {
    expect(entries.get('DATABASE_POOL_MAX')).toBe('10')
    expect(entries.get('EMAIL_TRANSPORT')).toBe('brevo')
    expect(entries.get('NEXT_PUBLIC_ENABLED_PAGES')).toBe('admin')
    expect(entries.get('BETTER_AUTH_URL')).toMatch(/^https:\/\/[^:]+$/)
  })

  it('migre sous un rôle distinct du rôle applicatif', () => {
    const app = entries.get('DATABASE_URL') ?? ''
    const migration = entries.get('DATABASE_MIGRATION_URL') ?? ''
    expect(migration).not.toBe('')
    expect(new URL(migration).username).not.toBe(new URL(app).username)
    expect(new URL(app).username).toBe('asl_app')
  })

  it.each([
    'BETTER_AUTH_SECRET',
    'BREVO_API_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SENTRY_AUTH_TOKEN',
    'GOOGLE_CLIENT_SECRET',
    'RESEND_API_KEY',
  ])('laisse le secret %s vide', (key) => {
    expect(entries.get(key)).toBe('')
  })
})
