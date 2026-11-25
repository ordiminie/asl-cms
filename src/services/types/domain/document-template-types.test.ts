import {describe, expect, it} from 'vitest'

import {
  DOCUMENT_TEMPLATE_EXTRA_VARIABLES,
  DOCUMENT_TEMPLATE_VARIABLES,
  documentTemplateFileNameOf,
} from './document-template-types'

describe('documentTemplateFileNameOf — aucune donnée nominative dans le nom', () => {
  it('rend document-jj-mm-aaaa.pdf depuis la date choisie', () => {
    expect(documentTemplateFileNameOf('2026-11-25')).toBe(
      'document-25-11-2026.pdf'
    )
  })
})

describe('DOCUMENT_TEMPLATE_VARIABLES — les variables des campagnes, plus {association}', () => {
  it('liste nom, parcelle, date et association', () => {
    expect(DOCUMENT_TEMPLATE_EXTRA_VARIABLES).toEqual(['association'])
    expect(DOCUMENT_TEMPLATE_VARIABLES).toEqual([
      'nom',
      'parcelle',
      'date',
      'association',
    ])
  })
})
