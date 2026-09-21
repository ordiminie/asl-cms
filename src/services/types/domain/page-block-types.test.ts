import {describe, expect, it} from 'vitest'

import {
  isPageSlugReserved,
  pageBlockSchema,
  PageBlockTypeConst,
  RESERVED_PAGE_SLUGS,
} from './page-block-types'

describe('pageBlockSchema', () => {
  it('accepte les cinq types de blocs du design system', () => {
    const blocks = [
      {type: PageBlockTypeConst.TEXT, markdown: 'Bonjour'},
      {
        type: PageBlockTypeConst.IMAGE,
        fileKey: 'org/pages/p/a.webp',
        alt: 'Une photo',
        caption: 'Légende',
      },
      {
        type: PageBlockTypeConst.PDF,
        fileKey: 'org/pages/p/a.pdf',
        title: 'Compte rendu',
      },
      {
        type: PageBlockTypeConst.GALLERY,
        images: [{fileKey: 'org/pages/p/a.webp', alt: 'Une photo'}],
      },
      {
        type: PageBlockTypeConst.CALLOUT,
        title: 'Bon à savoir',
        markdown: 'Le portail est fermé le dimanche.',
      },
    ]

    for (const block of blocks) {
      expect(pageBlockSchema.safeParse(block).success).toBe(true)
    }
  })

  it('refuse un type de bloc absent du schéma', () => {
    const parsed = pageBlockSchema.safeParse({
      type: 'carrousel-2019',
      slides: [],
    })

    expect(parsed.success).toBe(false)
  })

  it('accepte un brouillon incomplet : image sans alt, PDF sans titre', () => {
    expect(
      pageBlockSchema.safeParse({
        type: PageBlockTypeConst.IMAGE,
        fileKey: null,
        alt: '',
        caption: '',
      }).success
    ).toBe(true)
    expect(
      pageBlockSchema.safeParse({
        type: PageBlockTypeConst.PDF,
        fileKey: null,
        title: '',
      }).success
    ).toBe(true)
  })
})

describe('slugs réservés (ADR 020)', () => {
  it('expose une liste non vide de segments du socle', () => {
    expect(RESERVED_PAGE_SLUGS.length).toBeGreaterThan(0)
    for (const slug of RESERVED_PAGE_SLUGS) {
      expect(slug).not.toBe('')
    }
  })

  it('couvre les segments techniques servis à la racine', () => {
    for (const segment of [
      'admin',
      'api',
      'blog',
      'bureau',
      'docs',
      'login',
      'modules',
    ]) {
      expect(RESERVED_PAGE_SLUGS).toContain(segment)
    }
  })

  it('reconnaît un slug réservé quelle que soit la casse', () => {
    expect(isPageSlugReserved('bureau')).toBe(true)
    expect(isPageSlugReserved('BUREAU')).toBe(true)
    expect(isPageSlugReserved('qualite-de-leau')).toBe(false)
  })
})
