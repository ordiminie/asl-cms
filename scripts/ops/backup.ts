/**
 * Sauvegarde de la base et des fichiers de toutes les associations (s12c,
 * ADR 045). Lancee tous les deux jours par `asl-cms-backup.timer`, sans
 * intervention humaine :
 *
 *     pnpm ops:backup
 *
 * Une sauvegarde est un repertoire `BACKUP_DIR/<horodatage>/` qui contient
 * `database.dump` (pg_dump, format custom), `files.tar.gz` (LOCAL_STORAGE_ROOT)
 * et `SHA256SUMS`. Il est construit dans `BACKUP_DIR/.tmp-<horodatage>/`,
 * verifie, puis renomme : une archive partielle n'a jamais le nom d'une
 * sauvegarde (critere 8). La base passe avant les fichiers : un fichier en
 * trop est inoffensif, une cle sans fichier ne l'est pas.
 *
 * La purge de retention ne passe qu'apres une sauvegarde reussie, et garde
 * toujours la plus recente. Le signal de vie (`BACKUP_HEALTHCHECK_URL`) part en
 * dernier ; un echec appelle son `/fail`. C'est son silence qui alerte, que la
 * sauvegarde ait echoue ou ne se soit pas lancee (critere 9).
 *
 * `pg_dump` tourne sous `asl_backup` (`BACKUP_DATABASE_URL`) : BYPASSRLS,
 * sinon la RLS forcee rendrait une sauvegarde sans ligne metier. Le role est
 * verifie avant chaque sauvegarde.
 */
/* eslint-disable no-restricted-properties -- script d'exploitation : env.ts
   n'est pas charge, la configuration est lue et validee ici. */
import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
import {createReadStream} from 'node:fs'
import {mkdir, readdir, readFile, rename, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {pathToFileURL} from 'node:url'

import pg from 'pg'

import initDotEnv from '../../src/db/scripts/env'
import {assertBackupRolePrivileges} from '../../src/db/scripts/role-privileges'

export const BACKUP_FILES = {
  database: 'database.dump',
  files: 'files.tar.gz',
  checksums: 'SHA256SUMS',
} as const

export const DEFAULT_RETENTION_DAYS = 15

const TEMPORARY_PREFIX = '.tmp-'
const BACKUP_NAME_PATTERN = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/
const DAY_MS = 24 * 60 * 60 * 1000
const SIGNAL_TIMEOUT_MS = 10_000

export type BackupConfig = {
  backupDir: string
  storageRoot: string
  databaseUrl: string
  healthcheckUrl: string
  retentionDays: number
}

export type BackupSteps = {
  checkRole: () => Promise<void>
  makeDirectory: (dir: string) => Promise<void>
  dumpDatabase: (file: string) => Promise<void>
  archiveFiles: (file: string) => Promise<void>
  writeChecksums: (dir: string) => Promise<void>
  verify: (dir: string) => Promise<void>
  /** Renommage atomique du repertoire temporaire vers son nom final. */
  publish: (from: string, to: string) => Promise<void>
  /** Noms des entrees de `BACKUP_DIR`. */
  list: () => Promise<string[]>
  remove: (target: string) => Promise<void>
  signal: (outcome: 'success' | 'fail', message?: string) => Promise<void>
}

export type BackupResult =
  | {exitCode: 0; backup: string; purged: string[]}
  | {exitCode: 1; failedStep: string}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

/** Horodatage UTC sans separateur : `20261105T031230Z`. */
export const backupName = (date: Date): string =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')

const backupDate = (name: string): Date | undefined => {
  const match = BACKUP_NAME_PATTERN.exec(name)
  if (!match) return undefined
  const [, year, month, day, hour, minute, second] = match.map(Number)
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second))
}

/**
 * Les entrees a supprimer : sauvegardes plus anciennes que la retention, sauf
 * la plus recente (un serveur reste a l'arret plus de 15 jours ne doit pas
 * se retrouver sans aucune sauvegarde), et repertoires temporaires laisses par
 * une sauvegarde interrompue. Rien d'autre n'est touche.
 */
