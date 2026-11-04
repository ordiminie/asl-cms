import {readFileSync} from 'node:fs'
import path from 'node:path'

import {describe, expect, it} from 'vitest'

/**
 * Les scripts d'exploitation neutralisent `server-only` par le seul module
 * `allow-server-only` (ADR 044) : `registerHooks` echoue sur Node 22.22.2.
 */
const SCRIPTS = [
  'bootstrap-platform.ts',
  'transfer-presidency.ts',
  'purge-rate-limit-fingerprints.ts',
  'seed.ts',
]

const read = (file: string) =>
  readFileSync(path.join(import.meta.dirname, file), 'utf8')

describe.each(SCRIPTS)('%s — server-only neutralise (ADR 044)', (file) => {
  const source = read(file)

  it('importe allowServerOnly depuis ./allow-server-only', () => {
    expect(source).toMatch(
      /import \{allowServerOnly\} from '\.\/allow-server-only'/
    )
  })

  it("appelle allowServerOnly() avant l'import dynamique des services", () => {
    const call = source.indexOf('allowServerOnly()')
    const dynamicImport = source.indexOf("await import('@/services/")

    expect(call).toBeGreaterThan(-1)
    expect(dynamicImport).toBeGreaterThan(-1)
    expect(call).toBeLessThan(dynamicImport)
  })

  it('ne contient plus registerHooks', () => {
    expect(source).not.toContain('registerHooks')
  })
})
