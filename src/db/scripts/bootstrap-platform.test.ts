import {describe, expect, it} from 'vitest'

import {parseBootstrapArgs} from './bootstrap-platform'

const complete = [
  '--name',
  'ASL Exemple',
  '--slug',
  'asl-exemple',
  '--domain',
  'asl-exemple.test',
  '--admin-email',
  'prestataire@exemple.test',
  '--contact-email',
  'contact@asl-exemple.test',
]

const expected = {
  name: 'ASL Exemple',
  slug: 'asl-exemple',
  domain: 'asl-exemple.test',
  adminEmail: 'prestataire@exemple.test',
  contactEmail: 'contact@asl-exemple.test',
}

describe('parseBootstrapArgs — arguments de pnpm ops:bootstrap', () => {
  it('lit les cinq options', () => {
    expect(parseBootstrapArgs(complete)).toEqual(expected)
  })

  it('ignore le « -- » que pnpm transmet tel quel', () => {
    expect(parseBootstrapArgs(['--', ...complete])).toEqual(expected)
  })

  it('nomme les options manquantes', () => {
    expect(() =>
      parseBootstrapArgs(['--name', 'ASL Exemple', '--slug', 'asl-exemple'])
    ).toThrow(/--domain.*--admin-email.*--contact-email/)
  })

  it('refuse une option inconnue', () => {
    expect(() => parseBootstrapArgs([...complete, '--seed', 'oui'])).toThrow()
  })
})
