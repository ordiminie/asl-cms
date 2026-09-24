import {existsSync, readdirSync} from 'node:fs'
import path from 'node:path'

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

  it('couvre les racines authentifiees et la route heritee des tarifs', () => {
    for (const segment of ['account', 'dashboard', 'pricing_old']) {
      expect(RESERVED_PAGE_SLUGS).toContain(segment)
    }
  })

  /**
   * Le garde-fou qui compte : la liste est confrontee au systeme de fichiers,
   * pas a un echantillon ecrit a la main. Toute story qui ajoute un segment
   * racine servi par `src/app/[locale]/` sans l'ajouter ici echoue ici, avant
   * de se decouvrir en production (ADR 020).
   */
  it('couvre tout segment racine reellement servi par src/app/[locale]', () => {
    const appRoot = path.resolve(import.meta.dirname, '../../../app/[locale]')

    const collectServedSegments = (directory: string): string[] => {
      const served: string[] = []

      for (const entry of readdirSync(directory, {withFileTypes: true})) {
        if (!entry.isDirectory()) continue

        // Groupe de routes : transparent dans l'URL, ses enfants sont a la racine.
        if (entry.name.startsWith('(')) {
          served.push(
            ...collectServedSegments(path.join(directory, entry.name))
          )
          continue
        }

        // Segment dynamique (`[slug]`) : ce n'est pas un nom reserve.
        if (entry.name.startsWith('[')) continue

        const segment = path.join(directory, entry.name)
        const isServed =
          existsSync(path.join(segment, 'page.tsx')) ||
          existsSync(path.join(segment, 'route.ts'))
        if (isServed) served.push(entry.name)
      }

      return served
    }

    const servedSegments = collectServedSegments(appRoot)

    expect(servedSegments.length).toBeGreaterThan(5)
    for (const segment of servedSegments) {
      expect(
        RESERVED_PAGE_SLUGS,
        `le segment /${segment} est servi par le socle mais absent de RESERVED_PAGE_SLUGS`
      ).toContain(segment)
    }
  })

  it('reconnaît un slug réservé quelle que soit la casse', () => {
    expect(isPageSlugReserved('bureau')).toBe(true)
    expect(isPageSlugReserved('BUREAU')).toBe(true)
    expect(isPageSlugReserved('qualite-de-leau')).toBe(false)
  })

  it('réserve le segment des actualités (s05)', () => {
    expect(isPageSlugReserved('actualites')).toBe(true)
  })

  it('réserve le segment de la présentation du bureau (s06)', () => {
    expect(isPageSlugReserved('le-bureau')).toBe(true)
  })
})
