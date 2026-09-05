#!/usr/bin/env node
/* eslint-disable no-restricted-properties */

import {sql} from 'drizzle-orm'
import {drizzle} from 'drizzle-orm/node-postgres'
import pg from 'pg'

import initDotEnv from './env'

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
