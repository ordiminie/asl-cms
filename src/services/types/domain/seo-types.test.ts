import {getTableColumns} from 'drizzle-orm'
import {describe, expect, it} from 'vitest'

import {news} from '@/db/models/news-model'
import {page} from '@/db/models/page-model'

import {ASSOCIATION_DESCRIPTION_MAX_LENGTH} from './association-settings-types'
import {SEO_DESCRIPTION_MAX, SEO_TITLE_MAX} from './seo-types'

describe('plafonds du referencement (s11, decision J)', () => {
  it('titre 60, description 160 : valeurs d usage des moteurs', () => {
    expect(SEO_TITLE_MAX).toBe(60)
    expect(SEO_DESCRIPTION_MAX).toBe(160)
  })

  it('la description de l association suit le meme plafond', () => {
    expect(ASSOCIATION_DESCRIPTION_MAX_LENGTH).toBe(SEO_DESCRIPTION_MAX)
  })
})

describe('colonnes de referencement (s11)', () => {
  it('page : titre moteur, description, image de partage et son texte alternatif, toutes facultatives', () => {
    const columns = getTableColumns(page)
    for (const [field, name] of [
      ['seoTitle', 'seo_title'],
      ['seoDescription', 'seo_description'],
      ['shareImageKey', 'share_image_key'],
      ['shareImageAlt', 'share_image_alt'],
    ] as const) {
      expect(columns[field].name).toBe(name)
      expect(columns[field].notNull).toBe(false)
    }
  })

  it('actualite : une description facultative', () => {
    const columns = getTableColumns(news)
    expect(columns.seoDescription.name).toBe('seo_description')
    expect(columns.seoDescription.notNull).toBe(false)
  })
})
