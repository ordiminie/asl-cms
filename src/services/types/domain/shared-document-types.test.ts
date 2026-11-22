import {describe, expect, it} from 'vitest'

import {
  buildSharedDocumentFileKey,
  SHARED_DOCUMENT_KEY_PREFIX,
  SHARED_DOCUMENT_TITLE_MAX_LENGTH,
  sharedDocumentDownloadName,
} from './shared-document-types'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const DOCUMENT_ID = '33333333-3333-4333-8333-333333333333'

describe('buildSharedDocumentFileKey — clé générée par le serveur (ADR 069)', () => {
  it("range le PDF sous le préfixe de l'association et du document", () => {
    const key = buildSharedDocumentFileKey(ORG_ID, DOCUMENT_ID)

    expect(SHARED_DOCUMENT_KEY_PREFIX).toBe('shared-documents')
    expect(key).toMatch(
      new RegExp(
        `^${ORG_ID}/shared-documents/${DOCUMENT_ID}/file-[0-9a-f-]{36}\\.pdf$`
      )
    )
  })

  it('génère une clé différente à chaque dépôt', () => {
    expect(buildSharedDocumentFileKey(ORG_ID, DOCUMENT_ID)).not.toBe(
      buildSharedDocumentFileKey(ORG_ID, DOCUMENT_ID)
    )
  })

  it.each([
    ['association', 'not-a-uuid', DOCUMENT_ID],
    ['document', ORG_ID, '../../etc'],
    ['document vide', ORG_ID, ''],
  ])('refuse un identifiant de %s qui n est pas un uuid', (_, org, doc) => {
    expect(() => buildSharedDocumentFileKey(org, doc)).toThrow()
  })
})

describe('plafond du titre', () => {
  it('est de 120 caractères', () => {
    expect(SHARED_DOCUMENT_TITLE_MAX_LENGTH).toBe(120)
  })
})

describe('sharedDocumentDownloadName — nom du téléchargement, ASCII seul', () => {
  it('tire le nom du titre, sans accent ni apostrophe', () => {
    expect(
      sharedDocumentDownloadName("Procès-verbal de l'AG du 14 juin 2025")
    ).toBe('Proces-verbal-de-l-AG-du-14-juin-2025.pdf')
  })

  it('ne laisse passer ni guillemet, ni barre, ni retour à la ligne', () => {
    const name = sharedDocumentDownloadName('a"b\\c/d\r\ne;f')

    expect(name).toMatch(/^[A-Za-z0-9._-]+\.pdf$/)
  })

  it('rend un nom par défaut pour un titre sans caractère utilisable', () => {
    expect(sharedDocumentDownloadName('« »')).toBe('document.pdf')
  })

  it('borne la longueur du nom', () => {
    expect(
      sharedDocumentDownloadName('a'.repeat(300)).length
    ).toBeLessThanOrEqual(84)
  })
})
