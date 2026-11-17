// @vitest-environment jsdom
import {render} from 'react-email'
import {describe, expect, it} from 'vitest'

import MemberEmailConfirmationMail from './member-email-confirmation-email'
import {EMAIL_COLORS_DARK} from './theme'

const URL = 'https://clos-fleuri.test/confirmer-adresse/Xk3abc'

const renderMail = async () => {
  const html = await render(
    await MemberEmailConfirmationMail({
      url: URL,
      association: {name: 'Clos-Fleuri', hue: 195},
      authorName: 'Claire Dubois',
      profileName: 'Jean Dubois',
      parcelNumbers: ['21'],
      expiresOn: '23 novembre 2026',
      locale: 'fr',
    })
  )
  return {html, doc: new DOMParser().parseFromString(html, 'text/html')}
}

describe('MemberEmailConfirmationMail — écran 2 du design s54', () => {
  it('titre, auteur, fiche et parcelles, une seule action doublée de l’URL en clair', async () => {
    const {doc} = await renderMail()

    expect(doc.documentElement.getAttribute('lang')).toBe('fr')
    expect(doc.querySelector('h1')?.textContent).toBe(
      'Confirmez votre adresse email'
    )
    expect(doc.body.textContent).toContain(
      'Claire Dubois a ajouté cette adresse pour qu’elle puisse se connecter à l’espace membre de Jean Dubois (parcelle 21) et recevoir les envois de l’association.'
    )
    const links = [...doc.querySelectorAll('a')].map((a) => a.href)
    expect(links.filter((href) => href === URL)).toHaveLength(2)
    expect(doc.body.textContent).toContain('Confirmer cette adresse')
  })

  it('dit l’échéance et ce qui se passe sans clic', async () => {
    const {doc} = await renderMail()

    expect(doc.body.textContent).toContain(
      'Ce lien vaut jusqu’au 23 novembre 2026.'
    )
    expect(doc.body.textContent).toContain(
      'sans confirmation, l’adresse ne reçoit rien et ne donne accès à rien.'
    )
  })

  it('porte les jumelles sombres et aucun lien de désinscription', async () => {
    const {html, doc} = await renderMail()

    expect(html).toContain('prefers-color-scheme: dark')
    expect(html).toContain(EMAIL_COLORS_DARK.buttonBg)
    expect(doc.body.textContent).not.toMatch(/désinscri/i)
  })
})
