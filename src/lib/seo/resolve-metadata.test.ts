import {describe, expect, it} from 'vitest'

import {
  AssociationSeoContext,
  excerptOf,
  resolveFixedPageSeo,
  resolveNewsSeo,
  resolvePageSeo,
  shareImageFallbackUrl,
  shareImageNameKey,
  toPageMetadata,
} from './resolve-metadata'

const ORIGIN = 'https://lesamisdeletang.fr'
const ORG_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_ID = '33333333-3333-4333-8333-333333333333'
const SHARE_KEY = `${ORG_ID}/pages/${PAGE_ID}/share-66666666-6666-4666-8666-666666666666.webp`
const NEWS_KEY = `${ORG_ID}/news/${PAGE_ID}/image-66666666-6666-4666-8666-666666666666.webp`

const association = (
  overrides: Partial<AssociationSeoContext> = {}
): AssociationSeoContext => ({
  name: 'Les Amis de l’Étang',
  description: 'Association syndicale libre du domaine de l’Étang.',
  logoVersion: 'abc123',
  hue: 195,
  origin: ORIGIN,
  ...overrides,
})

const cmsPage = (overrides: Record<string, unknown> = {}) => ({
  slug: 'qualite-de-l-eau',
  title: 'Qualité de l’eau',
  seoTitle: null,
  seoDescription: null,
  shareImageKey: null,
  shareImageAlt: null,
  ...overrides,
})

const newsItem = (overrides: Record<string, unknown> = {}) => ({
  slug: 'fete-de-l-etang',
  title: 'Fête de l’étang : rendez-vous le 12 octobre',
  content: 'Le samedi 12 octobre, retrouvons-nous au bord de l’étang.',
  seoDescription: null,
  imageKey: null,
  imageAlt: '',
  ...overrides,
})

const NAME_KEY = shareImageNameKey('Les Amis de l’Étang')
const FALLBACK_IMAGE = `${ORIGIN}/api/identity/share-image?v=abc123&h=195&n=${NAME_KEY}`

describe('shareImageFallbackUrl — image de repli generee', () => {
  it('absolue sur l origine, cle = version du logo + teinte + nom', () => {
    expect(shareImageFallbackUrl(association())).toBe(FALLBACK_IMAGE)
  })

  it('sans logo, la teinte et le nom', () => {
    expect(shareImageFallbackUrl(association({logoVersion: undefined}))).toBe(
      `${ORIGIN}/api/identity/share-image?h=195&n=${NAME_KEY}`
    )
  })

  it('un renommage change l adresse, donc le cache long (revue s11, m3)', () => {
    expect(
      shareImageFallbackUrl(association({name: 'Les Amis du Lac'}))
    ).not.toBe(FALLBACK_IMAGE)
    expect(shareImageNameKey('Les Amis de l’Étang')).toBe(NAME_KEY)
    expect(NAME_KEY).toMatch(/^[0-9a-z]{1,8}$/)
  })
})

describe('resolvePageSeo — page CMS', () => {
  it('titre moteur, description, image et texte alternatif du bureau quand renseignes', () => {
    expect(
      resolvePageSeo(
        cmsPage({
          seoTitle: 'Qualité de l’eau : analyses',
          seoDescription: 'Résultats des analyses du réseau.',
          shareImageKey: SHARE_KEY,
          shareImageAlt: 'Prélèvement au robinet',
        }),
        association()
      )
    ).toEqual({
      title: 'Qualité de l’eau : analyses',
      description: 'Résultats des analyses du réseau.',
      image: {
        url: `${ORIGIN}/api/files/${ORG_ID}/pages/${PAGE_ID}/share-66666666-6666-4666-8666-666666666666.webp`,
        alt: 'Prélèvement au robinet',
      },
      canonical: `${ORIGIN}/qualite-de-l-eau`,
    })
  })

  it('titre vide : le titre de la page', () => {
    expect(resolvePageSeo(cmsPage(), association()).title).toBe(
      'Qualité de l’eau'
    )
  })

  it('description vide : la description de l association', () => {
    expect(resolvePageSeo(cmsPage(), association()).description).toBe(
      'Association syndicale libre du domaine de l’Étang.'
    )
  })

  it('description vide, association sans description : aucune description, jamais une chaine vide', () => {
    const seo = resolvePageSeo(cmsPage(), association({description: null}))
    expect(seo).not.toHaveProperty('description')
  })

  it('description blanche traitee comme vide', () => {
    const seo = resolvePageSeo(
      cmsPage({seoDescription: '   '}),
      association({description: '  '})
    )
    expect(seo).not.toHaveProperty('description')
  })

  it('sans image : l image de repli, avec le nom de l association en texte alternatif', () => {
    expect(resolvePageSeo(cmsPage(), association()).image).toEqual({
      url: FALLBACK_IMAGE,
      alt: 'Les Amis de l’Étang',
    })
  })

  it('image sans texte alternatif : le nom de l association', () => {
    expect(
      resolvePageSeo(
        cmsPage({shareImageKey: SHARE_KEY, shareImageAlt: null}),
        association()
      ).image.alt
    ).toBe('Les Amis de l’Étang')
  })
})

