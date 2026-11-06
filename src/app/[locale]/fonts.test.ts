import fs from 'node:fs'
import path from 'node:path'

import {describe, expect, it} from 'vitest'

/**
 * Garde de s51 (ADR 046) : les polices sont servies depuis le depot. Un import
 * du loader Google ferait de nouveau dependre le build de fonts.googleapis.com.
 */

const SRC_DIR = path.resolve(import.meta.dirname, '../..')
const FONTS_DIR = path.resolve(import.meta.dirname, 'fonts')

const FAMILIES = ['public-sans', 'source-serif-4', 'jetbrains-mono']

const GOOGLE_FONT_IMPORT =
  /^\s*import\s+(?:[^'"]*\s+from\s+)?['"]next\/font\/google['"]/m

const sourceFilesOf = (dir: string): string[] =>
  fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFilesOf(fullPath)
    return /\.tsx?$/.test(entry.name) ? [fullPath] : []
  })

describe('polices hebergees avec le site (s51)', () => {
  it('aucun fichier de src n’importe next/font/google', () => {
    const offenders = sourceFilesOf(SRC_DIR)
      .filter((file) => GOOGLE_FONT_IMPORT.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_DIR, file))

    expect(offenders).toEqual([])
  }, 15_000)

  it('ne confond pas l’import d’Analytics avec celui des polices', () => {
    expect(
      GOOGLE_FONT_IMPORT.test(
        "import {GoogleAnalytics} from '@next/third-parties/google'"
      )
    ).toBe(false)
    expect(
      GOOGLE_FONT_IMPORT.test("import {Inter} from 'next/font/google'")
    ).toBe(true)
  })

  it.each(FAMILIES)(
    'livre le woff2 latin et la licence OFL de %s',
    (family) => {
      const font = path.join(FONTS_DIR, `${family}-latin.woff2`)
      const licence = path.join(FONTS_DIR, `${family}-OFL.txt`)

      expect(fs.readFileSync(font).subarray(0, 4).toString('latin1')).toBe(
        'wOF2'
      )
      expect(fs.readFileSync(licence, 'utf8')).toContain(
        'SIL OPEN FONT LICENSE Version 1.1'
      )
    }
  )
})