export const backupsToPurge = (
  names: readonly string[],
  now: Date,
  retentionDays: number
): string[] => {
  const cutoff = now.getTime() - retentionDays * DAY_MS
  const backups = names
    .map((name) => ({name, date: backupDate(name)}))
    .filter((entry): entry is {name: string; date: Date} => !!entry.date)
    .sort((left, right) => right.date.getTime() - left.date.getTime())

  const expired = backups
    .slice(1)
    .filter(({date}) => date.getTime() < cutoff)
    .map(({name}) => name)
  const temporaries = names.filter((name) => name.startsWith(TEMPORARY_PREFIX))

  return [...temporaries, ...expired].sort()
}

const purge = async (
  config: BackupConfig,
  steps: BackupSteps,
  now: Date
): Promise<string[]> => {
  const purged = backupsToPurge(await steps.list(), now, config.retentionDays)
  for (const name of purged) {
    await steps.remove(path.join(config.backupDir, name))
  }
  return purged
}

const BUILD_STEPS = [
  'checkRole',
  'makeDirectory',
  'dumpDatabase',
  'archiveFiles',
  'writeChecksums',
  'verify',
  'publish',
] as const

const runBuildStep = (
  name: (typeof BUILD_STEPS)[number],
  steps: BackupSteps,
  temporary: string,
  final: string
) => {
  switch (name) {
    case 'checkRole':
      return steps.checkRole()
    case 'makeDirectory':
      return steps.makeDirectory(temporary)
    case 'dumpDatabase':
      return steps.dumpDatabase(path.join(temporary, BACKUP_FILES.database))
    case 'archiveFiles':
      return steps.archiveFiles(path.join(temporary, BACKUP_FILES.files))
    case 'writeChecksums':
      return steps.writeChecksums(temporary)
    case 'verify':
      return steps.verify(temporary)
    case 'publish':
      return steps.publish(temporary, final)
  }
}

const fail = async (
  steps: BackupSteps,
  failedStep: string,
  error: unknown
): Promise<BackupResult> => {
  const message = `${failedStep} en echec : ${errorMessage(error)}`
  console.error(`[backup] ${message}`)
  try {
    await steps.signal('fail', message)
  } catch (signalError) {
    console.error(
      `[backup] signal /fail en echec : ${errorMessage(signalError)}`
    )
  }
  return {exitCode: 1, failedStep}
}

export const runBackup = async (
  config: BackupConfig,
  steps: BackupSteps,
  now: Date
): Promise<BackupResult> => {
  const name = backupName(now)
  const temporary = path.join(config.backupDir, `${TEMPORARY_PREFIX}${name}`)
  const final = path.join(config.backupDir, name)

  for (const step of BUILD_STEPS) {
    try {
      console.log(`[backup] ${step}`)
      await runBuildStep(step, steps, temporary, final)
    } catch (error) {
      await steps.remove(temporary).catch((removeError: unknown) => {
        console.error(
          `[backup] ${temporary} non supprime : ${errorMessage(removeError)}`
        )
      })
      return fail(steps, step, error)
    }
  }

  let purged: string[]
  try {
    purged = await purge(config, steps, now)
  } catch (error) {
    return fail(steps, 'purge', error)
  }

  try {
    await steps.signal('success')
  } catch (error) {
    console.error(`[backup] signal de vie en echec : ${errorMessage(error)}`)
    return {exitCode: 1, failedStep: 'signal'}
  }

  console.log(`[backup] Sauvegarde publiee : ${final}`)
  return {exitCode: 0, backup: final, purged}
}

// ===== Configuration =====

const isInside = (child: string, parent: string) => {
  const relative = path.relative(parent, child)
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  )
}

const requiredValue = (
  env: Record<string, string | undefined>,
  key: string
): string => {
  const value = env[key]?.trim()
  if (!value) {
    throw new Error(`${key} manquante : la sauvegarde refuse de tourner.`)
  }
  return value
}

