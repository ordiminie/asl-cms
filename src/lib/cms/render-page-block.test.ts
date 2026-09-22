import {describe, expect, it} from 'vitest'

import {renderPageBlock} from './render-page-block'

describe('renderPageBlock — bloc texte riche', () => {
  it('rend les balises de la barre réduite', () => {
    const html = renderPageBlock({
      type: 'text',
      data: {
        markdown:
          '## Titre 2\n\n### Titre 3\n\nUn **gras**, un _italique_ et un [lien](https://example.org).\n\n- premier\n- second\n',
      },
    })

    expect(html).toContain('<h2>Titre 2</h2>')
    expect(html).toContain('<h3>Titre 3</h3>')
    expect(html).toContain('<strong>gras</strong>')
    expect(html).toContain('<em>italique</em>')
    expect(html).toContain('<a href="https://example.org">lien</a>')
    expect(html).toContain('<li>premier</li>')
  })

  it('neutralise un script injecté dans le texte', () => {
    const html = renderPageBlock({
      type: 'text',
      data: {
        markdown:
          'Bonjour <script>alert("xss")</script> et <img src=x onerror="alert(1)">',
      },
    })

    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
    expect(html).toContain('Bonjour')
  })

  it('neutralise un lien javascript: et une balise hors de la barre réduite', () => {
    const html = renderPageBlock({
      type: 'text',

      data: {markdown: '[clic](javascript:alert(1))\n\n| a | b |\n| - | - |\n'},
    })

    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('<table')
  })

  it('retire les balises hors barre réduite en gardant le texte', () => {
    const html = renderPageBlock({
      type: 'text',
      data: {markdown: '# Titre 1\n\nUn `code` et <div>un bloc brut</div>\n'},
    })

    expect(html).not.toContain('<h1')
    expect(html).not.toContain('<code')
    expect(html).not.toContain('<div>un bloc brut')
    expect(html).toContain('Titre 1')
    expect(html).toContain('code')
  })

  it('ignore un bloc texte vide', () => {
    expect(renderPageBlock({type: 'text', data: {markdown: '   '}})).toBeNull()
  })
})

describe('renderPageBlock — bloc image + légende', () => {
  it('rend une figure avec son texte alternatif et sa légende', () => {
    const html = renderPageBlock({
      type: 'image',
      data: {
        fileKey: 'org-1/pages/page-1/bloc-1.webp',
        alt: "L'étang au petit matin",
        caption: 'Photo de Jeanne, mai 2025',
      },
    })

    expect(html).toContain('<figure')
    expect(html).toContain(
      'src="/api/pages/files/org-1/pages/page-1/bloc-1.webp"'
    )
    expect(html).toContain('alt="L&#x27;étang au petit matin"')
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('<figcaption>Photo de Jeanne, mai 2025</figcaption>')
  })

  it('échappe la légende au lieu de l’interpréter comme du markup', () => {
    const html = renderPageBlock({
      type: 'image',
      data: {
        fileKey: 'org-1/pages/page-1/bloc-1.webp',
        alt: 'alt',
        caption: '<script>alert(1)</script>',
      },
    })

    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;script&gt;')
  })

  it('ignore une image sans fichier', () => {
    expect(
      renderPageBlock({type: 'image', data: {fileKey: null, alt: 'alt'}})
    ).toBeNull()
  })
})

describe('renderPageBlock — bloc document PDF', () => {
  it('rend un lien portant le titre écrit par le bureau', () => {
    const html = renderPageBlock({
      type: 'pdf',
      data: {
        fileKey: 'org-1/pages/page-1/bloc-2.pdf',
        title: 'Compte rendu 2025',
      },
    })

    expect(html).toContain(
      'href="/api/pages/files/org-1/pages/page-1/bloc-2.pdf"'
    )
    expect(html).toContain('Compte rendu 2025')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('ignore un PDF sans fichier', () => {
    expect(
      renderPageBlock({type: 'pdf', data: {fileKey: null, title: 'Titre'}})
    ).toBeNull()
  })
})

describe('renderPageBlock — bloc galerie', () => {
  it('rend une vignette par image', () => {
    const html = renderPageBlock({
      type: 'gallery',
      data: {
        images: [
          {fileKey: 'org-1/pages/page-1/a.webp', alt: 'Première'},
          {fileKey: 'org-1/pages/page-1/b.webp', alt: 'Seconde'},
        ],
      },
    })

    expect(html).toContain('alt="Première"')
    expect(html).toContain('alt="Seconde"')
    expect(html).toContain('src="/api/pages/files/org-1/pages/page-1/b.webp"')
  })

  it('ignore une galerie vide', () => {
    expect(renderPageBlock({type: 'gallery', data: {images: []}})).toBeNull()
  })
})

describe('renderPageBlock — bloc encart', () => {
  it('rend le titre et le texte sanitisé', () => {
    const html = renderPageBlock({
      type: 'callout',
      data: {
        title: 'Bon à savoir',
        markdown: 'Le portail est **fermé** le dimanche.<script>x()</script>',
      },
    })

    expect(html).toContain('Bon à savoir')
    expect(html).toContain('<strong>fermé</strong>')
    expect(html).not.toContain('<script')
  })
})

describe('renderPageBlock — robustesse (critère 9)', () => {
  it('rend null pour un type de bloc inconnu, sans lever', () => {
    expect(
      renderPageBlock({type: 'carrousel-2019', data: {anything: true}})
    ).toBeNull()
  })

  it('rend null pour un bloc dont la donnée est hors forme, sans lever', () => {
    expect(renderPageBlock({type: 'image', data: null})).toBeNull()
    expect(renderPageBlock({type: 'text', data: {markdown: 42}})).toBeNull()
  })
})
