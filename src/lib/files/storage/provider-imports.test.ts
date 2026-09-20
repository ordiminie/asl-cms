import fs from 'node:fs'
import {readFile} from 'node:fs/promises'
import path from 'node:path'

import {describe, expect, it} from 'vitest'

const SRC = path.resolve(import.meta.dirname, '../../..')

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(fullPath)
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [fullPath]
      : []
  })

const IMPORTS_SUPABASE =
  /from\s+['"]@supabase\/[^'"]+['"]|import\(\s*['"]@supabase\/[^'"]+['"]\s*\)/

/** Lecture de tout `src/` : lente sur un disque monte, d'ou le delai explicite. */
const SCAN_TIMEOUT_MS = 30_000

describe('ADR 004 — les fichiers vivent sur le disque du serveur', () => {
  it(
    'aucun module de src n’importe un SDK Supabase',
    async () => {
      const files = sourceFiles(SRC)
      const contents = await Promise.all(
        files.map((file) => readFile(file, 'utf8'))
      )
      const importers = files.filter((_, index) =>
        IMPORTS_SUPABASE.test(contents[index])
      )

      expect(importers).toEqual([])
    },
    SCAN_TIMEOUT_MS
  )
})
