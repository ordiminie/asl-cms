// @vitest-environment jsdom
import {readFileSync} from 'node:fs'
import path from 'node:path'

import {render} from 'react-email'
import {describe, expect, it} from 'vitest'

import IncidentReportMail from './incident-report-email'
import {EMAIL_DARK_CLASSES} from './theme'

const REPORT_URL =
  'https://amis-etang.test/bureau/signalements/33333333-3333-4333-8333-333333333333'

const report = (overrides: Record<string, unknown> = {}) => ({
  categoryName: "Fuite d'eau",
  location: 'Chemin des Pins, devant la parcelle 47',
  description:
    'L’eau sort de la chaussée, ça coule fort.\nDéjà une flaque hier soir.',
  reporterName: 'Paul Ferrand',
  reporterEmail: 'p.ferrand@example.fr',
  reporterPhone: '06 12 34 56 78',
  createdAt: new Date('2026-09-29T05:42:00Z'),
  ...overrides,
})

const renderMail = async (overrides: Record<string, unknown> = {}) => {
  const html = await render(
    await IncidentReportMail({
      locale: 'fr',
      association: {name: "Les Amis de l'Étang", hue: 195},
      reportUrl: REPORT_URL,
      report: report(overrides),
    })
  )
  return {html, doc: new DOMParser().parseFromString(html, 'text/html')}
}

describe('IncidentReportMail — écran 5 du design s10', () => {
  it('parle la locale reçue et titre le signalement', async () => {
    const {doc} = await renderMail()

    expect(doc.documentElement.getAttribute('lang')).toBe('fr')
    expect(doc.querySelector('h1')?.textContent).toBe(
      'Nouveau signalement depuis le site'
    )
    expect(doc.body.textContent).toContain("Les Amis de l'Étang")
  })

  it('donne la catégorie, le lieu et la date de réception, heure de Paris', async () => {
    const {doc} = await renderMail()
    const text = doc.body.textContent ?? ''

    expect(text).toContain("Fuite d'eau")
    expect(text).toContain('Chemin des Pins, devant la parcelle 47')
    expect(text).toContain('29 septembre 2026 à 07 h 42')
  })

  it('rend l’email cliquable en mailto: et le téléphone en tel:', async () => {
    const {doc} = await renderMail()

    expect(
      doc.querySelector('a[href="mailto:p.ferrand@example.fr"]')?.textContent
    ).toBe('p.ferrand@example.fr')
    expect(doc.querySelector('a[href="tel:0612345678"]')?.textContent).toBe(
      '06 12 34 56 78'
    )
  })

  it('écrit « non renseigné » pour chaque coordonnée absente', async () => {
    const {doc} = await renderMail({
      reporterName: null,
      reporterEmail: null,
      reporterPhone: null,
    })
    const text = doc.body.textContent ?? ''

    expect(text.match(/non renseigné/g)).toHaveLength(3)
    expect(doc.querySelector('a[href^="mailto:"]')).toBeNull()
    expect(doc.querySelector('a[href^="tel:"]')).toBeNull()
  })

  it('dit « Sans catégorie » quand le signalement n’en porte pas', async () => {
    const {doc} = await renderMail({categoryName: null})

    expect(doc.body.textContent).toContain('Sans catégorie')
  })

  it('conserve les retours à la ligne de la description', async () => {
    const {html} = await renderMail()

    expect(html).toMatch(/ça coule fort\.<br\/?>Déjà une flaque hier soir\./)
  })

  it('double le bouton de l’URL du back-office en clair', async () => {
    const {doc} = await renderMail()
    const links = [...doc.querySelectorAll(`a[href="${REPORT_URL}"]`)]

    expect(links.map((link) => link.textContent)).toEqual([
      'Ouvrir le signalement',
      REPORT_URL,
    ])
  })

  it('dit pourquoi l’email arrive, sans lien de désinscription', async () => {
    const {doc} = await renderMail()
    const text = doc.body.textContent ?? ''

    expect(text).toContain(
      'Cet email vous est envoyé parce qu’un visiteur a fait un signalement'
    )
    expect(text.toLowerCase()).not.toContain('désinscri')
  })

  it('sert les jumelles sombres par prefers-color-scheme et [data-ogsc]', async () => {
    const {html} = await renderMail()

    expect(html).toContain('prefers-color-scheme: dark')
    expect(html).toContain('[data-ogsc]')
  })

  it('pose chaque texte recoloré en sombre sur un fond qui passe aussi en sombre', async () => {
    const {doc} = await renderMail()
    const c = EMAIL_DARK_CLASSES
    const darkText = [
      ...doc.querySelectorAll(`.${c.text}, .${c.textMuted}, .${c.link}`),
    ]

    const nearestPaintedBackground = (element: Element): Element | null => {
      let current: Element | null = element
      while (current) {
        const style = (current as HTMLElement).style
        if (style?.backgroundColor || current.classList.contains(c.background))
          return current
        current = current.parentElement
      }
      return null
    }

    expect(darkText.length).toBeGreaterThan(0)
    const misplaced = darkText
      .filter(
        (element) =>
          !nearestPaintedBackground(element)?.classList.contains(c.background)
      )
      .map((element) => element.textContent?.trim().slice(0, 40))

    expect(misplaced).toEqual([])
  })

  it('n’écrit aucune couleur dans le gabarit : toutes viennent de theme.ts', () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, 'incident-report-email.tsx'),
      'utf8'
    )

    expect(source).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/)
    expect(source).not.toMatch(/oklch|rgb\(/)
  })
})
