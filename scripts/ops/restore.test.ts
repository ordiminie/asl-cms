import {readFileSync} from 'node:fs'
import path from 'node:path'

import {describe, expect, it} from 'vitest'

import {
  parseRestoreArgs,
  pgRestoreArgs,
  type RestoreOptions,
  type RestoreSteps,
  runRestore,
  sameDatabase,
  type ServerTargets,
} from './restore'

const BACKUP = '/srv/asl-cms/shared/backups/20261105T031230Z'

const SERVER_STORAGE = '/srv/asl-cms/shared/storage'

const SERVER: ServerTargets = {
  databaseUrls: [
    'postgres://asl_app:x@127.0.0.1:5432/asl_cms',
    'postgres://asl_owner:y@127.0.0.1:5432/asl_cms',
  ],
  storageRoot: SERVER_STORAGE,
}

const OPTIONS: RestoreOptions = {
  backup: BACKUP,
  targetUrl: 'postgres://asl_restore:z@127.0.0.1:5432/asl_cms_exercice',
  targetStorage: '/tmp/asl-cms-exercice/storage',
  replaceProduction: false,
}

type StepName = keyof RestoreSteps

/** Etapes factices : `failing` leve, `full` designe des cibles non vides. */
const fakeSteps = (
  options: {
    failing?: StepName
    fullDatabase?: boolean
    fullStorage?: boolean
  } = {}
) => {
  const calls: string[] = []
  const step =
    <T>(name: StepName, result?: T) =>
    async (...args: string[]) => {
      calls.push([name, ...args].join(':'))
      if (name === options.failing) {
        throw new Error(`${name} en échec`)
      }
      return result as T
    }

  const steps: RestoreSteps = {
    verifyChecksums: step('verifyChecksums'),
    isDatabaseEmpty: step('isDatabaseEmpty', !options.fullDatabase),
    isStorageEmpty: step('isStorageEmpty', !options.fullStorage),
    restoreDatabase: step('restoreDatabase'),
    extractFiles: step('extractFiles'),
  }
  return {steps, calls}
}

const restored = (calls: string[]) =>
  calls.filter(
    (call) =>
      call.startsWith('restoreDatabase') || call.startsWith('extractFiles')
  )

describe('runRestore — restauration vers des cibles vides', () => {
  it('vérifie les sommes, contrôle les cibles, restaure la base puis les fichiers', async () => {
    const {steps, calls} = fakeSteps()

    const result = await runRestore(OPTIONS, SERVER, steps)

    expect(result).toEqual({exitCode: 0})
    expect(calls).toEqual([
      `verifyChecksums:${BACKUP}`,
      `isDatabaseEmpty:${OPTIONS.targetUrl}`,
      `isStorageEmpty:${OPTIONS.targetStorage}`,
      `restoreDatabase:${BACKUP}/database.dump:${OPTIONS.targetUrl}`,
      `extractFiles:${BACKUP}/files.tar.gz:${OPTIONS.targetStorage}`,
    ])
  })

  it('une somme de contrôle fausse arrête tout avant la moindre écriture', async () => {
    const {steps, calls} = fakeSteps({failing: 'verifyChecksums'})

    const result = await runRestore(OPTIONS, SERVER, steps)

    expect(result).toMatchObject({exitCode: 1})
    expect(restored(calls)).toEqual([])
  })

  it('refuse une base cible non vide', async () => {
    const {steps, calls} = fakeSteps({fullDatabase: true})

    const result = await runRestore(OPTIONS, SERVER, steps)

    expect(result).toEqual({exitCode: 1, reason: expect.stringMatching(/vide/)})
    expect(restored(calls)).toEqual([])
  })

  it('refuse un répertoire cible non vide', async () => {
    const {steps, calls} = fakeSteps({fullStorage: true})

    const result = await runRestore(OPTIONS, SERVER, steps)

    expect(result).toEqual({exitCode: 1, reason: expect.stringMatching(/vide/)})
    expect(restored(calls)).toEqual([])
  })

  it('une base restaurée en échec n’extrait aucun fichier', async () => {
    const {steps, calls} = fakeSteps({failing: 'restoreDatabase'})

    const result = await runRestore(OPTIONS, SERVER, steps)

    expect(result).toMatchObject({exitCode: 1})
    expect(calls.some((call) => call.startsWith('extractFiles'))).toBe(false)
  })
})

