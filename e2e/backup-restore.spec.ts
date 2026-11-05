/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import {spawn} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import type {AddressInfo} from 'node:net'
import os from 'node:os'
import path from 'node:path'

import {expect, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

import {
  FILE_KEY_COLUMNS,
  FILE_KEY_JSON_PATHS,
  fileKeysAtPath,
} from '../src/lib/files/file-key-inventory'

/**
 * Sauvegarde et restauration — s12c, critères 1, 2, 3 et 8 (ADR 045).
 *
 * Le seul niveau où `pg_dump` et `pg_restore` tournent contre une vraie base
 * sous RLS forcée : `db.ts` refuse toute connexion en test unitaire (ADR 002).
 * La spec n'ouvre aucun navigateur. Elle lance les vrais scripts
 * (`scripts/ops/backup.ts`, `scripts/ops/restore.ts`) comme le ferait la
 * minuterie, puis compare la base restaurée à l'originale, association par
 * association, et vérifie chaque clé de l'inventaire contre le répertoire de
 * fichiers restauré.
 *
 * Le second cas garde le piège n°1 : sous le rôle applicatif, `pg_dump` ne
 * sauvegarde aucune ligne métier. Sans `asl_backup`, la sauvegarde
 * « réussirait » vide.
 */

const ROOT = process.cwd()
const TSX = path.join(ROOT, 'node_modules/.bin/tsx')
const SCRIPT_TIMEOUT_MS = 180_000

const testEnv = (): Record<string, string> => {
  const testEnvPath = path.resolve(ROOT, '.env.test')
  return fs.existsSync(testEnvPath)
    ? dotenv.parse(fs.readFileSync(testEnvPath))
    : {}
}

const required = (name: string): string => {
  const value = process.env[name] ?? testEnv()[name]
  if (!value) {
    throw new Error(`${name} introuvable : la spec attaque la base en direct.`)
  }
  return value
}

const appUrl = () => required('DATABASE_URL')
/** Rôle propriétaire ou superuser : crée et supprime la base restaurée. */
const adminUrl = () => required('DATABASE_MIGRATION_URL')
const backupUrl = () => required('BACKUP_DATABASE_URL')
const storageRoot = () => path.resolve(ROOT, required('LOCAL_STORAGE_ROOT'))

const withDatabase = (url: string, database: string) => {
  const parsed = new URL(url)
  parsed.pathname = `/${database}`
  return parsed.toString()
}

const withClient = async <T>(
  url: string,
  callback: (client: Client) => Promise<T>
): Promise<T> => {
  const client = new Client({connectionString: url})
  await client.connect()
  try {
    return await callback(client)
  } finally {
    await client.end()
  }
}

/** Une transaction sous un réglage de session de la policy (ADR 002). */
const inScope = async <T>(
  client: Client,
  setting: {name: 'app.bypass_rls' | 'app.organization_id'; value: string},
  callback: () => Promise<T>
): Promise<T> => {
  await client.query('begin')
  try {
    await client.query(`select set_config($1, $2, true)`, [
      setting.name,
      setting.value,
    ])
    const result = await callback()
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  }
}

const BYPASS = {name: 'app.bypass_rls', value: 'on'} as const
const tenantScope = (organizationId: string) =>
  ({name: 'app.organization_id', value: organizationId}) as const

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`

const tenantIds = async (client: Client) => {
  const result = await client.query<{slug: string; id: string}>(
    `select slug, id from organization where slug in ('techcorp-solutions', 'marketing-pro')`
  )
  const bySlug = new Map(result.rows.map((row) => [row.slug, row.id]))
  const a = bySlug.get('techcorp-solutions')
  const b = bySlug.get('marketing-pro')
  expect(a, 'le seed doit porter les deux associations').toBeTruthy()
  expect(b, 'le seed doit porter les deux associations').toBeTruthy()
  return [a as string, b as string]
}

/** Les tables métier : celles que la RLS forcée protège. */
const forcedTables = async (client: Client): Promise<string[]> => {
  const result = await client.query<{relname: string}>(
    `select c.relname from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relforcerowsecurity
      order by c.relname`
  )
  return result.rows.map((row) => row.relname)
}

const allTables = async (client: Client): Promise<string[]> => {
  const result = await client.query<{name: string}>(
    `select tablename as name from pg_tables
      where schemaname = 'public' order by 1`
  )
  return result.rows.map((row) => row.name)
}

const countRows = async (client: Client, table: string) => {
  const result = await client.query<{count: string}>(
    `select count(*) as count from public.${quoteIdent(table)}`
  )
  return Number(result.rows[0].count)
}

/** Le journal des migrations, hors de portée du rôle applicatif. */
const appliedMigrations = (url: string) =>
  withClient(url, async (client) => {
    const result = await client.query<{hash: string}>(
      `select hash from drizzle.__drizzle_migrations order by created_at`
    )
    return result.rows.map((row) => row.hash)
  })

type Snapshot = {
  forced: string[]
  totals: Record<string, number>
  perTenant: Record<string, Record<string, number>>
}

/**
 * Photo comparable d'une base : le nombre de lignes de chaque table (sous
 * `bypass`) et, pour chaque association, de chaque table métier vue **sous
 * sa policy**, avec le rôle applicatif.
 */
const snapshot = async (url: string, tenants: string[]): Promise<Snapshot> =>
  withClient(url, async (client) => {
    const forced = await forcedTables(client)
    const totals = await inScope(client, BYPASS, async () => {
      const entries: [string, number][] = []
      for (const table of await allTables(client)) {
        entries.push([table, await countRows(client, table)])
      }
      return Object.fromEntries(entries)
    })

    const perTenant: Record<string, Record<string, number>> = {}
    for (const tenant of tenants) {
      perTenant[tenant] = await inScope(
        client,
        tenantScope(tenant),
        async () => {
          const entries: [string, number][] = []
          for (const table of forced) {
            entries.push([table, await countRows(client, table)])
          }
          return Object.fromEntries(entries)
        }
      )
    }
    return {forced, totals, perTenant}
  })

/** Toutes les clés de fichier référencées en base, selon l'inventaire. */
const referencedKeys = async (url: string) =>
  withClient(url, (client) =>
    inScope(client, BYPASS, async () => {
      const keys: {family: string; key: string}[] = []
      for (const {table, column} of FILE_KEY_COLUMNS) {
        const result = await client.query<{key: string}>(
          `select ${quoteIdent(column)} as key from ${quoteIdent(table)}
            where ${quoteIdent(column)} is not null`
        )
        keys.push(
          ...result.rows.map((row) => ({
            family: `${table}.${column}`,
            key: row.key,
          }))
        )
      }
      for (const entry of FILE_KEY_JSON_PATHS) {
        const result = await client.query<{data: unknown}>(
          `select ${quoteIdent(entry.column)} as data from ${quoteIdent(entry.table)}
            where ${quoteIdent(entry.typeColumn)} = $1`,
          [entry.blockType]
        )
        for (const row of result.rows) {
          keys.push(
            ...fileKeysAtPath(row.data, entry.path).map((key) => ({
              family: `${entry.table}.${entry.column}:${entry.blockType}:${entry.path}`,
              key,
            }))
          )
        }
      }
      return keys
    })
  )

type Fixture = {
  organizationKeys: {id: string; logo: string | null; favicon: string | null}[]
  pageIds: string[]
  newsIds: string[]
  boardIds: string[]
  waterIds: string[]
  files: string[]
}

const writeStoredFile = (key: string) => {
  const target = path.join(storageRoot(), key)
  fs.mkdirSync(path.dirname(target), {recursive: true})
  fs.writeFileSync(target, `s12c ${key}\n`)
  return key
}

/**
 * Un fichier par famille de l'inventaire, pour chacune des deux associations.
 * Les valeurs d'identité d'origine sont gardées pour être remises après le
 * test : les specs suivantes lisent le logo du seed.
 */
const seedFixture = async (tenants: string[]): Promise<Fixture> =>
  withClient(appUrl(), (client) =>
    inScope(client, BYPASS, async () => {
      const fixture: Fixture = {
        organizationKeys: [],
        pageIds: [],
        newsIds: [],
        boardIds: [],
        waterIds: [],
        files: [],
      }
      const run = randomUUID().slice(0, 8)

      for (const tenant of tenants) {
        const file = (name: string) => {
          const key = writeStoredFile(
            `${tenant}/s12c-${run}/${randomUUID()}-${name}`
          )
          fixture.files.push(key)
          return key
        }

        const original = await client.query<{
          identity_logo_key: string | null
          identity_favicon_key: string | null
        }>(
          `select identity_logo_key, identity_favicon_key from organization where id = $1`,
          [tenant]
        )
        fixture.organizationKeys.push({
          id: tenant,
          logo: original.rows[0].identity_logo_key,
          favicon: original.rows[0].identity_favicon_key,
        })
        await client.query(
          `update organization set identity_logo_key = $2, identity_favicon_key = $3 where id = $1`,
          [tenant, file('logo.png'), file('favicon.png')]
        )

        const pageRow = await client.query<{id: string}>(
          `insert into page (organization_id, slug, title, share_image_key)
           values ($1, $2, 'Sauvegarde s12c', $3) returning id`,
          [tenant, `s12c-${run}`, file('share.png')]
        )
        const pageId = pageRow.rows[0].id
        fixture.pageIds.push(pageId)
        await client.query(
          `insert into content_block (page_id, type, rank, data) values
             ($1, 'image', 0, $2::jsonb),
             ($1, 'pdf', 1, $3::jsonb),
             ($1, 'gallery', 2, $4::jsonb)`,
          [
            pageId,
            JSON.stringify({fileKey: file('bloc.png'), alt: 'Bloc'}),
            JSON.stringify({fileKey: file('bloc.pdf'), title: 'Document'}),
            JSON.stringify({
              images: [
                {fileKey: file('galerie-1.png'), alt: 'Un'},
                {fileKey: file('galerie-2.png'), alt: 'Deux'},
              ],
            }),
          ]
        )

        const newsRow = await client.query<{id: string}>(
          `insert into news (organization_id, title, published_on, image_key)
           values ($1, 'Sauvegarde s12c', current_date, $2) returning id`,
          [tenant, file('actualite.png')]
        )
        fixture.newsIds.push(newsRow.rows[0].id)

        const boardRow = await client.query<{id: string}>(
          `insert into board_member (organization_id, name, role_label, photo_key, rank)
           values ($1, $2, 'Trésorerie', $3, 9999) returning id`,
          [tenant, `Sauvegarde s12c ${run}`, file('photo.webp')]
        )
        fixture.boardIds.push(boardRow.rows[0].id)

        const waterRow = await client.query<{id: string}>(
          `insert into water_analysis (organization_id, sampled_on, poster_key, report_key, report_bytes)
           values ($1, '1999-01-01', $2, $3, 10) returning id`,
          [tenant, file('affiche.png'), file('rapport.pdf')]
        )
        fixture.waterIds.push(waterRow.rows[0].id)
      }

      return fixture
    })
  )

const removeFixture = async (fixture: Fixture) => {
  await withClient(appUrl(), (client) =>
    inScope(client, BYPASS, async () => {
      for (const {id, logo, favicon} of fixture.organizationKeys) {
        await client.query(
          `update organization set identity_logo_key = $2, identity_favicon_key = $3 where id = $1`,
          [id, logo, favicon]
        )
      }
      await client.query(`delete from page where id = any($1::uuid[])`, [
        fixture.pageIds,
      ])
      await client.query(`delete from news where id = any($1::uuid[])`, [
        fixture.newsIds,
      ])
      await client.query(
        `delete from board_member where id = any($1::uuid[])`,
        [fixture.boardIds]
      )
      await client.query(
        `delete from water_analysis where id = any($1::uuid[])`,
        [fixture.waterIds]
      )
    })
  )
  for (const key of fixture.files) {
    fs.rmSync(path.join(storageRoot(), key), {force: true})
  }
}

/** Faux service de signal de vie : retient les chemins appelés. */
const startHealthcheck = async () => {
  const calls: string[] = []
  const server = http.createServer((request, response) => {
    calls.push(request.url ?? '')
    request.resume()
    response.writeHead(200).end('OK')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const {port} = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}/ping/s12c`,
    calls,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

type RunResult = {status: number | null; stdout: string; stderr: string}

/**
 * Lance un processus sans bloquer la boucle d’événements : le faux service de
 * signal de vie vit dans ce même processus et doit pouvoir répondre pendant que
 * le script tourne (spawnSync le figeait, et le ping expirait).
 */
const run = (
  command: string,
  args: string[],
  options: {env?: Record<string, string>; cwd?: string; timeout?: number}
) =>
  new Promise<RunResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: {...process.env, ...options.env},
      timeout: options.timeout,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (chunk) => (stdout += chunk))
    child.stderr.setEncoding('utf8').on('data', (chunk) => (stderr += chunk))
    child.on('error', reject)
    child.on('close', (status) => resolve({status, stdout, stderr}))
  })

