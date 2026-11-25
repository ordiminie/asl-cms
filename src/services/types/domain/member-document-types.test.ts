import {describe, expect, it} from 'vitest'

import {
  CATEGORY_DOMAINS,
  CategoryDomainConst,
} from './association-category-types'
import {
  CONTENT_FILE_SCOPES,
  isContentFileKeyAllowed,
} from './content-file-types'
import {
  buildMemberDocumentFileKey,
  isMemberDocumentKeyOf,
  MEMBER_DOCUMENT_KEY_PREFIX,
  MEMBER_DOCUMENT_TITLE_MAX_LENGTH,
  memberDocumentDownloadName,
  memberDocumentFolderOf,
} from './member-document-types'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const PROFILE_ID = 'a1200000-0000-4000-8000-000000000001'
const OTHER_PROFILE_ID = 'a1200000-0000-4000-8000-000000000002'
const DOCUMENT_ID = '33333333-3333-4333-8333-333333333333'

describe('buildMemberDocumentFileKey — un dossier par fiche (ADR 073 §2)', () => {
  it('range le PDF dans le dossier de la fiche, sous un nom non devinable', () => {
    const key = buildMemberDocumentFileKey(ORG_ID, PROFILE_ID, DOCUMENT_ID)

    expect(MEMBER_DOCUMENT_KEY_PREFIX).toBe('member-documents')
    expect(key).toMatch(
      new RegExp(
        `^${ORG_ID}/member-documents/${PROFILE_ID}/${DOCUMENT_ID}-[0-9a-f-]{36}\\.pdf$`
      )
    )
  })

  it('génère une clé différente à chaque dépôt', () => {
    expect(
      buildMemberDocumentFileKey(ORG_ID, PROFILE_ID, DOCUMENT_ID)
    ).not.toBe(buildMemberDocumentFileKey(ORG_ID, PROFILE_ID, DOCUMENT_ID))
  })

  it('range la clé dans le dossier rendu par memberDocumentFolderOf', () => {
    const key = buildMemberDocumentFileKey(ORG_ID, PROFILE_ID, DOCUMENT_ID)

    expect(memberDocumentFolderOf(ORG_ID, PROFILE_ID)).toBe(
      `${ORG_ID}/member-documents/${PROFILE_ID}`
    )
    expect(
      key.startsWith(`${memberDocumentFolderOf(ORG_ID, PROFILE_ID)}/`)
    ).toBe(true)
  })

  it.each([
    ['association', 'not-a-uuid', PROFILE_ID, DOCUMENT_ID],
    ['fiche', ORG_ID, '../../etc', DOCUMENT_ID],
    ['fiche vide', ORG_ID, '', DOCUMENT_ID],
    ['document', ORG_ID, PROFILE_ID, `${DOCUMENT_ID}/..`],
    ['document forgé', ORG_ID, PROFILE_ID, '..%2F..%2Fpasswd'],
  ])(
    "refuse un identifiant de %s qui n'est pas un uuid",
    (_, org, profile, doc) => {
      expect(() => buildMemberDocumentFileKey(org, profile, doc)).toThrow()
    }
  )

  it.each([
    ['association', 'x', PROFILE_ID],
    ['fiche', ORG_ID, '..'],
  ])(
    "le dossier refuse un identifiant de %s qui n'est pas un uuid",
    (_, org, profile) => {
      expect(() => memberDocumentFolderOf(org, profile)).toThrow()
    }
  )
})

