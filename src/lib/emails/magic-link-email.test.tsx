import {render} from 'react-email'
import {describe, expect, it, vi} from 'vitest'

vi.mock('next-intl/server', async () => ({
  getTranslations: vi.fn(
    (await import('@/__tests__/translations-without-locale-cookie'))
      .getTranslationsWithoutLocaleCookie
  ),
}))

import MagicLinkMail from './magic-link-email'

const URL_WITH_PARAMS =
  'https://asl-les-pins.test/api/auth/magic-link/verify?token=abc123&callbackURL=%2Fdashboard'

const renderMail = async (association: {
  name: string
  logoUrl?: string
  hue: 195 | 150 | 255 | 40 | 300 | 95
}) => {
  const html = await render(
    await MagicLinkMail({url: URL_WITH_PARAMS, association, locale: 'fr'})
  )
  return {html, doc: new DOMParser().parseFromString(html, 'text/html')}
}

describe('MagicLinkMail — planche D', () => {
  it('parle la locale reçue, même sans cookie de locale', async () => {
    const {doc} = await renderMail({name: 'ASL Les Pins', hue: 195})

    expect(doc.documentElement.getAttribute('lang')).toBe('fr')
    expect(doc.querySelector('h1')?.textContent).toBe('Votre lien de connexion')
  })

  it('déclare la langue de la locale reçue', async () => {
    const html = await render(
      await MagicLinkMail({
        url: URL_WITH_PARAMS,
        association: {name: 'ASL Les Pins', hue: 195},
        locale: 'es',
      })
    )
    const doc = new DOMParser().parseFromString(html, 'text/html')

    expect(doc.documentElement.getAttribute('lang')).toBe('es')
  })

  it('affiche le logo en en-tête, avec le nom en texte alternatif', async () => {
    const {doc} = await renderMail({
      name: 'ASL Les Pins',
      logoUrl: 'https://asl-les-pins.test/api/identity/logo?v=42',
      hue: 195,
    })

    const images = doc.querySelectorAll('img')
    expect(images).toHaveLength(1)
    expect(images[0].getAttribute('src')).toBe(
      'https://asl-les-pins.test/api/identity/logo?v=42'
    )
    expect(images[0].getAttribute('alt')).toBe('ASL Les Pins')
    expect(images[0].getAttribute('width')).toBe('36')
    expect(doc.body.textContent).toContain('ASL Les Pins')
  })

  it('écrit le nom seul quand l’association n’a pas de logo', async () => {
    const {doc} = await renderMail({name: 'TechCorp Solutions', hue: 150})

    expect(doc.querySelectorAll('img')).toHaveLength(0)
    expect(doc.body.textContent).toContain('TechCorp Solutions')
  })

  it('porte un seul bouton d’action et l’URL en clair dessous', async () => {
    const {doc} = await renderMail({name: 'ASL Les Pins', hue: 195})

    const links = [...doc.querySelectorAll('a')]
    expect(links.every((link) => link.getAttribute('href') === URL_WITH_PARAMS))
      .toBe(true)
    const actions = links.filter(
      (link) => link.textContent?.trim() === 'Ouvrir mon espace'
    )
    expect(actions).toHaveLength(1)
    expect(links.some((link) => link.textContent?.trim() === URL_WITH_PARAMS))
      .toBe(true)
    expect(doc.querySelector('button')).toBeNull()
  })

  it('écrit les textes du design (durée, pied transactionnel)', async () => {
    const {doc} = await renderMail({name: 'ASL Les Pins', hue: 195})
    const text = doc.body.textContent ?? ''

    expect(doc.querySelector('h1')?.textContent).toBe('Votre lien de connexion')
    expect(text).toContain('20 minutes')
    expect(text).toContain(
      "Vous n'avez pas demandé ce lien ? Ignorez cet email : personne ne peut se connecter sans lui."
    )
    expect(text).toContain(
      "Cet email vous est envoyé parce qu'une connexion a été demandée avec votre adresse sur le site de ASL Les Pins."
    )
    expect(text).toContain(
      'Valable 20 minutes, pour une seule connexion. Aucun mot de passe à retenir.'
    )
  })

  it('n’utilise ni OKLCH ni variable CSS, et tient en 600 px', async () => {
    const {html} = await renderMail({name: 'ASL Les Pins', hue: 195})

    expect(html).not.toMatch(/oklch/i)
    expect(html).not.toMatch(/var\(--/)
    expect(html).toMatch(/max-width:600px|width="600"/)
    expect(html).toContain('role="presentation"')
    expect(html).toMatch(/color:#FFFFFF\s*!important/i)
  })

  it('peint l’en-tête du triplet de la teinte de l’association', async () => {
    const {html} = await renderMail({name: 'TechCorp Solutions', hue: 150})
    const lower = html.toLowerCase()

    expect(lower).toContain('#e7f5ec')
    expect(lower).toContain('#2e7d52')
    expect(lower).toContain('#1e4a31')
    expect(lower).not.toContain('#e8f5f8')
  })
})