const retentionFrom = (value: string | undefined): number => {
  if (value === undefined || value.trim() === '') return DEFAULT_RETENTION_DAYS
  if (!/^\d+$/.test(value.trim()) || Number(value) < 1) {
    throw new Error(
      `BACKUP_RETENTION_DAYS doit etre un nombre entier de jours, au moins 1 (recu : ${value}).`
    )
  }
  return Number(value)
}

/**
 * La configuration, lue de l'environnement et validee. `BACKUP_DIR` est un
 * chemin absolu, distinct de la racine des fichiers et du repertoire deploye
 * (critere 6) : une sauvegarde dans `LOCAL_STORAGE_ROOT` s'archiverait
 * elle-meme, une sauvegarde dans une version disparaitrait avec elle.
 */
export const backupConfigFrom = (
  env: Record<string, string | undefined>,
  cwd: string
): BackupConfig => {
  const backupDir = requiredValue(env, 'BACKUP_DIR')
  const databaseUrl = requiredValue(env, 'BACKUP_DATABASE_URL')
  const healthcheckUrl = requiredValue(env, 'BACKUP_HEALTHCHECK_URL')
  const storageRoot = path.resolve(
    cwd,
    requiredValue(env, 'LOCAL_STORAGE_ROOT')
  )

  if (!path.isAbsolute(backupDir)) {
    throw new Error(
      `BACKUP_DIR doit etre un chemin absolu (recu : ${backupDir}).`
    )
  }
  const resolved = path.resolve(backupDir)
  if (isInside(resolved, storageRoot) || isInside(storageRoot, resolved)) {
    throw new Error(
      'BACKUP_DIR doit etre distinct de LOCAL_STORAGE_ROOT, ni dedans ni au-dessus.'
    )
  }
  if (isInside(resolved, cwd)) {
    throw new Error(
      'BACKUP_DIR ne doit pas etre dans le repertoire deploye : il disparaitrait avec la version.'
    )
  }

  return {
    backupDir: resolved,
    storageRoot,
    databaseUrl,
    healthcheckUrl,
    retentionDays: retentionFrom(env.BACKUP_RETENTION_DAYS),
  }
}

// ===== Sommes de controle =====

/** Format de `sha256sum` : `<somme>  <nom>`, une ligne par fichier. */
export const formatChecksums = (sums: Record<string, string>): string =>
  Object.entries(sums)
    .map(([name, sum]) => `${sum}  ${name}\n`)
    .join('')

export const parseChecksums = (text: string): Record<string, string> =>
  Object.fromEntries(
    text
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => {
        const match = /^([0-9a-f]{64}) {2}(\S.*)$/.exec(line)
        if (!match) {
          throw new Error(`Ligne de SHA256SUMS illisible : ${line}`)
        }
        return [match[2], match[1]]
      })
  )

export const sha256Of = (file: string) =>
  new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(file)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
  })

/** Recalcule chaque somme de `SHA256SUMS` ; leve au premier ecart. */
export const verifyChecksums = async (dir: string) => {
  const expected = parseChecksums(
    await readFile(path.join(dir, BACKUP_FILES.checksums), 'utf8')
  )
  for (const name of [BACKUP_FILES.database, BACKUP_FILES.files]) {
    if (!expected[name]) {
      throw new Error(`${name} absent de SHA256SUMS`)
    }
    const actual = await sha256Of(path.join(dir, name))
    if (actual !== expected[name]) {
      throw new Error(`Somme de controle de ${name} incorrecte`)
    }
  }
}

// ===== Etapes reelles, sur le serveur =====

/**
 * Le mot de passe passe par `PGPASSWORD`, jamais par la ligne de commande :
 * elle est lisible par tous les utilisateurs du serveur (`ps`).
 */
export const pgToolConnection = (url: string) => {
  const parsed = new URL(url)
  const password = decodeURIComponent(parsed.password)
  parsed.password = ''
  return {
    dbname: parsed.toString(),
    env: (password ? {PGPASSWORD: password} : {}) as Record<string, string>,
  }
}