describe('isMemberDocumentKeyOf — cohérence clé ↔ fiche (ADR 073 §4.3)', () => {
  const key = buildMemberDocumentFileKey(ORG_ID, PROFILE_ID, DOCUMENT_ID)
  const folder = `${ORG_ID}/member-documents/${PROFILE_ID}`

  it('accepte la clé générée pour cette fiche', () => {
    expect(isMemberDocumentKeyOf(key, ORG_ID, PROFILE_ID)).toBe(true)
  })

  it("refuse la clé d'une autre fiche", () => {
    expect(isMemberDocumentKeyOf(key, ORG_ID, OTHER_PROFILE_ID)).toBe(false)
  })

  it("refuse la clé d'une autre association", () => {
    expect(isMemberDocumentKeyOf(key, OTHER_ORG_ID, PROFILE_ID)).toBe(false)
  })

  it.each([
    ['remontée', `${folder}/../${OTHER_PROFILE_ID}/${DOCUMENT_ID}-x.pdf`],
    ['séparateur encodé', `${folder}/..%2F${OTHER_PROFILE_ID}%2Fdoc.pdf`],
    ['barre inverse', `${folder}/..\\${OTHER_PROFILE_ID}\\doc.pdf`],
    ['octet nul', `${folder}/${DOCUMENT_ID}-x.pdf\0.txt`],
    ['sous-dossier', `${folder}/sub/${DOCUMENT_ID}-x.pdf`],
    ['nom vide', `${folder}/`],
    ['préfixe seul', folder],
    ['préfixe voisin', `${folder}0/${DOCUMENT_ID}-x.pdf`],
    [
      'autre portée',
      `${ORG_ID}/shared-documents/${PROFILE_ID}/${DOCUMENT_ID}.pdf`,
    ],
    ['autre extension', key.replace(/\.pdf$/, '.html')],
  ])('refuse une clé avec %s', (_, forged) => {
    expect(isMemberDocumentKeyOf(forged, ORG_ID, PROFILE_ID)).toBe(false)
  })

  it('refuse des identifiants qui ne sont pas des uuid', () => {
    expect(isMemberDocumentKeyOf(key, 'x', PROFILE_ID)).toBe(false)
    expect(isMemberDocumentKeyOf(key, ORG_ID, '..')).toBe(false)
  })
})

describe('garde — les documents nominatifs ne sont jamais servis par /api/files', () => {
  it("member-documents n'est pas une portée de CONTENT_FILE_SCOPES", () => {
    expect(CONTENT_FILE_SCOPES as readonly string[]).not.toContain(
      MEMBER_DOCUMENT_KEY_PREFIX
    )
  })

  it('isContentFileKeyAllowed refuse une clé nominative', () => {
    const key = buildMemberDocumentFileKey(ORG_ID, PROFILE_ID, DOCUMENT_ID)

    expect(isContentFileKeyAllowed(ORG_ID, key)).toBe(false)
  })
})

describe('plafond du titre', () => {
  it('est de 120 caractères', () => {
    expect(MEMBER_DOCUMENT_TITLE_MAX_LENGTH).toBe(120)
  })
})

describe('memberDocumentDownloadName — nom du téléchargement, ASCII seul', () => {
  it('tire le nom du titre, sans accent ni apostrophe', () => {
    expect(memberDocumentDownloadName("Facture d'eau 2026 — été")).toBe(
      'Facture-d-eau-2026-ete.pdf'
    )
  })

  it('ne laisse passer ni guillemet, ni barre, ni retour à la ligne', () => {
    expect(memberDocumentDownloadName('a"b\\c/d\r\ne;f')).toMatch(
      /^[A-Za-z0-9._-]+\.pdf$/
    )
  })

  it('rend un nom par défaut pour un titre sans caractère utilisable', () => {
    expect(memberDocumentDownloadName('« »')).toBe('document.pdf')
  })
})

describe('catégories — domaine des documents nominatifs (ADR 073 §9)', () => {
  it('est un domaine propre, distinct des documents partagés', () => {
    expect(CategoryDomainConst.MEMBER_DOCUMENT).toBe('member_document')
    expect(CATEGORY_DOMAINS).toContain(CategoryDomainConst.MEMBER_DOCUMENT)
    expect(CategoryDomainConst.MEMBER_DOCUMENT).not.toBe(
      CategoryDomainConst.DOCUMENT
    )
  })
})
