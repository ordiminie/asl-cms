// @vitest-environment jsdom
import {render} from 'react-email'
import {describe, expect, it} from 'vitest'

import InvitationMail from './invitation-email'
import {EMAIL_COLORS_DARK} from './theme'

const URL =
  'https://clos-fleuri.test/api/auth/magic-link/verify?token=abc123&callbackURL=https%3A%2F%2Fclos-fleuri.test%2Flogin%2Fdestination'

const renderMail = async ({
  text = null,
  logoUrl,
}: {text?: string | null; logoUrl?: string} = {}) => {
  const html = await render(
    await InvitationMail({
      url: URL,
      association: {
        name: 'Clos-Fleuri',
        hue: 195,
        ...(logoUrl ? {logoUrl} : {}),
      },
      text,
      expiresOn: '1 décembre 2026',
      locale: 'fr',
    })
  )
  return {html, doc: new DOMParser().parseFromString(html, 'text/html')}
}

describe('InvitationMail — écran 3 du design s42a', () => {
  it('titre, nom de l’association, une seule action doublée de l’URL en clair', async () => {
    const {doc} = await renderMail()

    expect(doc.documentElement.getAttribute('lang')).toBe('fr')
    expect(doc.querySelector('h1')?.textContent).toBe(
      'Votre espace sur le site de Clos-Fleuri'
    )
    const links = [...doc.querySelectorAll('a')]
    expect(links.every((link) => link.getAttribute('href') === URL)).toBe(true)
    expect(
      links.filter((link) => link.textContent?.trim() === 'Ouvrir mon espace')
    ).toHaveLength(1)
    expect(links.some((link) => link.textContent?.trim() === URL)).toBe(true)
  })

  it('reprend le texte par défaut quand le réglage est vide', async () => {
    const {doc} = await renderMail({text: null})

    expect(doc.body.textContent).toContain(
      'Votre association a ouvert sur son site un espace personnel pour chaque propriétaire.'
    )
  })

  it('rend le texte de l’association comme du texte, paragraphe par paragraphe : une balise reste du texte', async () => {
    const {doc} = await renderMail({
      text: 'Bonjour à tous,\n\nVenez voir <b>le site</b> <script>alert(1)</script>',
    })

    expect(doc.querySelector('b')).toBeNull()
    expect(doc.querySelector('script')).toBeNull()
    expect(doc.body.textContent).toContain('Bonjour à tous,')
    expect(doc.body.textContent).toContain(
      'Venez voir <b>le site</b> <script>alert(1)</script>'
    )
    expect(doc.body.textContent).not.toContain(
      'Votre association a ouvert sur son site'
    )
  })

  it('les trois étapes disent la date de validité et l’absence de mot de passe', async () => {
    const {doc} = await renderMail()

    const steps = [...doc.querySelectorAll('ol li')].map((item) =>
      item.textContent?.trim()
    )
    expect(steps).toHaveLength(3)
    expect(steps[1]).toBe(
      'Ce lien vaut jusqu’au 1 décembre 2026 et ne sert qu’une fois.'
    )
    expect(steps[2]).toContain('aucun mot de passe')
  })

  it('en-tête au logo PNG quand il est fourni, nom seul sinon', async () => {
    const withLogo = await renderMail({
      logoUrl: 'https://clos-fleuri.test/api/identity/logo?v=42',
    })
    const images = withLogo.doc.querySelectorAll('img')
    expect(images).toHaveLength(1)
    expect(images[0].getAttribute('alt')).toBe('Clos-Fleuri')

    const nameOnly = await renderMail()
    expect(nameOnly.doc.querySelectorAll('img')).toHaveLength(0)
    expect(nameOnly.doc.body.textContent).toContain('Clos-Fleuri')
  })

  it('pied transactionnel, jumelles sombres, aucune désinscription', async () => {
    const {html, doc} = await renderMail()

    expect(doc.body.textContent).toContain(
      'Cet email vous est envoyé parce que le bureau de Clos-Fleuri vous a invité à rejoindre l’espace membre de son site.'
    )
    expect(html).toContain('prefers-color-scheme: dark')
    expect(html).toContain(EMAIL_COLORS_DARK.buttonBg)
    expect(doc.body.textContent).not.toMatch(/désinscri/i)
  })
})