const runScript = (
  script: string,
  args: string[],
  env: Record<string, string>
) => run(TSX, [script, ...args], {cwd: ROOT, env, timeout: SCRIPT_TIMEOUT_MS})

/** Mot de passe hors de la ligne de commande, comme le font les scripts. */
const pgToolArgs = (url: string) => {
  const parsed = new URL(url)
  const password = decodeURIComponent(parsed.password)
  parsed.password = ''
  return {dbname: parsed.toString(), env: {PGPASSWORD: password}}
}

test.describe('s12c — sauvegarder puis restaurer toutes les associations', () => {
  test.describe.configure({mode: 'serial', timeout: 600_000})

  const restoredDatabase = `s12c_restore_${randomUUID().slice(0, 8)}`
  let workDir = ''
  let backupDir = ''
  let restoredStorage = ''
  let fixture: Fixture | undefined

  test.beforeAll(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 's12c-'))
    backupDir = path.join(workDir, 'backups')
    restoredStorage = path.join(workDir, 'storage-restauree')
  })

  test.afterAll(async () => {
    if (fixture) await removeFixture(fixture)
    await withClient(adminUrl(), (client) =>
      client.query(`drop database if exists ${quoteIdent(restoredDatabase)}`)
    )
    fs.rmSync(workDir, {recursive: true, force: true})
  })

  test('une sauvegarde restaurée à vide rend chaque association, ses droits et ses fichiers', async () => {
    const tenants = await withClient(appUrl(), tenantIds)
    fixture = await seedFixture(tenants)

    // Chaque famille de l'inventaire porte au moins une clé chez chacune des
    // deux associations : une famille vide prouverait le critère 3 à vide.
    const sourceKeys = await referencedKeys(appUrl())
    const families = [
      ...FILE_KEY_COLUMNS.map(({table, column}) => `${table}.${column}`),
      ...FILE_KEY_JSON_PATHS.map(
        (entry) =>
          `${entry.table}.${entry.column}:${entry.blockType}:${entry.path}`
      ),
    ]
    for (const family of families) {
      for (const tenant of tenants) {
        expect(
          sourceKeys.some(
            (entry) => entry.family === family && entry.key.startsWith(tenant)
          ),
          `aucune clé ${family} pour ${tenant}`
        ).toBe(true)
      }
    }

    const before = await snapshot(appUrl(), tenants)
    expect(before.forced.length).toBeGreaterThan(0)

    // Critère 1 : la sauvegarde réelle, comme la lance la minuterie.
    const healthcheck = await startHealthcheck()
    const backup = await runScript('scripts/ops/backup.ts', [], {
      BACKUP_DIR: backupDir,
      BACKUP_DATABASE_URL: backupUrl(),
      BACKUP_HEALTHCHECK_URL: healthcheck.url,
      LOCAL_STORAGE_ROOT: storageRoot(),
    })
    await healthcheck.close()
    expect(backup.status, `${backup.stdout}\n${backup.stderr}`).toBe(0)
    expect(healthcheck.calls).toEqual(['/ping/s12c'])

    const backups = fs
      .readdirSync(backupDir)
      .filter((name) => !name.startsWith('.'))
    expect(backups).toHaveLength(1)
    const published = path.join(backupDir, backups[0])
    expect(fs.readdirSync(published).sort()).toEqual([
      'SHA256SUMS',
      'database.dump',
      'files.tar.gz',
    ])

    // Restauration sur une base et un répertoire vides.
    await withClient(adminUrl(), (client) =>
      client.query(`create database ${quoteIdent(restoredDatabase)}`)
    )
    const restore = await runScript(
      'scripts/ops/restore.ts',
      [
        '--',
        published,
        '--target-url',
        withDatabase(adminUrl(), restoredDatabase),
        '--target-storage',
        restoredStorage,
      ],
      {}
    )
    expect(restore.status, `${restore.stdout}\n${restore.stderr}`).toBe(0)

    // Critère 2 : mêmes lignes, table par table et association par
    // association, lues sous `asl_app` : droits et policies ont survécu.
    const restoredAppUrl = withDatabase(appUrl(), restoredDatabase)
    const after = await snapshot(restoredAppUrl, tenants)
    expect(after.forced).toEqual(before.forced)
    expect(after.totals).toEqual(before.totals)
    expect(after.perTenant).toEqual(before.perTenant)
    // Le journal de drizzle revient aussi : la base restaurée n'est pas
    // re-migrée depuis zéro au prochain déploiement.
    expect(
      await appliedMigrations(withDatabase(adminUrl(), restoredDatabase))
    ).toEqual(await appliedMigrations(adminUrl()))

    // L'isolation est restaurée, pas seulement les lignes : sous le scope de
    // A, aucune ligne de B n'est visible.
    const [tenantA, tenantB] = tenants
    const leaked = await withClient(restoredAppUrl, (client) =>
      inScope(client, tenantScope(tenantA), async () => {
        const result = await client.query<{count: string}>(
          `select count(*) as count from news where organization_id = $1`,
          [tenantB]
        )
        return Number(result.rows[0].count)
      })
    )
    expect(leaked).toBe(0)
    expect(after.perTenant[tenantA].news).toBeGreaterThan(0)

    // Critère 3 : toute clé de l'inventaire désigne un fichier restauré.
    const restoredKeys = await referencedKeys(restoredAppUrl)
    expect(restoredKeys.length).toBe(sourceKeys.length)
    const missing = restoredKeys.filter(
      ({key}) => !fs.existsSync(path.join(restoredStorage, key))
    )
    expect(missing).toEqual([])
  })

  test('sous le rôle applicatif, pg_dump ne sauvegarde aucune ligne métier', async () => {
    const forced = await withClient(appUrl(), forcedTables)
    const {dbname, env} = pgToolArgs(appUrl())
    const dumpFile = path.join(workDir, 'asl-app.dump')

    // Par défaut, pg_dump désactive la RLS et échoue sur la première table
    // protégée : le rôle applicatif ne la contourne pas.
    const refused = await run(
      'pg_dump',
      ['--format=custom', '--schema=public', `--file=${dumpFile}`, dbname],
      {env}
    )
    expect(refused.status).not.toBe(0)
    expect(refused.stderr).toMatch(/row-level security/i)

    // Avec la RLS active, il « réussit »... sans aucune ligne métier.
    const filtered = await run(
      'pg_dump',
      [
        '--format=plain',
        '--data-only',
        '--schema=public',
        '--enable-row-security',
        `--file=${dumpFile}`,
        dbname,
      ],
      {env}
    )
    expect(filtered.status, filtered.stderr).toBe(0)
    const script = fs.readFileSync(dumpFile, 'utf8')
    for (const table of forced) {
      const block = new RegExp(
        `COPY public\\.${quoteIdent(table).replace(/"/g, '"?')} \\([^)]*\\) FROM stdin;\\n([\\s\\S]*?)\\\\\\.\\n`
      ).exec(script)
      // pg_dump émet un bloc COPY même pour une table vide : un bloc absent
      // ferait passer le test à vide.
      expect(block, `bloc COPY de ${table} absent du dump`).not.toBeNull()
      expect(block?.[1], `lignes de ${table} sous asl_app`).toBe('')
    }
  })
})
