import {describe, expect, it} from 'vitest'

import {deployRelease, type DeploySteps} from './deploy-release'

const PREVIOUS = '/srv/asl-cms/releases/aaaaaaa'
const RELEASE = '/srv/asl-cms/releases/bbbbbbb'

type StepName = keyof DeploySteps

/**
 * Etapes factices : chacune note son passage dans `calls`, et celle nommee
 * dans `failing` leve. Le lien `current` est simule par `link.target`.
 */
const fakeSteps = (failing?: StepName) => {
  const calls: string[] = []
  const link = {target: PREVIOUS as string | undefined}
  const step =
    (name: StepName, effect?: (target?: string) => void) =>
    async (target?: string) => {
      calls.push(target ? `${name}:${target}` : name)
      if (name === failing) {
        throw new Error(`${name} en échec`)
      }
      effect?.(target)
    }

  const steps: DeploySteps = {
    build: step('build'),
    migrate: step('migrate'),
    checkDatabase: step('checkDatabase'),
    readCurrent: async () => link.target,
    switchCurrent: step('switchCurrent', (target) => {
      link.target = target
    }) as DeploySteps['switchCurrent'],
    restart: step('restart'),
    verify: step('verify'),
  }
  return {steps, calls, link}
}

describe('deployRelease — orchestrateur du déploiement (ADR 036)', () => {
  it('enchaîne build, migrations, contrôle du rôle, bascule, redémarrage, vérification', async () => {
    const {steps, calls, link} = fakeSteps()

    const result = await deployRelease(RELEASE, steps)

    expect(calls).toEqual([
      'build',
      'migrate',
      'checkDatabase',
      `switchCurrent:${RELEASE}`,
      'restart',
      'verify',
    ])
    expect(result).toEqual({exitCode: 0})
    expect(link.target).toBe(RELEASE)
  })

  it('un build en échec ne lance pas les migrations et ne touche pas au lien', async () => {
    const {steps, calls, link} = fakeSteps('build')

    const result = await deployRelease(RELEASE, steps)

    expect(calls).toEqual(['build'])
    expect(result).toEqual({exitCode: 1, failedStep: 'build'})
    expect(link.target).toBe(PREVIOUS)
  })

  it('une migration en échec arrête tout avant la bascule : sortie 1, version précédente en service', async () => {
    const {steps, calls, link} = fakeSteps('migrate')

    const result = await deployRelease(RELEASE, steps)

    expect(calls).toEqual(['build', 'migrate'])
    expect(result).toEqual({exitCode: 1, failedStep: 'migrate'})
    expect(link.target).toBe(PREVIOUS)
  })

  it('un contrôle du rôle applicatif en échec ne bascule pas', async () => {
    const {steps, calls, link} = fakeSteps('checkDatabase')

    const result = await deployRelease(RELEASE, steps)

    expect(calls).not.toContain(`switchCurrent:${RELEASE}`)
    expect(calls).not.toContain('restart')
    expect(result).toEqual({exitCode: 1, failedStep: 'checkDatabase'})
    expect(link.target).toBe(PREVIOUS)
  })

  it('une vérification en échec après la bascule remet le lien sur la version précédente et la relance', async () => {
    const {steps, calls, link} = fakeSteps('verify')

    const result = await deployRelease(RELEASE, steps)

    expect(calls).toEqual([
      'build',
      'migrate',
      'checkDatabase',
      `switchCurrent:${RELEASE}`,
      'restart',
      'verify',
      `switchCurrent:${PREVIOUS}`,
      'restart',
    ])
    expect(result).toEqual({exitCode: 1, failedStep: 'verify'})
    expect(link.target).toBe(PREVIOUS)
  })

  it('premier déploiement (aucun lien) : une vérification en échec ne peut rien restaurer', async () => {
    const {steps, calls, link} = fakeSteps('verify')
    link.target = undefined

    const result = await deployRelease(RELEASE, steps)

    expect(calls.filter((call) => call.startsWith('switchCurrent'))).toEqual([
      `switchCurrent:${RELEASE}`,
    ])
    expect(result).toEqual({exitCode: 1, failedStep: 'verify'})
  })
})
