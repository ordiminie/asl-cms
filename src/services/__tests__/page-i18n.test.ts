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
