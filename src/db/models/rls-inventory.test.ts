import fs from 'node:fs'
import path from 'node:path'

import {describe, expect, it} from 'vitest'

/**
 * Garde d'inventaire RLS (ADR 002, critere 9 de s01).
 *
 * Le classement de `docs/architecture.md` doit etre **re-certifie a chaque
 * story** : toute table du schema y est classee, sans reste, et le decompte des
 * tables scopees est celui des policies reellement posees par les migrations.
 *
 * Ce test lit le code plutot que de faire confiance au texte : les declarations
 * `pgTable` d'un cote, les `FORCE ROW LEVEL SECURITY` des migrations de
 * l'autre. Il existe parce que la derive s'etait produite en silence — s03 a
 * scope `rate_limit_event` sans l'ajouter au classement.
 */

const ROOT = path.resolve(import.meta.dirname, '../../..')
const MODELS_DIR = path.join(ROOT, 'src/db/models')
const MIGRATIONS_DIR = path.join(ROOT, 'drizzle/migrations')
const ARCHITECTURE = path.join(ROOT, 'docs/architecture.md')

const readSources = (
  dir: string,
  filter: (name: string) => boolean
): string[] =>
  fs
    .readdirSync(dir)
    .filter((name) => filter(name))
    .map((name) => fs.readFileSync(path.join(dir, name), 'utf8'))

const modelTableNames = (): string[] =>
  [
    ...new Set(
      readSources(
        MODELS_DIR,
        (name) => name.endsWith('.ts') && !name.endsWith('.test.ts')
      ).flatMap((source) =>
        [...source.matchAll(/pgTable\(\s*'([a-z_]+)'/g)].map(
          (match) => match[1]
        )
      )
    ),
  ].sort()

const forcedRlsTableNames = (): string[] =>
  [
    ...new Set(
      readSources(MIGRATIONS_DIR, (name) => name.endsWith('.sql')).flatMap(
        (source) =>
          [
            ...source.matchAll(
              /ALTER TABLE "([a-z_]+)" FORCE ROW LEVEL SECURITY/g
            ),
          ].map((match) => match[1])
      )
    ),
  ].sort()

const architecture = (): string => fs.readFileSync(ARCHITECTURE, 'utf8')

const rlsSection = (): string => {
  const text = architecture()
  const start = text.indexOf('### Classement RLS')
  const end = text.indexOf('## Integration points', start)
  return text.slice(start, end)
}

/** Le bloc des tables scopees, jusqu'au groupe suivant. */
const scopedBlock = (): string => {
  const section = rlsSection()
  const start = section.indexOf('**Scopée par une policy RLS forcée**')
  const end = section.indexOf('**Plan identité', start)
  return section.slice(start, end)
}

const announcedCount = (text: string, pattern: RegExp): number => {
  const match = text.match(pattern)
  return match ? Number(match[1]) : Number.NaN
}

describe('docs/architecture.md — classement RLS', () => {
  it('classe toutes les tables du schéma, sans reste', () => {
    const section = rlsSection()
    const missing = modelTableNames().filter(
      (table) => !section.includes(`\`${table}\``)
    )

    expect(missing).toEqual([])
  })

  it('annonce le nombre réel de tables', () => {
    const total = modelTableNames().length

    expect(
      announcedCount(rlsSection(), /### Classement RLS des (\d+) tables/)
    ).toBe(total)
    expect(announcedCount(rlsSection(), /Les (\d+) tables du schéma/)).toBe(
      total
    )
  })

  it('liste les tables sous policy forcée, et les compte juste', () => {
    const forced = forcedRlsTableNames()
    const block = scopedBlock()
    const missing = forced.filter((table) => !block.includes(`\`${table}\``))

    expect(missing).toEqual([])
    expect(announcedCount(block, /policy RLS forcée\*\* — (\d+) tables/)).toBe(
      forced.length
    )
  })
})
