/**
 * Restauration d'une sauvegarde de s12c (ADR 045). Acte humain, jamais
 * planifie, sous un superutilisateur PostgreSQL :
 *
 *     pnpm ops:restore -- <BACKUP_DIR/horodatage> \
 *       --target-url <url de la base cible> --target-storage <repertoire cible>
 *
 * Ordre : sommes de controle, cibles, base, puis fichiers. La base et le
 * repertoire cibles doivent etre **vides** : rien n'est jamais ecrase. La cible
 * n'a pas de valeur par defaut, et la base ou la racine des fichiers du
 * serveur (`DATABASE_URL`, `DATABASE_MIGRATION_URL`, `LOCAL_STORAGE_ROOT`) est
 * refusee sans `--replace-production` : c'est la forme non interactive du
 * garde-fou de l'ancien `db_restore.sh`.
 *
 * `pg_restore` conserve proprietaires et droits du dump (ni `--no-owner` ni
 * `--no-acl`) : `asl_app` retrouve ses acces et les policies RLS forcees
 * reviennent avec les tables.
 */
/* eslint-disable no-restricted-properties -- script d'exploitation : env.ts
   n'est pas charge, la configuration est lue ici. */
import {mkdir, readdir} from 'node:fs/promises'
import path from 'node:path'
import {pathToFileURL} from 'node:url'

import pg from 'pg'

import initDotEnv from '../../src/db/scripts/env'
import {BACKUP_FILES, pgToolConnection, run, verifyChecksums} from './backup'

export type RestoreOptions = {
  backup: string
  targetUrl: string
  targetStorage: string
  replaceProduction: boolean
}

/** Ce que le serveur sert : la cible ne peut l'etre que par decision. */
export type ServerTargets = {
  databaseUrls: string[]
  storageRoot: string | undefined
}

export type RestoreSteps = {
  verifyChecksums: (backup: string) => Promise<void>
  isDatabaseEmpty: (url: string) => Promise<boolean>
  isStorageEmpty: (dir: string) => Promise<boolean>
  restoreDatabase: (dump: string, url: string) => Promise<void>
  extractFiles: (archive: string, dir: string) => Promise<void>
}

export type RestoreResult = {exitCode: 0} | {exitCode: 1; reason: string}

const USAGE =
  'Usage : pnpm ops:restore -- <sauvegarde (chemin absolu)> --target-url <url> --target-storage <repertoire absolu> [--replace-production]'

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const LOCAL_HOSTS = new Set(['', 'localhost', '127.0.0.1', '[::1]', '::1'])

const databaseIdentity = (url: string) => {
  const parsed = new URL(url)
  const socketHost = parsed.searchParams.get('host') ?? ''
  const host =
    LOCAL_HOSTS.has(parsed.hostname) || socketHost.startsWith('/')
      ? 'local'
      : parsed.hostname
  return {
    host,
    port: parsed.port || '5432',
    database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
  }
}

/** Meme base : meme hote (local confondu), meme port, meme nom de base. */
export const sameDatabase = (left: string, right: string): boolean => {
  const a = databaseIdentity(left)
  const b = databaseIdentity(right)
  return a.host === b.host && a.port === b.port && a.database === b.database
}

const sameDirectory = (left: string, right: string) =>
  path.resolve(left) === path.resolve(right)

export const parseRestoreArgs = (argv: readonly string[]): RestoreOptions => {
  const args = argv.filter((arg) => arg !== '--')
  const positional: string[] = []
  const options: Partial<RestoreOptions> = {replaceProduction: false}

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === '--target-url') {
      options.targetUrl = args[++index]
    } else if (arg === '--target-storage') {
      options.targetStorage = args[++index]
    } else if (arg === '--replace-production') {
      options.replaceProduction = true
    } else if (arg.startsWith('--')) {
      throw new Error(`Option inconnue ${arg}. ${USAGE}`)
    } else {
      positional.push(arg)
    }
  }

  const [backup] = positional
  const {targetUrl, targetStorage} = options
  if (
    positional.length !== 1 ||
    !backup ||
    !targetUrl ||
    !targetStorage ||
    !path.isAbsolute(backup) ||
    !path.isAbsolute(targetStorage)
  ) {
    throw new Error(USAGE)
  }

  return {
    backup,
    targetUrl,
    targetStorage,
    replaceProduction: options.replaceProduction ?? false,
  }
}

