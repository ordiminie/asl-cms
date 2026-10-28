import {describe, expect, it} from 'vitest'

import {parseTransferPresidencyArgs} from './transfer-presidency'

describe('parseTransferPresidencyArgs — arguments de pnpm ops:transfer-presidency', () => {
  it('lit le domaine puis l’adresse', () => {
    expect(
      parseTransferPresidencyArgs(['clos-fleuri.test', 'paul@example.test'])
    ).toEqual({domain: 'clos-fleuri.test', email: 'paul@example.test'})
  })

  it('ignore le « -- » que pnpm transmet tel quel', () => {
    expect(
      parseTransferPresidencyArgs([
        '--',
        'clos-fleuri.test',
        'paul@example.test',
      ])
    ).toEqual({domain: 'clos-fleuri.test', email: 'paul@example.test'})
  })

  it.each([[[]], [['clos-fleuri.test']]])(
    'nomme l’usage quand un argument manque (%j)',
    (argv) => {
      expect(() => parseTransferPresidencyArgs(argv)).toThrow(
        /pnpm ops:transfer-presidency <domaine> <adresse>/
      )
    }
  )

  it('refuse un argument de trop', () => {
    expect(() =>
      parseTransferPresidencyArgs(['a.test', 'b@example.test', 'c'])
    ).toThrow(/pnpm ops:transfer-presidency <domaine> <adresse>/)
  })

  it('refuse une option', () => {
    expect(() =>
      parseTransferPresidencyArgs(['--domain', 'a.test', 'b@example.test'])
    ).toThrow()
  })
})
