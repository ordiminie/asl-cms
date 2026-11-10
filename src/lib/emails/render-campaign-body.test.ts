// @vitest-environment jsdom
import {describe, expect, it} from 'vitest'

import {renderCampaignBodyHtml} from './render-campaign-body'
import {EMAIL_DARK_CLASSES} from './theme'

const VALUES = {
  nom: 'Claire Aubert',
  parcelle: '12 et 14',
  date: '12 novembre 2026',
}

const parse = (html: string) =>
  new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')

describe('renderCampaignBodyHtml', () => {
  it('rend le Markdown restreint et remplace les variables', () => {
    const html = renderCampaignBodyHtml(
      'Bonjour {nom},\n\nVotre parcelle **{parcelle}**, le {date}.',
      VALUES
    )
    const doc = parse(html)

    expect(doc.querySelectorAll('p')).toHaveLength(2)
    expect(doc.body.textContent).toContain('Bonjour Claire Aubert,')
    expect(doc.querySelector('strong')?.textContent).toBe('12 et 14')
    expect(doc.body.textContent).toContain('le 12 novembre 2026.')
  })

  it('échappe une valeur de variable hostile', () => {
    const html = renderCampaignBodyHtml('Bonjour {nom}', {
      ...VALUES,
      nom: '<b>Bob</b> & <script>alert(1)</script>',
    })
    const doc = parse(html)

    expect(doc.querySelector('b')).toBeNull()
    expect(doc.querySelector('script')).toBeNull()
    expect(doc.body.textContent).toContain(
      '<b>Bob</b> & <script>alert(1)</script>'
    )
  })

  it('ne laisse passer ni script ni attribut de style écrit dans le corps', () => {
    const html = renderCampaignBodyHtml(
      'Avant\n\n<script>alert(1)</script>\n\n<p style="color:red" onclick="x()">Rouge</p>\n\n[lien](javascript:alert(1))',
      VALUES
    )

    expect(html).not.toContain('<script')
    expect(html).not.toContain('color:red')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('javascript:')
  })

  it('pose ses propres styles en ligne, couleurs de theme.ts, liens recolorés en sombre', () => {
    const html = renderCampaignBodyHtml(
      '## Titre\n\nUn [formulaire](https://asl.test/pouvoir).\n\n1. Un\n2. Deux',
      VALUES
    )
    const doc = parse(html)
    const link = doc.querySelector('a[href="https://asl.test/pouvoir"]')

    expect(doc.querySelector('h2')?.getAttribute('style')).toMatch(/font-size/)
    expect(doc.querySelector('p')?.getAttribute('style')).toMatch(/margin/)
    expect(doc.querySelector('ol')?.getAttribute('style')).toMatch(/padding/)
    expect(link?.getAttribute('style')).toMatch(/color:\s*#2B57A8/i)
    expect(link?.classList.contains(EMAIL_DARK_CLASSES.link)).toBe(true)
  })
})
