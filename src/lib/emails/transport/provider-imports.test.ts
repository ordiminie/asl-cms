import fs from 'node:fs'
import {readFile} from 'node:fs/promises'
import path from 'node:path'

import {describe, expect, it} from 'vitest'

const SRC = path.resolve(import.meta.dirname, '../../..')
const RESEND_ADAPTER = path.join(
  SRC,
  'lib',
  'emails',
  'transport',
  'resend-transport.ts'
)

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(fullPath)
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [fullPath]
      : []
  })

const IMPORTS_RESEND = /from\s+['"]resend['"]|import\(\s*['"]resend['"]\s*\)/

/** Lecture de tout `src/` : lente sur un disque monte, d'ou le delai explicite. */
const SCAN_TIMEOUT_MS = 30_000

describe('ADR 005 / ADR 017 — aucun appel direct à un fournisseur', () => {
  it(
    'seul l’adaptateur Resend importe le SDK resend',
    async () => {
      const files = sourceFiles(SRC)
      const contents = await Promise.all(
        files.map((file) => readFile(file, 'utf8'))
      )
      const importers = files.filter((_, index) =>
        IMPORTS_RESEND.test(contents[index])
      )

      expect(importers).toEqual([RESEND_ADAPTER])
    },
    SCAN_TIMEOUT_MS
  )
})