/** Arguments de `pg_restore` : proprietaires et droits du dump conserves. */
export const pgRestoreArgs = (dump: string, dbname: string): string[] => [
  '--exit-on-error',
  '--single-transaction',
  `--dbname=${dbname}`,
  dump,
]

const productionRefusal = (
  options: RestoreOptions,
  server: ServerTargets
): string | undefined => {
  if (options.replaceProduction) return undefined

  if (server.databaseUrls.some((url) => sameDatabase(url, options.targetUrl))) {
    return 'La base cible est celle du serveur : relancer avec --replace-production pour la remplacer, sur une base videe au prealable.'
  }
  if (
    server.storageRoot &&
    sameDirectory(server.storageRoot, options.targetStorage)
  ) {
    return 'Le repertoire cible est LOCAL_STORAGE_ROOT : relancer avec --replace-production pour le remplacer, sur un repertoire vide.'
  }
  return undefined
}

const refuse = (reason: string): RestoreResult => {
  console.error(`[restore] ${reason}`)
  return {exitCode: 1, reason}
}

export const runRestore = async (
  options: RestoreOptions,
  server: ServerTargets,
  steps: RestoreSteps
): Promise<RestoreResult> => {
  try {
    console.log(`[restore] verification de ${options.backup}`)
    await steps.verifyChecksums(options.backup)
  } catch (error) {
    return refuse(`Sauvegarde invalide : ${errorMessage(error)}`)
  }

  const refusal = productionRefusal(options, server)
  if (refusal) return refuse(refusal)

  try {
    if (!(await steps.isDatabaseEmpty(options.targetUrl))) {
      return refuse('La base cible n’est pas vide : rien n’est ecrase.')
    }
    if (!(await steps.isStorageEmpty(options.targetStorage))) {
      return refuse('Le repertoire cible n’est pas vide : rien n’est ecrase.')
    }

    console.log('[restore] base')
    await steps.restoreDatabase(
      path.join(options.backup, BACKUP_FILES.database),
      options.targetUrl
    )
    console.log('[restore] fichiers')
    await steps.extractFiles(
      path.join(options.backup, BACKUP_FILES.files),
      options.targetStorage
    )
  } catch (error) {
    return refuse(`Restauration en echec : ${errorMessage(error)}`)
  }

  console.log('[restore] Restauration terminee')
  return {exitCode: 0}
}

// ===== Etapes reelles =====

const countUserRelations = async (url: string) => {
  const client = new pg.Client({connectionString: url})
  await client.connect()
  try {
    const result = await client.query<{count: string}>(`
      select count(*) as count
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname not in ('pg_catalog', 'information_schema')
        and n.nspname not like 'pg_toast%'
        and n.nspname not like 'pg_temp%'
    `)
    return Number(result.rows[0].count)
  } finally {
    await client.end()
  }
}

const isDirectoryEmpty = async (dir: string) => {
  try {
    return (await readdir(dir)).length === 0
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true
    throw error
  }
}

export const serverRestoreSteps = (): RestoreSteps => ({
  verifyChecksums,
  isDatabaseEmpty: async (url) => (await countUserRelations(url)) === 0,
  isStorageEmpty: isDirectoryEmpty,
  restoreDatabase: (dump, url) => {
    const target = pgToolConnection(url)
    return run('pg_restore', pgRestoreArgs(dump, target.dbname), target.env)
  },
  extractFiles: async (archive, dir) => {
    await mkdir(dir, {recursive: true, mode: 0o750})
    await run('tar', [
      '--extract',
      '--gzip',
      `--file=${archive}`,
      `--directory=${dir}`,
    ])
  },
})

const serverTargets = (): ServerTargets => ({
  databaseUrls: [
    process.env.DATABASE_URL,
    process.env.DATABASE_MIGRATION_URL,
  ].filter((url): url is string => !!url),
  storageRoot: process.env.LOCAL_STORAGE_ROOT
    ? path.resolve(process.env.LOCAL_STORAGE_ROOT)
    : undefined,
})

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  Promise.resolve()
    .then(() => {
      initDotEnv()
      const options = parseRestoreArgs(process.argv.slice(2))
      return runRestore(options, serverTargets(), serverRestoreSteps())
    })
    .then((result) => process.exit(result.exitCode))
    .catch((error) => {
      console.error('[restore] Echec inattendu', errorMessage(error))
      process.exit(1)
    })
}
