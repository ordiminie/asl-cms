import {readdirSync, readFileSync} from 'node:fs'
import path from 'node:path'

import {describe, expect, it} from 'vitest'

import fr from '../../../messages/fr.json'

/**
 * Le produit ne sert que le francais (ADR 008, s43) : `messages/fr.json` est
 * le seul catalogue. Les gardes de parite fr/en/es ont perdu leur objet avec
 * les fichiers ; il reste a verifier que chaque espace de noms attendu existe
 * et n'est pas vide.
 */
const flatEntries = (value: unknown, prefix = ''): [string, unknown][] =>
  typeof value !== 'object' || value === null
    ? [[prefix, value]]
    : Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
        flatEntries(child, prefix ? `${prefix}.${key}` : key)
      )

/** Le seul gabarit de cle du formulaire : `fields.${field}.label`. */
const FIELD_PLACEHOLDER = /\$\{field\}/

const repositoryRoot = path.resolve(import.meta.dirname, '../../..')

/** Les espaces de noms introduits par s04, s05 et s09. */
const pageNamespaces = [
  'PublicCmsPage',
  'PreviewBar',
  'SortableList',
  'BlockPicker',
  'RestrictedMarkdownEditor',
  'PageBlocks',
  'BureauPagesPage',
  'BureauNewsPage',
  'PublicNewsPage',
  'BureauWaterAnalysisPage',
  'PublicWaterAnalysisPage',
] as const

describe('catalogue unique de messages (ADR 008, s43)', () => {
  it('messages/ ne contient plus que le francais', () => {
    expect(
      readdirSync(path.join(repositoryRoot, 'messages')).filter((file) =>
        file.endsWith('.json')
      )
    ).toEqual(['fr.json'])
  })

  /*
   * Preuve consignee avant le retrait de en.json : treize cles ContactPage
   * n'existaient qu'en anglais (card.*, fields.*.placeholder, validation
   * subjectMin/subjectMax/contentMin, errors.server/allFieldsRequired/
   * subjectRange/contentRange/emailInvalid). Aucun appel ne les vise : la
   * seule cle construite du formulaire est `fields.${field}.label`. Ce test
   * relit les sources du contact et exige que chaque cle appelee existe en
   * francais.
   */
  it('chaque cle ContactPage appelee par le formulaire de contact existe en francais', () => {
    const contactDirectory = path.join(
      repositoryRoot,
      'src/app/[locale]/(public)/contact'
    )
    const sources = readdirSync(contactDirectory)
      .filter((file) => /\.tsx?$/.test(file) && !file.includes('.test.'))
      .map((file) => readFileSync(path.join(contactDirectory, file), 'utf8'))
      .join('\n')

    const literalKeys = [...sources.matchAll(/\bt\(\s*'([^']+)'/g)].map(
      ([, key]) => key
    )
    const templateKeys = [...sources.matchAll(/\bt\(\s*`([^`]+)`/g)].map(
      ([, key]) => key
    )
    const fieldKeys = templateKeys.flatMap((template) =>
      ['name', 'email', 'subject', 'content'].map((field) =>
        template.replace(FIELD_PLACEHOLDER, field)
      )
    )

    const french = new Map(
      flatEntries((fr as Record<string, unknown>).ContactPage)
    )
    expect(literalKeys.length).toBeGreaterThan(0)
    expect(templateKeys).toHaveLength(1)
    expect(templateKeys[0]).toMatch(/^fields\.\$\{field\}\.label$/)
    for (const key of [...literalKeys, ...fieldKeys]) {
      expect(french.get(key), `ContactPage.${key}`).toEqual(expect.any(String))
    }
  })

  for (const namespace of pageNamespaces) {
    it(`${namespace} existe en francais et n'est pas vide`, () => {
      const entries = flatEntries((fr as Record<string, unknown>)[namespace])
      expect(entries.length).toBeGreaterThan(0)
      for (const [key, value] of entries) {
        expect(value, `${namespace}.${key}`).toEqual(expect.any(String))
        expect((value as string).trim(), `${namespace}.${key}`).not.toBe('')
      }
    })
  }

  it("l'apercu du bureau annonce le brouillon et la depublication", () => {
    const namespace = fr.PublicCmsPage as Record<string, string> | undefined
    expect(namespace?.previewDraft).toBeTruthy()
    expect(namespace?.previewUnpublished).toBeTruthy()
  })

  it("l'echec de creation d'une page a son message", () => {
    const errors = (fr.BureauPagesPage as {errors?: Record<string, string>})
      ?.errors
    expect(errors?.createFailedTitle).toBeTruthy()
    expect(errors?.createFailed).toBeTruthy()
  })
})
