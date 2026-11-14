// @vitest-environment jsdom
import {readFileSync} from 'node:fs'
import path from 'node:path'

import {render} from 'react-email'
import {describe, expect, it} from 'vitest'

import MemberQuestionMail from './member-question-email'
import {EMAIL_DARK_CLASSES} from './theme'

const QUESTION_URL =
  'https://amis-etang.test/bureau/questions/33333333-3333-4333-8333-333333333333'

const question = (overrides: Record<string, unknown> = {}) => ({
  categoryName: 'Voirie',
  memberName: 'Lucie Moreau',
  memberEmail: 'lucie.moreau@exemple.fr',
  body: 'Quand le chemin sera-t-il refait ?\nIl y a des trous.',
  createdAt: new Date('2026-11-14T09:42:00Z'),
  ...overrides,
})

const renderMail = async (overrides: Record<string, unknown> = {}) => {
  const html = await render(
    await MemberQuestionMail({
      locale: 'fr',
      association: {name: "Les Amis de l'Étang", hue: 195},
      questionUrl: QUESTION_URL,
      question: question(overrides),
    })
  )
  return {html, doc: new DOMParser().parseFromString(html, 'text/html')}
}

describe('MemberQuestionMail — notification au bureau (s23)', () => {
  it('parle la locale reçue et titre la question', async () => {
    const {doc} = await renderMail()

    expect(doc.documentElement.getAttribute('lang')).toBe('fr')
    expect(doc.querySelector('h1')?.textContent).toBe(
      'Nouvelle question d’un membre'
    )
    expect(doc.body.textContent).toContain("Les Amis de l'Étang")
  })

  it('donne le sujet, le membre et la date de réception, heure de Paris', async () => {
    const {doc} = await renderMail()
    const text = doc.body.textContent ?? ''

    expect(text).toContain('Voirie')
    expect(text).toContain('Lucie Moreau')
    expect(text).toContain('14 novembre 2026 à 10 h 42')
  })

  it('rend l’email du membre cliquable en mailto:', async () => {
    const {doc} = await renderMail()

    expect(
      doc.querySelector('a[href="mailto:lucie.moreau@exemple.fr"]')?.textContent
    ).toBe('lucie.moreau@exemple.fr')
  })

  it('dit « Sans adresse email » quand la fiche n’en a pas', async () => {
    const {doc} = await renderMail({memberEmail: null})

    expect(doc.body.textContent).toContain('Sans adresse email')
    expect(doc.querySelector('a[href^="mailto:"]')).toBeNull()
  })

  it('conserve les retours à la ligne de la question', async () => {
    const {html} = await renderMail()

    expect(html).toMatch(/refait \?<br\/?>Il y a des trous\./)
  })

  it('double le bouton de l’URL du back-office en clair', async () => {
    const {doc} = await renderMail()
    const links = [...doc.querySelectorAll(`a[href="${QUESTION_URL}"]`)]

    expect(links.map((link) => link.textContent)).toEqual([
      'Ouvrir la question',
      QUESTION_URL,
    ])
  })

  it('dit de répondre directement au membre, et pourquoi l’email arrive, sans désinscription', async () => {
    const {doc} = await renderMail()
    const text = doc.body.textContent ?? ''

    expect(text).toMatch(/répondez directement au membre/i)
    expect(text).toContain(
      'Cet email vous est envoyé parce qu’un membre a posé une question'
    )
    expect(text.toLowerCase()).not.toContain('désinscri')
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
      path.resolve(import.meta.dirname, 'member-question-email.tsx'),
      'utf8'
    )

    expect(source).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/)
    expect(source).not.toMatch(/oklch|rgb\(/)
  })
})
