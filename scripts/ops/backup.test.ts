import {readFileSync} from 'node:fs'
import path from 'node:path'

import {describe, expect, it} from 'vitest'

import {
  BACKUP_FILES,
  type BackupConfig,
  backupConfigFrom,
  backupName,
  type BackupSteps,
  backupsToPurge,
  formatChecksums,
  parseChecksums,
  runBackup,
} from './backup'

const BACKUP_DIR = '/srv/asl-cms/shared/backups'
const NOW = new Date('2026-11-05T03:12:30Z')
const NAME = '20261105T031230Z'
const TEMPORARY = `${BACKUP_DIR}/.tmp-${NAME}`
const FINAL = `${BACKUP_DIR}/${NAME}`

const CONFIG: BackupConfig = {
  backupDir: BACKUP_DIR,
  storageRoot: '/srv/asl-cms/shared/storage',
  databaseUrl: 'postgres://asl_backup:secret@127.0.0.1:5432/asl_cms',
  healthcheckUrl: 'https://healthchecks.example/ping/uuid',
  retentionDays: 15,
}

type StepName = Exclude<keyof BackupSteps, 'list'>

/**
 * Etapes factices sur un `BACKUP_DIR` simule : `entries` est son contenu.
 * L'etape nommee dans `failing` leve ; `calls` garde l'ordre des passages.
 */
const fakeSteps = (failing?: StepName, existing: string[] = []) => {
  const calls: string[] = []
  const entries = new Set(existing)
  const signals: string[] = []

  const step =
    (name: StepName, effect?: (...args: string[]) => void) =>
    async (...args: string[]) => {
      calls.push([name, ...args].join(':'))
      if (name === failing) {
        throw new Error(`${name} en échec`)
      }
      effect?.(...args)
    }

  const steps: BackupSteps = {
    checkRole: step('checkRole'),
    makeDirectory: step('makeDirectory', (dir) => {
      entries.add(path.basename(dir))
    }),
    dumpDatabase: step('dumpDatabase'),
    archiveFiles: step('archiveFiles'),
    writeChecksums: step('writeChecksums'),
    verify: step('verify'),
    publish: step('publish', (from, to) => {
      entries.delete(path.basename(from))
      entries.add(path.basename(to))
    }),
    list: async () => [...entries],
    remove: step('remove', (target) => {
      entries.delete(path.basename(target))
    }),
    signal: async (outcome, message) => {
      calls.push(`signal:${outcome}`)
      signals.push(message ? `${outcome}:${message}` : outcome)
      if (failing === 'signal' && outcome === 'success') {
        throw new Error('signal en échec')
      }
    },
  }

  return {steps, calls, entries, signals}
}

describe('runBackup — une sauvegarde complète', () => {
  it('copie la base avant les fichiers, vérifie, publie, purge, puis signale la réussite en dernier', async () => {
    const {steps, calls} = fakeSteps()

    const result = await runBackup(CONFIG, steps, NOW)

    expect(result).toEqual({exitCode: 0, backup: FINAL, purged: []})
    expect(calls).toEqual([
      'checkRole',
      `makeDirectory:${TEMPORARY}`,
      `dumpDatabase:${TEMPORARY}/database.dump`,
      `archiveFiles:${TEMPORARY}/files.tar.gz`,
      `writeChecksums:${TEMPORARY}`,
      `verify:${TEMPORARY}`,
      `publish:${TEMPORARY}:${FINAL}`,
      'signal:success',
    ])
  })

  it('publie une sauvegarde de trois fichiers, sous un seul horodatage', () => {
    expect(BACKUP_FILES).toEqual({
      database: 'database.dump',
      files: 'files.tar.gz',
      checksums: 'SHA256SUMS',
    })
    expect(backupName(NOW)).toBe(NAME)
  })
})

describe('runBackup — une étape en échec', () => {
  const OLD = '20261001T030000Z'

  it.each([
    'checkRole',
    'makeDirectory',
    'dumpDatabase',
    'archiveFiles',
    'writeChecksums',
    'verify',
    'publish',
  ] as const)(
    '%s en échec : aucun répertoire au nom final, rien de purgé, signal /fail',
    async (failing) => {
      const {steps, calls, entries, signals} = fakeSteps(failing, [OLD])

      const result = await runBackup(CONFIG, steps, NOW)

      expect(result).toEqual({exitCode: 1, failedStep: failing})
      expect([...entries]).not.toContain(NAME)
      expect([...entries]).toContain(OLD)
      expect([...entries].filter((entry) => entry.startsWith('.tmp-'))).toEqual(
        []
      )
      expect(calls).not.toContain(`remove:${BACKUP_DIR}/${OLD}`)
      expect(signals).toEqual([expect.stringMatching(/^fail:.*en échec/)])
    }
  )

  it('une purge en échec garde la sauvegarde publiée mais signale /fail', async () => {
    const {steps, entries, signals} = fakeSteps('remove', [OLD])

    const result = await runBackup(CONFIG, steps, NOW)

    expect(result).toEqual({exitCode: 1, failedStep: 'purge'})
    expect([...entries]).toContain(NAME)
    expect(signals).toEqual([expect.stringMatching(/^fail:/)])
  })

  it('un signal de réussite qui n’arrive pas fait sortir en erreur', async () => {
    const {steps} = fakeSteps('signal')

    const result = await runBackup(CONFIG, steps, NOW)

    expect(result).toEqual({exitCode: 1, failedStep: 'signal'})
  })
})

