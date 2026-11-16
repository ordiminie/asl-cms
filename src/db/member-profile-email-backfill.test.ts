import fs from 'node:fs'
import path from 'node:path'

import {describe, expect, it} from 'vitest'

/**
 * Reprise des adresses de fiche (s54, ADR 056, ADR 057). La base n'est pas
 * joignable en unitaire : le test lit les migrations, dans l'ordre du
 * journal. Le rejeu reel sur une base peuplee est consigne au rapport
 * d'execution de la story (critere 6).
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

const createdIndex = () =>
  indexOfMigration((sql) => sql.includes('CREATE TABLE "member_profile_email"'))

const backfillIndex = () =>
  indexOfMigration((sql) => sql.includes('INSERT INTO "member_profile_email"'))

const backfillSql = () => migrations()[backfillIndex()].sql

describe('reprise des adresses de fiche (ADR 056)', () => {
  it('suit la création de la table et précède le retrait de member_profile.email', () => {
    const dropped = indexOfMigration((sql) =>
      /ALTER TABLE "member_profile" DROP COLUMN "email"/.test(sql)
    )

    expect(createdIndex()).toBeGreaterThan(-1)
    expect(backfillIndex()).toBeGreaterThan(createdIndex())
    expect(dropped).toBeGreaterThan(backfillIndex())
  })

  it('pose la RLS activée et forcée, avec la policy tenant_isolation', () => {
    const sql = backfillSql()

    expect(sql).toContain(
      'ALTER TABLE "member_profile_email" ENABLE ROW LEVEL SECURITY'
    )
    expect(sql).toContain(
      'ALTER TABLE "member_profile_email" FORCE ROW LEVEL SECURITY'
    )
    expect(sql).toMatch(
      /CREATE POLICY "tenant_isolation" ON "member_profile_email"/
    )
  })

  it('reprend chaque adresse non nulle, active et titulaire, origine par la clé Pennylane', () => {
    const sql = backfillSql()

    expect(sql).toMatch(
      /INSERT INTO "member_profile_email"[\s\S]*FROM "member_profile"[\s\S]*"email" IS NOT NULL/
    )
    expect(sql).toContain("'holder'")
    expect(sql).toContain("'active'")
    expect(sql).toMatch(/"pennylane_customer_id" IS NOT NULL[\s\S]*'file'/)
    expect(sql).toContain("'site'")
  })

  it('pose le tenant association par association, jamais de contournement', () => {
    const sql = backfillSql()

    expect(sql).toContain("set_config('app.organization_id'")
    expect(sql).not.toMatch(/set_config\('app\.bypass_rls'/)
  })
})

describe('reprise des refus et des destinataires (ADR 057)', () => {
  it('date l’adresse des fiches désinscrites avant le retrait de member_unsubscribe', () => {
    const dropped = indexOfMigration((sql) =>
      sql.includes('DROP TABLE "member_unsubscribe"')
    )

    expect(backfillSql()).toMatch(
      /UPDATE "member_profile_email"[\s\S]*SET "unsubscribed_at"[\s\S]*FROM "member_unsubscribe"/
    )
    expect(dropped).toBeGreaterThan(backfillIndex())
  })

  it('donne aux lignes d’envoi existantes l’adresse de leur fiche, avant de l’exiger', () => {
    const required = indexOfMigration((sql) =>
      /ALTER TABLE "campaign_recipient" ALTER COLUMN "email" SET NOT NULL/.test(
        sql
      )
    )

    expect(backfillSql()).toMatch(
      /UPDATE "campaign_recipient"[\s\S]*SET "email"/
    )
    expect(required).toBeGreaterThan(backfillIndex())
  })
})