describe('runRestore — le garde-fou de la production', () => {
  it.each([
    ['la base de l’application', 'postgres://postgres@localhost/asl_cms'],
    ['par le socket local', 'postgresql:///asl_cms?host=/var/run/postgresql'],
    ['sous un autre rôle', 'postgres://asl_restore:z@127.0.0.1:5432/asl_cms'],
  ])('refuse %s sans --replace-production', async (_label, targetUrl) => {
    const {steps, calls} = fakeSteps()

    const result = await runRestore({...OPTIONS, targetUrl}, SERVER, steps)

    expect(result).toEqual({
      exitCode: 1,
      reason: expect.stringContaining('--replace-production'),
    })
    expect(restored(calls)).toEqual([])
  })

  it('refuse la racine des fichiers du serveur sans --replace-production', async () => {
    const {steps, calls} = fakeSteps()

    const result = await runRestore(
      {...OPTIONS, targetStorage: `${SERVER_STORAGE}/`},
      SERVER,
      steps
    )

    expect(result).toEqual({
      exitCode: 1,
      reason: expect.stringContaining('--replace-production'),
    })
    expect(restored(calls)).toEqual([])
  })

  it('accepte la production avec --replace-production, toujours sur des cibles vides', async () => {
    const {steps} = fakeSteps()

    const result = await runRestore(
      {
        ...OPTIONS,
        targetUrl: 'postgres://asl_restore:z@127.0.0.1:5432/asl_cms',
        targetStorage: SERVER_STORAGE,
        replaceProduction: true,
      },
      SERVER,
      steps
    )

    expect(result).toEqual({exitCode: 0})
  })
})

describe('sameDatabase', () => {
  it('compare hôte local, port et base, pas les identifiants', () => {
    expect(
      sameDatabase(
        'postgres://a:1@localhost:5432/asl_cms',
        'postgres://b:2@127.0.0.1/asl_cms'
      )
    ).toBe(true)
    expect(
      sameDatabase(
        'postgres://a@127.0.0.1/asl_cms',
        'postgres://a@127.0.0.1/asl_cms_exercice'
      )
    ).toBe(false)
    expect(
      sameDatabase(
        'postgres://a@127.0.0.1:5433/asl_cms',
        'postgres://a@127.0.0.1/asl_cms'
      )
    ).toBe(false)
  })
})

describe('parseRestoreArgs — la cible est toujours explicite', () => {
  const ARGS = [
    '--',
    BACKUP,
    '--target-url',
    OPTIONS.targetUrl,
    '--target-storage',
    OPTIONS.targetStorage,
  ]

  it('lit la sauvegarde et les deux cibles', () => {
    expect(parseRestoreArgs(ARGS)).toEqual(OPTIONS)
    expect(parseRestoreArgs([...ARGS, '--replace-production'])).toEqual({
      ...OPTIONS,
      replaceProduction: true,
    })
  })

  it.each([
    ['sans sauvegarde', ARGS.filter((arg) => arg !== BACKUP)],
    ['sans --target-url', ['--', BACKUP, '--target-storage', '/tmp/x']],
    [
      'sans --target-storage',
      ['--', BACKUP, '--target-url', OPTIONS.targetUrl],
    ],
    ['avec un chemin relatif', ['--', 'backups/x', ...ARGS.slice(2)]],
    ['avec une option inconnue', [...ARGS, '--force']],
  ])('refuse %s', (_label, args) => {
    expect(() => parseRestoreArgs(args)).toThrow(/Usage/)
  })
})

describe('pgRestoreArgs — propriétaires et droits conservés', () => {
  it('restaure en une transaction, s’arrête à la première erreur', () => {
    const args = pgRestoreArgs('/b/database.dump', 'postgres:///x')

    expect(args).toContain('--exit-on-error')
    expect(args).toContain('--single-transaction')
    expect(args).toContain('/b/database.dump')
  })

  it('ne retire ni propriétaires ni droits : asl_app perdrait l’accès', () => {
    const args = pgRestoreArgs('/b/database.dump', 'postgres:///x')

    expect(args).not.toContain('--no-owner')
    expect(args).not.toContain('--no-acl')
    expect(args).not.toContain('--no-privileges')
  })
})

describe('scripts/ops/restore.ts — sans confirmation interactive', () => {
  it('ne lit jamais le clavier : la garde est l’option explicite', () => {
    const source = readFileSync(
      path.join(import.meta.dirname, 'restore.ts'),
      'utf8'
    )

    expect(source).not.toMatch(/process\.stdin|readline|prompt\(/)
  })
})
