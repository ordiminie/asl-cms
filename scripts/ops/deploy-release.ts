/**
 * Orchestrateur du deploiement (ADR 036, s12b). Appele par `ops/deploy.sh`,
 * en root, une fois la version preparee dans `/srv/asl-cms/releases/<commit>` :
 *
 *     pnpm ops:deploy-release -- /srv/asl-cms/releases/<commit>
 *
 * Ordre : build, cache partage, marqueur de build complet, migrations,
 * controle du role applicatif, bascule du lien `current`, redemarrage,
 * verification HTTP locale. La premiere etape en echec
 * arrete tout. Avant la bascule, le lien n'est jamais touche : la version
 * precedente reste en service. Apres la bascule, un echec remet le lien sur la
 * version precedente et la relance.
 *
 * Une fois la nouvelle version verifiee, le lien `previous` designe celle qui
 * etait servie avant elle : c'est la cible de `ops/rollback.sh` sans argument.
 * Il n'est ecrit qu'apres un deploiement reussi, jamais vers une version
 * construite sans avoir ete servie (ni migree).
 *
 * `next build` lit et ecrit `.next/cache` : il construit avec un repertoire
 * propre a la version, que le service ne peut pas ecrire. Seulement ensuite,
 * ce repertoire est remplace par un lien vers `shared/next-cache/<commit>`,
 * recree a neuf sous asl-cms : rien de prepare dans shared/ ne survit.
 * Le marqueur `BUILD_MARKER` n'est ecrit qu'apres ces deux etapes : c'est lui,
 * et non `.next/BUILD_ID` (ecrit avant la generation statique), que
 * `ops/rollback.sh` exige.
 */
import {spawn} from 'node:child_process'
import {readlink, rename, rm, symlink} from 'node:fs/promises'
import path from 'node:path'
import {pathToFileURL} from 'node:url'

export type DeploySteps = {
  build: () => Promise<void>
  /** Remplace le `.next/cache` du build par un lien vers shared/. */
  shareCache: () => Promise<void>
  /** Marque la version comme entierement construite. */
  markBuilt: () => Promise<void>
  migrate: () => Promise<void>
  checkDatabase: () => Promise<void>
  /** Cible actuelle du lien `current`, `undefined` au premier deploiement. */
  readCurrent: () => Promise<string | undefined>
  switchCurrent: (target: string) => Promise<void>
  restart: () => Promise<void>
  verify: () => Promise<void>
  /** Retient la version servie avant celle qui vient d'etre verifiee. */
  recordPrevious: (target: string) => Promise<void>
}

export type DeployResult = {exitCode: 0} | {exitCode: 1; failedStep: string}

const BEFORE_SWITCH = [
  'build',
  'shareCache',
  'markBuilt',
  'migrate',
  'checkDatabase',
] as const
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

  if (previous) {
    await steps.recordPrevious(previous)
  }
  console.log(`[deploy] Version en service : ${release}`)
  return {exitCode: 0}
}

// ===== Etapes reelles, sur le serveur =====

export const APP_ROOT = '/srv/asl-cms'
/** Chemin, relatif a la version, du marqueur de build complet. */
export const BUILD_MARKER = '.next/ASL_BUILD_OK'
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

const runCommandAsAppUser = (args: string[]) =>
  run('runuser', ['-u', APP_USER, '--', ...args])

/**
 * Tout se fait sous asl-cms : root ne supprime rien a travers shared/,
 * inscriptible par le service.
 */
const shareCache = async (release: string) => {
  const sharedCache = path.join(
    APP_ROOT,
    'shared',
    'next-cache',
    path.basename(release)
  )
  const releaseCache = path.join(release, '.next', 'cache')
  await runCommandAsAppUser(['rm', '-rf', sharedCache])
  await runCommandAsAppUser(['mkdir', '-p', sharedCache])
  await runCommandAsAppUser(['rm', '-rf', releaseCache])
  await runCommandAsAppUser(['ln', '-sT', sharedCache, releaseCache])
}

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
const replaceLink = async (name: 'current' | 'previous', target: string) => {
  const temporary = path.join(APP_ROOT, `${name}.next`)
  await rm(temporary, {force: true})
  await symlink(target, temporary)
  await rename(temporary, path.join(APP_ROOT, name))
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
  shareCache: () => shareCache(release),
  markBuilt: () =>
    runCommandAsAppUser(['touch', path.join(release, BUILD_MARKER)]),
  migrate: () => runAsAppUser(release, 'db:migrate'),
  checkDatabase: () => runAsAppUser(release, 'db:check'),
  readCurrent: readCurrentLink,
  switchCurrent: (target) => replaceLink('current', target),
  restart: () => run('systemctl', ['restart', SERVICE]),
  verify: verifyLocally,
  recordPrevious: (target) => replaceLink('previous', target),
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