describe('resolveNewsSeo — actualite', () => {
  it('titre de l actualite, description du bureau, image de l actualite et son texte alternatif', () => {
    expect(
      resolveNewsSeo(
        newsItem({
          seoDescription: 'Pique-nique et balade.',
          imageKey: NEWS_KEY,
          imageAlt: 'L’étang au printemps',
        }),
        association()
      )
    ).toEqual({
      title: 'Fête de l’étang : rendez-vous le 12 octobre',
      description: 'Pique-nique et balade.',
      image: {
        url: `${ORIGIN}/api/files/${ORG_ID}/news/${PAGE_ID}/image-66666666-6666-4666-8666-666666666666.webp`,
        alt: 'L’étang au printemps',
      },
      canonical: `${ORIGIN}/actualites/fete-de-l-etang`,
    })
  })

  it('description vide : le debut du texte', () => {
    expect(resolveNewsSeo(newsItem(), association()).description).toBe(
      'Le samedi 12 octobre, retrouvons-nous au bord de l’étang.'
    )
  })

  it('description et texte vides : aucune description', () => {
    expect(
      resolveNewsSeo(newsItem({content: '  '}), association())
    ).not.toHaveProperty('description')
  })

  it('sans image : l image de repli et le nom de l association', () => {
    expect(resolveNewsSeo(newsItem(), association()).image).toEqual({
      url: FALLBACK_IMAGE,
      alt: 'Les Amis de l’Étang',
    })
  })
})

describe('resolveFixedPageSeo — pages a adresse fixe et accueil', () => {
  it('libelle de la page, description de l association, image de repli, adresse sans prefixe', () => {
    expect(
      resolveFixedPageSeo(
        {path: '/analyses-eau', title: 'Analyses d’eau'},
        association()
      )
    ).toEqual({
      title: 'Analyses d’eau',
      description: 'Association syndicale libre du domaine de l’Étang.',
      image: {url: FALLBACK_IMAGE, alt: 'Les Amis de l’Étang'},
      canonical: `${ORIGIN}/analyses-eau`,
    })
  })

  it('accueil : adresse racine', () => {
    expect(
      resolveFixedPageSeo(
        {path: '/', title: 'Les Amis de l’Étang'},
        association()
      ).canonical
    ).toBe(`${ORIGIN}/`)
  })

  it('association sans description : aucune description', () => {
    expect(
      resolveFixedPageSeo(
        {path: '/contact', title: 'Contact'},
        association({description: null})
      )
    ).not.toHaveProperty('description')
  })
})

describe('excerptOf — debut du texte', () => {
  it('rend du texte brut, sans titre, gras, lien ni image markdown', () => {
    const excerpt = excerptOf(
      '## Ordre du jour\n\nUn **point** _important_ : voir [le compte rendu](/cr).\n\n![photo](/x.png)\n\n- vote du budget',
      160
    )
    expect(excerpt).toBe(
      'Ordre du jour Un point important : voir le compte rendu. vote du budget'
    )
    expect(excerpt).not.toMatch(/[#*_[\]()]/)
  })

  it('ne coupe jamais un mot, et tient dans la longueur demandee', () => {
    const words = Array.from({length: 60}, (_, index) => `mot${index}`)
    const excerpt = excerptOf(words.join(' '), 160) ?? ''

    expect(excerpt.length).toBeLessThanOrEqual(160)
    expect(excerpt.endsWith('…')).toBe(true)
    for (const word of excerpt.replace('…', '').trim().split(' ')) {
      expect(words).toContain(word)
    }
  })

  it('un texte court est rendu entier, sans points de suspension', () => {
    expect(excerptOf('Court.', 160)).toBe('Court.')
  })

  it('un texte vide ne donne rien', () => {
    expect(excerptOf('  \n ', 160)).toBeUndefined()
  })
})

describe('toPageMetadata — metadonnees Next completes', () => {
  const seo = {
    title: 'Qualité de l’eau',
    description: 'Résultats des analyses.',
    image: {url: `${ORIGIN}/api/files/x.webp`, alt: 'Prélèvement'},
    canonical: `${ORIGIN}/qualite-de-l-eau`,
  }

  it('titre, description, canonique, partage et carte large', () => {
    expect(toPageMetadata(seo, 'Les Amis de l’Étang')).toEqual({
      title: 'Qualité de l’eau',
      description: 'Résultats des analyses.',
      alternates: {canonical: `${ORIGIN}/qualite-de-l-eau`},
      openGraph: {
        type: 'website',
        url: `${ORIGIN}/qualite-de-l-eau`,
        siteName: 'Les Amis de l’Étang',
        locale: 'fr_FR',
        title: 'Qualité de l’eau',
        description: 'Résultats des analyses.',
        images: [{url: `${ORIGIN}/api/files/x.webp`, alt: 'Prélèvement'}],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Qualité de l’eau',
        description: 'Résultats des analyses.',
        images: [{url: `${ORIGIN}/api/files/x.webp`, alt: 'Prélèvement'}],
      },
    })
  })

  it('sans description : la balise est retiree, sans heriter de celle du parent', () => {
    const metadata = toPageMetadata(
      {...seo, description: undefined},
      'Les Amis de l’Étang'
    )
    expect(metadata.description).toBeNull()
    expect(metadata.openGraph).not.toHaveProperty('description')
    expect(metadata.twitter).not.toHaveProperty('description')
  })

  it('accueil : le nom seul, sans le gabarit du titre', () => {
    expect(
      toPageMetadata(seo, 'Les Amis de l’Étang', {absoluteTitle: true}).title
    ).toEqual({absolute: 'Qualité de l’eau'})
  })

  it('actualite : type article', () => {
    expect(
      toPageMetadata(seo, 'Les Amis de l’Étang', {type: 'article'}).openGraph
    ).toMatchObject({type: 'article'})
  })
})
