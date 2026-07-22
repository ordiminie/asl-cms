#!/usr/bin/env node
/* eslint-disable no-restricted-properties */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import pg from 'pg'

import initDotEnv from './env'

initDotEnv()

const MIGRATIONS_DIR = './drizzle/migrations'

type JournalEntry = {
  idx: number
  when: number
  tag: string
}

type ObjectCheck = {
  description: string
  query: string
}

// Une migration n'est baselinée que si ses objets existent déjà en base
// (schéma appliqué via db:push ou historique pré-squash de mai 2026)
const OBJECT_CHECKS: Record<string, ObjectCheck> = {
  '0000_minor_kylun': {
    description: "table 'user'",
    query: `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user'`,
  },
  '0001_milky_bug': {
    description: "enum credit_source contient 'system_adjustment'",
    query: `SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='credit_source' AND e.enumlabel='system_adjustment'`,
  },
  '0002_credit_ledger_dedup_index': {
    description: "index 'credit_ledger_source_dedup_unique_idx'",
    query: `SELECT 1 FROM pg_indexes WHERE indexname='credit_ledger_source_dedup_unique_idx'`,
  },
  '0003_apikey_reference_id': {
    description: "colonne 'apikey.reference_id'",
    query: `SELECT 1 FROM information_schema.columns WHERE table_name='apikey' AND column_name='reference_id'`,
  },
}

const runBaseline = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined')
  }

  const journal = JSON.parse(
    fs.readFileSync(path.join(MIGRATIONS_DIR, 'meta/_journal.json'), 'utf8')
  ) as {entries: JournalEntry[]}

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  })
  await client.connect()

  console.log('⏳ Baseline des migrations drizzle...')

  await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle`)
  await client.query(
    `CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`
  )

  // Cas inverse : schéma absent (pas de table user) mais historique de
  // migrations non vide = lignes périmées (clear/restore partiel, changement
  // de DB). On purge pour que db:migrate reparte de la 0000.
  const schemaExists = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user'`
  )
  if (schemaExists.rows.length === 0) {
    const stale = await client.query(
      `SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`
    )
    if (stale.rows[0].n > 0) {
      await client.query(`TRUNCATE drizzle.__drizzle_migrations`)
      console.log(
        `  🧹 schéma public vide : ${stale.rows[0].n} entrées périmées purgées de __drizzle_migrations`
      )
    }
    console.log(
      '✅ Baseline terminé — DB vierge, lancer pnpm db:migrate pour tout appliquer'
    )
    process.exit(0)
  }

  const recorded = await client.query(
    `SELECT created_at FROM drizzle.__drizzle_migrations`
  )
  const recordedAt = new Set(recorded.rows.map((r) => String(r.created_at)))

  for (const entry of journal.entries) {
    const sqlFile = path.join(MIGRATIONS_DIR, `${entry.tag}.sql`)
    const content = fs.readFileSync(sqlFile, 'utf8')
    const hash = crypto.createHash('sha256').update(content).digest('hex')

    if (recordedAt.has(String(entry.when))) {
      console.log(`  ⏭️  ${entry.tag}: already recorded`)
      continue
    }

    const check = OBJECT_CHECKS[entry.tag]
    if (!check) {
      console.log(
        `  ⏭️  ${entry.tag}: no object check defined, left for migrate`
      )
      continue
    }

    const exists = await client.query(check.query)
    if (exists.rows.length === 0) {
      console.log(
        `  ▶️  ${entry.tag}: ${check.description} absent(e), left for migrate`
      )
      continue
    }

    await client.query(
      `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
      [hash, entry.when]
    )
    console.log(
      `  ✅ ${entry.tag}: baselined (${check.description} présent(e))`
    )
  }

  console.log('✅ Baseline terminé')
  process.exit(0)
}

try {
  await runBaseline()
} catch (error) {
  console.error('❌ Baseline failed')
  console.error(error)
  process.exit(1)
}
