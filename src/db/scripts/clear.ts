#!/usr/bin/env node
/* eslint-disable no-restricted-properties */
import {sql} from 'drizzle-orm'
import {drizzle} from 'drizzle-orm/node-postgres'
import pg from 'pg'

import {resolveMigrationUrl} from './db-url'
import initDotEnv from './env'

initDotEnv()

const runClean = async () => {
  // DDL destructif : role proprietaire, comme les migrations (ADR 002).
  const client = new pg.Client({
    connectionString: resolveMigrationUrl(process.env),
  })

  await client.connect()
  const db = drizzle(client)

  console.log('⏳ Running cleanning...')

  const start = Date.now()

  // Drop tables
  await db.execute(sql`
    DO $$ 
    DECLARE 
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = current_schema()) LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `)

  // Drops enums
  await db.execute(sql`
    DO $$
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT typname FROM pg_type WHERE typtype = 'e') LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
      END LOOP;
    END $$;
  `)

  // Drop l'historique des migrations drizzle : sans ça, un clear laisse
  // __drizzle_migrations peuplé alors que le schéma est vide, et db:migrate
  // saute la 0000 puis échoue sur les suivantes (état inconsistant)
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`)

  const end = Date.now()

  console.log('✅ Clean completed in', end - start, 'ms')

  process.exit(0)
}

try {
  await runClean()
} catch (error) {
  console.error('❌ Clean failed')
  console.error(error)
  process.exit(1)
}
