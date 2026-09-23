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
 *
 * ⚠️ Il vit **hors de `src/db/models/`** : `drizzle.config.ts` y declare son
 * glob de schema (`./src/db/models/*`) et drizzle-kit charge chaque fichier du
 * dossier par `require`, ce qu'un import de `vitest` refuse. Un fichier de test
 * depose la casse tous les scripts drizzle-kit d'un coup.
 */

const ROOT = path.resolve(import.meta.dirname, '../..')
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

const sorted = (names: string[]): string[] => [...new Set(names)].sort()

/**
 * Les tables declarees par `pgTable` dans une source de modele.
 *
 * Le motif accepte chiffres et majuscules : borne aux minuscules, il aurait
 * ignore en silence une table `analyse_eau_2024` — ni exigee au classement, ni
 * comptee. C'est exactement ainsi que `rate_limit_event` avait derive.
 */
export const tableNamesIn = (source: string): string[] =>
  sorted(
    [...source.matchAll(/pgTable\(\s*'([A-Za-z0-9_]+)'/g)].map(
      (match) => match[1]
    )
  )

/** Les tables passees en RLS forcee par une migration. */
export const forcedTablesIn = (sql: string): string[] =>
  sorted(
    [
      ...sql.matchAll(
        /ALTER TABLE "([A-Za-z0-9_]+)" FORCE ROW LEVEL SECURITY/g
      ),
    ].map((match) => match[1])
  )

/** Les tables nommees en premiere colonne d'un tableau du classement. */
export const listedTablesIn = (block: string): string[] =>
  sorted(
    block
      .split('\n')
      .filter((line) => line.trimStart().startsWith('|'))
      .flatMap((line) => {
        const firstCell = line.trimStart().slice(1).split('|')[0] ?? ''
        return [...firstCell.matchAll(/`([A-Za-z0-9_]+)`/g)].map(
          (match) => match[1]
        )
      })
  )

/**
 * Decoupe une section entre deux titres. Une borne introuvable **echoue**,
 * en nommant le titre attendu : une section renommee doit casser le test,
 * jamais le reduire silencieusement a une tranche vide ou a tout le document.
 */
export const sliceSection = (
  text: string,
  startHeading: string,
  endHeading: string
): string => {
  const start = text.indexOf(startHeading)
  if (start === -1) {
    throw new Error(
      `Titre introuvable dans docs/architecture.md : ${startHeading}`
    )
  }

  const end = text.indexOf(endHeading, start)
  if (end === -1) {
    throw new Error(
      `Titre introuvable dans docs/architecture.md : ${endHeading}`
    )
  }

  return text.slice(start, end)
}

const modelTableNames = (): string[] =>
  sorted(
    readSources(
      MODELS_DIR,
      (name) => name.endsWith('.ts') && !name.endsWith('.test.ts')
    ).flatMap((source) => tableNamesIn(source))
  )

const forcedRlsTableNames = (): string[] =>
  sorted(
    readSources(MIGRATIONS_DIR, (name) => name.endsWith('.sql')).flatMap(
      (source) => forcedTablesIn(source)
    )
  )

const architecture = (): string => fs.readFileSync(ARCHITECTURE, 'utf8')

const rlsSection = (): string =>
  sliceSection(architecture(), '### Classement RLS', '## Integration points')

/** Le bloc des tables scopees, jusqu'au groupe suivant. */
const scopedBlock = (): string =>
  sliceSection(
    rlsSection(),
    '**Scopée par une policy RLS forcée**',
    '**Plan identité'
  )

const announcedCount = (text: string, pattern: RegExp): number => {
  const match = text.match(pattern)
  return match ? Number(match[1]) : Number.NaN
}

describe('glob de schéma de drizzle-kit', () => {
  it('ne contient aucun fichier de test, sinon les scripts drizzle ne démarrent plus', () => {
    const tests = fs
      .readdirSync(MODELS_DIR)
      .filter((name) => name.endsWith('.test.ts'))

    expect(tests).toEqual([])
  })
})

describe('extraction — les angles morts de la garde elle-même', () => {
  it('voit une table dont le nom porte un chiffre ou une majuscule', () => {
    const source = `
      export const analyses = pgTable('analyse_eau_2024', {})
      export const legacy = pgTable('legacyTable', {})
      export const plain = pgTable('news', {})
    `

    expect(tableNamesIn(source)).toEqual([
      'analyse_eau_2024',
      'legacyTable',
      'news',
    ])
  })

  it('voit une policy forcée sur une telle table', () => {
    const sql = `
      ALTER TABLE "analyse_eau_2024" FORCE ROW LEVEL SECURITY;
      ALTER TABLE "news" FORCE ROW LEVEL SECURITY;
    `

    expect(forcedTablesIn(sql)).toEqual(['analyse_eau_2024', 'news'])
  })

  it('lit les tables de la première colonne du classement, elles seules', () => {
    const block = [
      '| Table | Pourquoi |',
      '| ----- | -------- |',
      '| `news` | Porte `organization_id`, policy `tenant_isolation` forcée. |',
      '| `menu_item` | Voir la migration `0015`. |',
    ].join('\n')

    expect(listedTablesIn(block)).toEqual(['menu_item', 'news'])
  })

  it('échoue en nommant le titre quand une borne de section a disparu', () => {
    const text = '### Classement RLS\ncontenu\n## Autre titre\n'

    expect(() =>
      sliceSection(text, '### Classement RLS', '## Integration points')
    ).toThrow('## Integration points')
    expect(() =>
      sliceSection(text, '### Titre absent', '## Autre titre')
    ).toThrow('### Titre absent')
  })
})

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

  // Le sens inverse compte autant : une table annoncee scopee sans policy
  // derriere elle est une isolation qu'on croit avoir et qu'on n'a pas.
  it('ne déclare scopée aucune table sans policy forcée', () => {
    const listed = listedTablesIn(scopedBlock())
    const forced = forcedRlsTableNames()
    const unforced = listed.filter((table) => !forced.includes(table))

    expect(unforced).toEqual([])
    expect(listed).toEqual(forced)
  })
})
