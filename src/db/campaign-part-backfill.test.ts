import fs from 'node:fs'
import path from 'node:path'

import {describe, expect, it} from 'vitest'

/**
 * Rattrapage des campagnes de s25 (s26, ADR 052). La base n'est pas joignable
 * en unitaire : le test lit les migrations, dans l'ordre du journal.
 *
 * Toutes les migrations en attente s'appliquent dans **une seule
 * transaction** (migrateur de drizzle-orm) : une valeur d'enum ajoutee par
 * `ALTER TYPE ... ADD VALUE` n'y est pas encore utilisable. Le rattrapage ne
 * doit donc employer aucune des valeurs ajoutees par s26.
 */

const ROOT = path.resolve(import.meta.dirname, '../..')
const MIGRATIONS_DIR = path.join(ROOT, 'drizzle/migrations')

type JournalEntry = {idx: number; tag: string}

const migrations = (): {tag: string; sql: string}[] => {
  const journal = JSON.parse(
    fs.readFileSync(path.join(MIGRATIONS_DIR, 'meta/_journal.json'), 'utf8')
  ) as {entries: JournalEntry[]}
  return [...journal.entries]
    .sort((a, b) => a.idx - b.idx)
    .map(({tag}) => ({
      tag,
      sql: fs.readFileSync(path.join(MIGRATIONS_DIR, `${tag}.sql`), 'utf8'),
    }))
}

const indexOfMigration = (predicate: (sql: string) => boolean): number =>
  migrations().findIndex(({sql}) => predicate(sql))

const backfillIndex = () =>
  indexOfMigration((sql) => sql.includes('INSERT INTO "campaign_part"'))

describe('rattrapage des campagnes de s25 en parts', () => {
  it('crée une part 1 par campagne existante, au jour de son envoi', () => {
    const index = backfillIndex()
    expect(index).toBeGreaterThan(-1)
    const {sql} = migrations()[index]

    expect(sql).toMatch(/FROM "campaign"/)
    expect(sql).toContain('"send_date"')
    expect(sql).toMatch(/\b1\b/)
  })

  it('rattache chaque destinataire existant à la part de sa campagne', () => {
    const {sql} = migrations()[backfillIndex()]

    expect(sql).toMatch(/UPDATE "campaign_recipient"[\s\S]*SET "part_id"/)
  })

  it('suit la migration qui crée la table des parts', () => {
    const created = indexOfMigration((sql) =>
      sql.includes('CREATE TABLE "campaign_part"')
    )

    expect(created).toBeGreaterThan(-1)
    expect(backfillIndex()).toBeGreaterThan(created)
  })

  it('n’emploie aucune valeur de statut ajoutée par s26 dans la même transaction', () => {
    const {sql} = migrations()[backfillIndex()]

    for (const value of ['to_verify', 'unsubscribed']) {
      expect(sql, value).not.toContain(`'${value}'`)
    }
    expect(sql).not.toMatch(/"campaign_recipient"[^;]*'sending'/)
  })

  it('rend ensuite `part_id` obligatoire : aucun destinataire sans part', () => {
    const notNull = indexOfMigration((sql) =>
      /ALTER TABLE "campaign_recipient" ALTER COLUMN "part_id" SET NOT NULL/.test(
        sql
      )
    )

    expect(notNull).toBeGreaterThan(backfillIndex())
  })
})
