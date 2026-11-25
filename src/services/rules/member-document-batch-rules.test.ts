import {describe, expect, it} from 'vitest'

import {referenceOfBatchFileName} from './member-document-batch-rules'

const REFERENCE = '3f2a9c10-1b2c-4d3e-8f40-5a6b7c8d9e0f'

describe('referenceOfBatchFileName — la fiche se trouve par le début du nom (ADR 073 §8)', () => {
  it('rend la partie qui précède le premier « _ »', () => {
    expect(referenceOfBatchFileName(`${REFERENCE}_facture-2026.pdf`)).toBe(
      REFERENCE
    )
  })

  it("s'arrête au premier « _ », pas au dernier", () => {
    expect(referenceOfBatchFileName(`${REFERENCE}_facture_eau_2026.pdf`)).toBe(
      REFERENCE
    )
  })

  it('compare sans casse', () => {
    expect(
      referenceOfBatchFileName(`${REFERENCE.toUpperCase()}_facture.pdf`)
    ).toBe(REFERENCE)
  })

  it('retire les espaces', () => {
    expect(referenceOfBatchFileName(`  ${REFERENCE} _facture.pdf`)).toBe(
      REFERENCE
    )
    expect(referenceOfBatchFileName('3f2a 9c10_facture.pdf')).toBe('3f2a9c10')
  })

  it('ne rend rien pour un nom sans « _ »', () => {
    expect(referenceOfBatchFileName(`${REFERENCE}.pdf`)).toBeUndefined()
  })

  it('ne rend rien pour un nom vide', () => {
    expect(referenceOfBatchFileName('')).toBeUndefined()
    expect(referenceOfBatchFileName('   ')).toBeUndefined()
  })

  it('ne rend rien quand le nom commence par « _ »', () => {
    expect(referenceOfBatchFileName('_facture.pdf')).toBeUndefined()
    expect(referenceOfBatchFileName('  _facture.pdf')).toBeUndefined()
  })
})