export const run = (
  command: string,
  args: string[],
  env: Record<string, string> = {}
) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'inherit', 'inherit'],
      env: {...process.env, ...env},
    })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} ${args[0] ?? ''} : sortie ${code}`))
    )
  })

const checkBackupRole = async (url: string) => {
  const client = new pg.Client({connectionString: url})
  await client.connect()
  try {
    const result = await client.query<{
      rolname: string
      rolsuper: boolean
      rolbypassrls: boolean
      owned_objects: string
    }>(`
      select r.rolname, r.rolsuper, r.rolbypassrls,
        (select count(*) from pg_class where relowner = r.oid)
          + (select count(*) from pg_namespace where nspowner = r.oid)
          + (select count(*) from pg_database where datdba = r.oid)
          as owned_objects
      from pg_roles r
      where r.rolname = current_user
    `)
    const row = result.rows[0]
    assertBackupRolePrivileges(
      row && {
        rolname: row.rolname,
        rolsuper: row.rolsuper,
        rolbypassrls: row.rolbypassrls,
        ownedObjects: Number(row.owned_objects),
      }
    )
  } finally {
    await client.end()
  }
}

const writeChecksumsFile = async (dir: string) => {
  const sums: Record<string, string> = {}
  for (const name of [BACKUP_FILES.database, BACKUP_FILES.files]) {
    sums[name] = await sha256Of(path.join(dir, name))
  }
  await writeFile(
    path.join(dir, BACKUP_FILES.checksums),
    formatChecksums(sums),
    {mode: 0o640}
  )
}

/** Sommes de controle, puis relecture du dump et de l'archive. */
const verifyBackup = async (dir: string) => {
  await verifyChecksums(dir)
  await run('pg_restore', ['--list', path.join(dir, BACKUP_FILES.database)], {})
  await run('tar', [
    '--list',
    '--gzip',
    '--file',
    path.join(dir, BACKUP_FILES.files),
  ])
}

/** Healthchecks.io : l'URL seule signale la reussite, `/fail` l'echec. */
export const signalHealthcheck = async (
  url: string,
  outcome: 'success' | 'fail',
  message?: string,
  fetchFn: typeof fetch = fetch
) => {
  const target = outcome === 'success' ? url : `${url.replace(/\/$/, '')}/fail`
  const response = await fetchFn(target, {
    method: 'POST',
    body: message ?? 'Sauvegarde publiee',
    signal: AbortSignal.timeout(SIGNAL_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`signal de vie : reponse ${response.status}`)
  }
}

export const serverSteps = (config: BackupConfig): BackupSteps => {
  const database = pgToolConnection(config.databaseUrl)
  return {
    checkRole: () => checkBackupRole(config.databaseUrl),
    makeDirectory: async (dir) => {
      await mkdir(config.backupDir, {recursive: true, mode: 0o750})
      await mkdir(dir, {mode: 0o750})
    },
    dumpDatabase: (file) =>
      run(
        'pg_dump',
        ['--format=custom', `--file=${file}`, database.dbname],
        database.env
      ),
    archiveFiles: (file) =>
      run('tar', [
        '--create',
        '--gzip',
        `--file=${file}`,
        `--directory=${config.storageRoot}`,
        '.',
      ]),
    writeChecksums: writeChecksumsFile,
    verify: verifyBackup,
    publish: (from, to) => rename(from, to),
    list: () => readdir(config.backupDir),
    remove: (target) => rm(target, {recursive: true, force: true}),
    signal: (outcome, message) =>
      signalHealthcheck(config.healthcheckUrl, outcome, message),
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  Promise.resolve()
    .then(() => {
      initDotEnv()
      const config = backupConfigFrom(process.env, process.cwd())
      return runBackup(config, serverSteps(config), new Date())
    })
    .then((result) => process.exit(result.exitCode))
    .catch((error) => {
      console.error('[backup] Echec inattendu', error)
      process.exit(1)
    })
}
