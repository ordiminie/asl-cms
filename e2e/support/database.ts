/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import path from 'node:path'

import {expect} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * L'accès direct à la base des specs e2e, sur le patron de
 * `member-invitations.spec.ts` : rôle applicatif soumis à la RLS forcée, une
 * transaction par appel, le scope posé par `set_config` comme le produit.
 */

/** Le jour de Paris, côté SQL, celui des compteurs du budget (s52). */
export const PARIS_DAY_SQL = `(now() at time zone 'Europe/Paris')::date`

export const databaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const testEnvPath = path.resolve(process.cwd(), '.env.test')
  const parsed = fs.existsSync(testEnvPath)
    ? dotenv.parse(fs.readFileSync(testEnvPath))
    : {}
  if (!parsed.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL introuvable : les preuves SQL attaquent la base en direct.'
    )
  }
  return parsed.DATABASE_URL
}

/** Une connexion sous le rôle applicatif, soumis à la RLS forcée. */
export const withClient = async <T>(
  callback: (client: Client) => Promise<T>
): Promise<T> => {
  const client = new Client({connectionString: databaseUrl()})
  await client.connect()
  try {
    return await callback(client)
  } finally {
    await client.end()
  }
}

const inTransaction = async <T>(
  setting: [string, string],
  callback: (client: Client) => Promise<T>
): Promise<T> =>
  withClient(async (client) => {
    await client.query('begin')
    try {
      await client.query(`select set_config($1, $2, true)`, setting)
      const result = await callback(client)
      await client.query('commit')
      return result
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  })

export const tenantIdOf = (slug: string) =>
  withClient(async (client) => {
    const result = await client.query<{id: string}>(
      `select id from organization where slug = $1`,
      [slug]
    )
    expect(result.rows[0], `le seed doit porter ${slug}`).toBeTruthy()
    return result.rows[0].id
  })

/** Sous le scope d'une association, comme le produit. */
export const inTenant = async <T>(
  slug: string,
  callback: (client: Client, organizationId: string) => Promise<T>
) => {
  const organizationId = await tenantIdOf(slug)
  return inTransaction(['app.organization_id', organizationId], (client) =>
    callback(client, organizationId)
  )
}

/** Nettoyage hors scope : le seul `bypass` d'une spec. */
export const asMaintenance = <T>(callback: (client: Client) => Promise<T>) =>
  inTransaction(['app.bypass_rls', 'on'], callback)