describe('backupsToPurge — rétention', () => {
  it('supprime au-delà de la rétention, garde ce qui est plus récent', () => {
    const names = [
      '20261020T030000Z',
      '20261021T040000Z',
      '20261025T030000Z',
      NAME,
    ]

    expect(backupsToPurge(names, NOW, 15)).toEqual(['20261020T030000Z'])
  })

  it('garde toujours la plus récente sauvegarde complète, même trop vieille', () => {
    const names = ['20260101T030000Z', '20260301T030000Z']

    expect(backupsToPurge(names, NOW, 15)).toEqual(['20260101T030000Z'])
  })

  it('supprime les répertoires temporaires laissés par une sauvegarde interrompue', () => {
    const names = ['.tmp-20261103T030000Z', NAME]

    expect(backupsToPurge(names, NOW, 15)).toEqual(['.tmp-20261103T030000Z'])
  })

  it('ne touche à rien qui n’a pas le nom d’une sauvegarde', () => {
    const names = ['notes.txt', 'lost+found', '20200101', NAME]

    expect(backupsToPurge(names, NOW, 15)).toEqual([])
  })

  it('purge réellement à la fin d’une sauvegarde réussie', async () => {
    const {steps, entries} = fakeSteps(undefined, [
      '20261001T030000Z',
      '20261030T030000Z',
    ])

    const result = await runBackup(CONFIG, steps, NOW)

    expect(result).toEqual({
      exitCode: 0,
      backup: FINAL,
      purged: ['20261001T030000Z'],
    })
    expect([...entries].sort()).toEqual(['20261030T030000Z', NAME])
  })
})

describe('backupConfigFrom — la configuration vient de l’environnement', () => {
  const ENV = {
    BACKUP_DIR,
    BACKUP_DATABASE_URL: CONFIG.databaseUrl,
    BACKUP_HEALTHCHECK_URL: CONFIG.healthcheckUrl,
    LOCAL_STORAGE_ROOT: CONFIG.storageRoot,
  }
  const CWD = '/srv/asl-cms/releases/0123456789ab'

  it('lit la destination et la rétention, 15 jours par défaut', () => {
    expect(backupConfigFrom(ENV, CWD)).toEqual(CONFIG)
    expect(
      backupConfigFrom({...ENV, BACKUP_RETENTION_DAYS: '30'}, CWD).retentionDays
    ).toBe(30)
  })

  it.each([
    'BACKUP_DIR',
    'BACKUP_DATABASE_URL',
    'BACKUP_HEALTHCHECK_URL',
    'LOCAL_STORAGE_ROOT',
  ] as const)('refuse de tourner sans %s', (key) => {
    expect(() => backupConfigFrom({...ENV, [key]: undefined}, CWD)).toThrow(key)
  })

  it.each(['0', '-1', 'quinze', '1.5'])(
    'refuse une rétention « %s »',
    (value) => {
      expect(() =>
        backupConfigFrom({...ENV, BACKUP_RETENTION_DAYS: value}, CWD)
      ).toThrow('BACKUP_RETENTION_DAYS')
    }
  )

  it.each([
    ['relatif', 'backups'],
    ['dans la racine des fichiers', '/srv/asl-cms/shared/storage/backups'],
    ['égal à la racine des fichiers', '/srv/asl-cms/shared/storage'],
    ['parent de la racine des fichiers', '/srv/asl-cms/shared'],
    ['dans le répertoire déployé', `${CWD}/backups`],
  ])('refuse un BACKUP_DIR %s', (_label, dir) => {
    expect(() => backupConfigFrom({...ENV, BACKUP_DIR: dir}, CWD)).toThrow(
      'BACKUP_DIR'
    )
  })
})

describe('SHA256SUMS — format de sha256sum', () => {
  it('écrit puis relit les sommes de contrôle', () => {
    const sums = {
      'database.dump': 'a'.repeat(64),
      'files.tar.gz': 'b'.repeat(64),
    }

    const text = formatChecksums(sums)

    expect(text).toBe(
      `${'a'.repeat(64)}  database.dump\n${'b'.repeat(64)}  files.tar.gz\n`
    )
    expect(parseChecksums(text)).toEqual(sums)
  })

  it('refuse une ligne illisible plutôt que de l’ignorer', () => {
    expect(() => parseChecksums('pas une somme\n')).toThrow()
  })
})

describe('scripts/ops/backup.ts — sans intervention humaine', () => {
  it('ne lit jamais le clavier', () => {
    const source = readFileSync(
      path.join(import.meta.dirname, 'backup.ts'),
      'utf8'
    )

    expect(source).not.toMatch(/process\.stdin|readline|prompt\(/)
  })
})
