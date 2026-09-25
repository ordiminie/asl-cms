// @vitest-environment jsdom
import {readFileSync} from 'node:fs'
import path from 'node:path'

import {render} from 'react-email'
import {describe, expect, it} from 'vitest'

import ContactMessageMail from './contact-message-email'
import {EMAIL_DARK_CLASSES} from './theme'

const MESSAGE_URL =
  'https://amis-etang.test/bureau/messages/33333333-3333-4333-8333-333333333333'

const renderMail = async (senderName: string | null = 'Claire Meunier') => {
  const html = await render(
    await ContactMessageMail({
      locale: 'fr',
      association: {name: "Les Amis de l'Étang", hue: 195},
      messageUrl: MESSAGE_URL,
      message: {
        senderName,
        senderEmail: 'claire.meunier@example.fr',
        subject: "Analyse d'eau du forage",
        body: 'Bonjour,\nQuand paraît la prochaine analyse ?\nMerci.',
        createdAt: new Date('2026-09-02T12:32:00Z'),
      },
    })
  )
  return {html, doc: new DOMParser().parseFromString(html, 'text/html')}
}

describe('ContactMessageMail — écran 4 du design s08', () => {
  it('parle la locale reçue et titre le message', async () => {
    const {doc} = await renderMail()

    expect(doc.documentElement.getAttribute('lang')).toBe('fr')
    expect(doc.querySelector('h1')?.textContent).toBe(
      'Nouveau message depuis le site'
    )
    expect(doc.body.textContent).toContain("Les Amis de l'Étang")
  })

  it('écrit l’adresse du visiteur en clair, cliquable en mailto:', async () => {
    const {doc} = await renderMail()

    const mailto = doc.querySelector(
      'a[href="mailto:claire.meunier@example.fr"]'
    )
    expect(mailto?.textContent).toBe('claire.meunier@example.fr')
  })

  it('donne l’expéditeur, l’objet et la date de réception, heure de Paris', async () => {
    const {doc} = await renderMail()
    const text = doc.body.textContent ?? ''

    expect(text).toContain('Claire Meunier')
    expect(text).toContain("Analyse d'eau du forage")
    expect(text).toContain('2 septembre 2026 à 14 h 32')
  })

  it('dit que le nom n’est pas renseigné quand il manque', async () => {
    const {doc} = await renderMail(null)

    expect(doc.body.textContent).toContain('Nom non renseigné')
  })

  it('conserve les retours à la ligne du message', async () => {
    const {html} = await renderMail()

    expect(html).toMatch(
      /Bonjour,<br\/?>Quand paraît la prochaine analyse \?<br\/?>Merci\./
    )
  })

  it('double le bouton de l’URL du back-office en clair', async () => {
    const {doc} = await renderMail()
    const links = [...doc.querySelectorAll(`a[href="${MESSAGE_URL}"]`)]

    expect(links.map((link) => link.textContent)).toEqual([
      'Ouvrir le message dans le back-office',
      MESSAGE_URL,
    ])
  })

  it('dit pourquoi l’email arrive, sans lien de désinscription', async () => {
    const {doc} = await renderMail()
    const text = doc.body.textContent ?? ''

    expect(text).toContain("Cet email vous est envoyé parce qu'un visiteur")
    expect(text.toLowerCase()).not.toContain('désinscri')
  })

  it('sert les jumelles sombres par prefers-color-scheme et [data-ogsc]', async () => {
    const {html} = await renderMail()

    expect(html).toContain('prefers-color-scheme: dark')
    expect(html).toContain('[data-ogsc]')
    expect(html).toMatch(/color:\s*#FFFFFF\s*!important/)
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
      path.resolve(import.meta.dirname, 'contact-message-email.tsx'),
      'utf8'
    )

    expect(source).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/)
    expect(source).not.toMatch(/oklch|rgb\(/)
  })
})
