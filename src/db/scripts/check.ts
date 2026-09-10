#!/usr/bin/env node
/* eslint-disable no-restricted-properties */

import {sql} from 'drizzle-orm'
import {drizzle} from 'drizzle-orm/node-postgres'
import pg from 'pg'

import initDotEnv from './env'
import {assertApplicationRolePrivileges} from './role-privileges'

initDotEnv()

const checkConnexion = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined')
  }
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  })

  await client.connect()
  const db = drizzle(client)

  console.log('⏳ Checking connexion ...')

  const start = Date.now()
  await db.execute(sql`SELECT 1`)

  const end = Date.now()

  console.log('✅ Connexion checked in', end - start, 'ms')

  // La connexion ne prouve rien de l'isolation : un role SUPERUSER ou
  // BYPASSRLS repond « SELECT 1 » aussi bien qu'un role contraint, et rend
  // toutes les policies inertes sans le dire (ADR 002). C'est ici qu'on le
  // constate, parce que c'est le seul script lance sur chaque environnement.
  const privileges = await db.execute<{
    rolname: string
    rolsuper: boolean
    rolbypassrls: boolean
  }>(sql`
    select rolname, rolsuper, rolbypassrls
    from pg_roles
    where rolname = current_user
  `)

  assertApplicationRolePrivileges(privileges.rows[0])

  console.log('✅ Role applicatif soumis a la RLS')

  process.exit(0)
}

export default checkConnexion

try {
  await checkConnexion()
} catch (error) {
  console.error('❌ Connexion failed')
  console.error(error)
  process.exit(1)
}
