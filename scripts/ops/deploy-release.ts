/**
 * Orchestrateur du deploiement (ADR 036, s12b). Appele par `ops/deploy.sh`,
 * en root, une fois la version preparee dans `/srv/asl-cms/releases/<commit>` :
 *
 *     pnpm ops:deploy-release -- /srv/asl-cms/releases/<commit>
 *
 * Ordre : build, migrations, controle du role applicatif, bascule du lien
 * `current`, redemarrage, verification HTTP locale. La premiere etape en echec
 * arrete tout. Avant la bascule, le lien n'est jamais touche : la version
 * precedente reste en service. Apres la bascule, un echec remet le lien sur la
 * version precedente et la relance.
 */
import {spawn} from 'node:child_process'
import {readlink, rename, rm, symlink} from 'node:fs/promises'
import path from 'node:path'
import {pathToFileURL} from 'node:url'

export type DeploySteps = {
  build: () => Promise<void>
  migrate: () => Promise<void>
  checkDatabase: () => Promise<void>
  /** Cible actuelle du lien `current`, `undefined` au premier deploiement. */
  readCurrent: () => Promise<string | undefined>
  switchCurrent: (target: string) => Promise<void>
  restart: () => Promise<void>
  verify: () => Promise<void>
}

export type DeployResult = {exitCode: 0} | {exitCode: 1; failedStep: string}

const BEFORE_SWITCH = ['build', 'migrate', 'checkDatabase'] as const
const AFTER_SWITCH = ['restart', 'verify'] as const

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const restorePrevious = async (
  steps: DeploySteps,
  previous: string | undefined
) => {
  if (!previous) {
    console.error('Aucune version precedente a restaurer (premier deploiement)')
    return
  }
  console.error(`Retour a la version precedente : ${previous}`)
  await steps.switchCurrent(previous)
  await steps.restart()
}

export const deployRelease = async (
  release: string,
  steps: DeploySteps
): Promise<DeployResult> => {
  for (const name of BEFORE_SWITCH) {
    try {
      console.log(`[deploy] ${name}`)
      await steps[name]()
    } catch (error) {
      console.error(`[deploy] ${name} en echec : ${errorMessage(error)}`)
      console.error(
        '[deploy] Lien current inchange : la version en service reste'
      )
      return {exitCode: 1, failedStep: name}
    }
  }

  const previous = await steps.readCurrent()
  console.log(`[deploy] bascule ${previous ?? '(aucune)'} -> ${release}`)
  await steps.switchCurrent(release)

  for (const name of AFTER_SWITCH) {
    try {
      console.log(`[deploy] ${name}`)
      await steps[name]()
    } catch (error) {
      console.error(`[deploy] ${name} en echec : ${errorMessage(error)}`)
      await restorePrevious(steps, previous)
      return {exitCode: 1, failedStep: name}
    }
  }

  console.log(`[deploy] Version en service : ${release}`)
  return {exitCode: 0}
}

// ===== Etapes reelles, sur le serveur =====

export const APP_ROOT = '/srv/asl-cms'
const APP_USER = 'asl-cms'
const SERVICE = 'asl-cms'
const LOCAL_URL = 'http://127.0.0.1:3100/'
const VERIFY_ATTEMPTS = 30
const VERIFY_DELAY_MS = 2000

const run = (command: string, args: string[], cwd?: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {cwd, stdio: 'inherit'})
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} ${args.join(' ')} : sortie ${code}`))
    )
  })

/**
 * Les scripts du depot tournent sous l'utilisateur du service, avec
 * `NODE_ENV=production` : c'est ce qui fait lire `.env.production` aux
 * scripts `db:*` (`src/db/scripts/env.ts`).
 */
const runAsAppUser = (release: string, script: string) =>
  run(
    'runuser',
    ['-u', APP_USER, '--', 'env', 'NODE_ENV=production', 'pnpm', script],
    release
  )

const readCurrentLink = async (): Promise<string | undefined> => {
  try {
    return await readlink(path.join(APP_ROOT, 'current'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

/** Lien temporaire puis `rename` : le remplacement du lien est atomique. */
const switchCurrentLink = async (target: string) => {
  const temporary = path.join(APP_ROOT, 'current.next')
  await rm(temporary, {force: true})
  await symlink(target, temporary)
  await rename(temporary, path.join(APP_ROOT, 'current'))
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Attend que la nouvelle version reponde sur la boucle locale. */
const verifyLocally = async () => {
  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(LOCAL_URL, {redirect: 'manual'})
      if (response.status < 500) {
        console.log(`[deploy] ${LOCAL_URL} repond ${response.status}`)
        return
      }
      console.warn(`[deploy] ${LOCAL_URL} repond ${response.status}`)
    } catch {
      console.warn(`[deploy] ${LOCAL_URL} injoignable (essai ${attempt})`)
    }
    await sleep(VERIFY_DELAY_MS)
  }
  throw new Error(`${LOCAL_URL} ne repond pas apres ${VERIFY_ATTEMPTS} essais`)
}

export const serverSteps = (release: string): DeploySteps => ({
  build: () => runAsAppUser(release, 'build'),
  migrate: () => runAsAppUser(release, 'db:migrate'),
  checkDatabase: () => runAsAppUser(release, 'db:check'),
  readCurrent: readCurrentLink,
  switchCurrent: switchCurrentLink,
  restart: () => run('systemctl', ['restart', SERVICE]),
  verify: verifyLocally,
})

const releaseFromArgs = (argv: string[]): string => {
  const [release] = argv.filter((arg) => arg !== '--')
  const releases = path.join(APP_ROOT, 'releases') + path.sep
  if (!release || !path.isAbsolute(release) || !release.startsWith(releases)) {
    throw new Error(
      `Usage : pnpm ops:deploy-release -- ${releases}<commit> (chemin absolu)`
    )
  }
  return release
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  Promise.resolve()
    .then(() => {
      const release = releaseFromArgs(process.argv.slice(2))
      return deployRelease(release, serverSteps(release))
    })
    .then(({exitCode}) => process.exit(exitCode))
    .catch((error) => {
      console.error('[deploy] Echec inattendu', error)
      process.exit(1)
    })
}
