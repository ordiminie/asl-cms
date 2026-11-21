import {describe, expect, it, vi} from 'vitest'

import {letterAddressFitsWindow} from './letter-address-measure.server'
import type {LetterDocument} from './letter-pdf-document'

vi.mock('server-only', () => ({}))

const measuringDocuments = vi.hoisted((): LetterDocument[] => [])

vi.mock('./letter-pdf-document', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./letter-pdf-document')>()
  return {
    ...original,
    createLetterDocument: (
      ...args: Parameters<typeof original.createLetterDocument>
    ) => {
      const doc = original.createLetterDocument(...args)
      measuringDocuments.push(doc)
      return doc
    },
  }
})

type FontWithCache = {layoutCache?: Record<string, unknown>}

describe('letterAddressFitsWindow — aucun cache de mise en page (m5)', () => {
  it('les mots des adresses mesurées ne s’accumulent pas dans le document de mesure', () => {
    letterAddressFitsWindow(['Marcel Laurent', '4 rue des Lilas', '69003 Lyon'])
    letterAddressFitsWindow(['Hélène Roy', '9 rue Haute', '07140 Les Vans'])

    expect(measuringDocuments.length).toBeGreaterThan(0)
    for (const doc of measuringDocuments) {
      const font = (doc as unknown as {_font?: FontWithCache})._font
      expect(font).toBeDefined()
      expect(Object.keys(font?.layoutCache ?? {})).toHaveLength(0)
    }
  })
})

describe('letterAddressFitsWindow — mesure sur la police embarquée (M1)', () => {
  it('une adresse ordinaire, ou coupable après une virgule, tient', () => {
    expect(
      letterAddressFitsWindow([
        'Marcel Laurent',
        '4 rue des Lilas',
        '69003 Lyon',
      ])
    ).toBe(true)
    expect(
      letterAddressFitsWindow([
        'Marcel Laurent',
        'Lotissement Les Hauts de la Fourche, Bâtiment B, Esc. 3',
        '07140 Les Vans',
      ])
    ).toBe(true)
  })

  it('une ligne sans virgule plus large que le cadre à 10 pt ne tient pas', () => {
    expect(
      letterAddressFitsWindow([
        'Société civile immobilière des propriétaires du domaine de la Fourche',
        '07140 Les Vans',
      ])
    ).toBe(false)
  })
})
