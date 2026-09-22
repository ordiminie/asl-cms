import {describe, expect, it} from 'vitest'

import en from '../../../messages/en.json'
import es from '../../../messages/es.json'
import fr from '../../../messages/fr.json'

/**
 * Les catalogues restent complets dans les trois langues, meme si le produit
 * ne sert que le francais (ADR 008) : une cle presente d'un seul cote se
 * decouvre autrement le jour ou une locale est rouverte, jamais avant.
 */
const flatKeys = (value: unknown, prefix = ''): string[] => {
  if (typeof value !== 'object' || value === null) return [prefix]

  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => flatKeys(child, prefix ? `${prefix}.${key}` : key)
  )
}

const catalogs = {en, es} as const

/**
 * Les sept espaces de noms introduits par s04. La garde porte sur tous, pas
 * seulement sur les deux plus gros : une chaine recopiee du francais s'etait
 * glissee dans SortableList, hors du perimetre trop etroit de la garde.
 */
const translatedNamespaces = [
  'PublicCmsPage',
  'PreviewBar',
  'SortableList',
  'BlockPicker',
  'RestrictedMarkdownEditor',
  'PageBlocks',
  'BureauPagesPage',
] as const

/**
 * Deux libelles anglais coincident mot pour mot avec le francais : ce sont les
 * traductions justes, pas des copies oubliees. Les nommer un par un garde la
 * garde stricte sur les 109 autres valeurs.
 */
const identicalByTranslation = new Set([
  'en:BureauPagesPage.title',
  'en:BureauPagesPage.columns.actions',
])

const flatEntries = (value: unknown, prefix = ''): [string, unknown][] =>
  typeof value !== 'object' || value === null
    ? [[prefix, value]]
    : Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
        flatEntries(child, prefix ? `${prefix}.${key}` : key)
      )

describe('catalogues de messages des pages CMS (s04)', () => {
  for (const namespace of [
    'PublicCmsPage',
    'BureauPagesPage',
    'RestrictedMarkdownEditor',
  ] as const) {
    it(`${namespace} porte les memes cles en fr, en et es`, () => {
      const expected = flatKeys(
        (fr as Record<string, unknown>)[namespace]
      ).sort()

      expect(expected.length).toBeGreaterThan(0)

      for (const [locale, catalog] of Object.entries(catalogs)) {
        const actual = flatKeys(
          (catalog as Record<string, unknown>)[namespace]
        ).sort()
        expect(actual, `${namespace} incomplet en ${locale}`).toEqual(expected)
      }
    })
  }

  for (const namespace of translatedNamespaces) {
    it(`${namespace} est reellement traduit en en et es, pas recopie du fr`, () => {
      const french = flatEntries((fr as Record<string, unknown>)[namespace])
      expect(french.length).toBeGreaterThan(0)

      for (const [locale, catalog] of Object.entries(catalogs)) {
        const translated = new Map(
          flatEntries((catalog as Record<string, unknown>)[namespace])
        )
        const copied = french
          .filter(
            ([key, value]) =>
              translated.get(key) === value &&
              !identicalByTranslation.has(`${locale}:${namespace}.${key}`)
          )
          .map(([key]) => key)

        expect(copied, `${namespace} recopie du francais en ${locale}`).toEqual(
          []
        )
      }
    })

    it(`${namespace} garde les memes variables d'interpolation`, () => {
      const placeholders = (value: unknown) =>
        typeof value === 'string' ? (value.match(/{[^}]+}/g) ?? []).sort() : []

      for (const [key, value] of flatEntries(
        (fr as Record<string, unknown>)[namespace]
      )) {
        for (const [locale, catalog] of Object.entries(catalogs)) {
          const translated = new Map(
            flatEntries((catalog as Record<string, unknown>)[namespace])
          )
          expect(
            placeholders(translated.get(key)),
            `${namespace}.${key} en ${locale}`
          ).toEqual(placeholders(value))
        }
      }
    })
  }

  it("l'apercu du bureau annonce le brouillon et la depublication", () => {
    for (const catalog of [fr, en, es] as Record<string, unknown>[]) {
      const namespace = catalog.PublicCmsPage as
        Record<string, string> | undefined
      expect(namespace?.previewDraft).toBeTruthy()
      expect(namespace?.previewUnpublished).toBeTruthy()
    }
  })

  it("l'echec de creation d'une page a son message dans les trois langues", () => {
    for (const catalog of [fr, en, es] as Record<string, unknown>[]) {
      const errors = (
        catalog.BureauPagesPage as {errors?: Record<string, string>}
      )?.errors
      expect(errors?.createFailedTitle).toBeTruthy()
      expect(errors?.createFailed).toBeTruthy()
    }
  })
})
