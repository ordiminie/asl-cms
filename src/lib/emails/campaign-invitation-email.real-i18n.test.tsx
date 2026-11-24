// @vitest-environment jsdom
import {render} from 'react-email'
import {describe, expect, it} from 'vitest'

import type {CampaignNature} from '@/services/types/domain/campaign-types'

import CampaignMail, {
  type CampaignEmailAssociation,
  getCampaignFooterTexts,
} from './campaign-email'
import {renderCampaignText} from './campaign-text'
import {
  getInvitationContentTexts,
  invitationPlainContentOf,
} from './invitation-content'

const URL =
  'https://clos-fleuri.test/api/auth/magic-link/verify?token=abc123&callbackURL=https%3A%2F%2Fclos-fleuri.test%2Flogin%2Fdestination'
const UNSUBSCRIBE_URL =
  'https://clos-fleuri.test/desinscription/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const LOGO_URL = 'https://clos-fleuri.test/api/identity/logo?v=1'

const ASSOCIATION: CampaignEmailAssociation = {
  name: 'Clos-Fleuri',
  hue: 195,
  logoUrl: LOGO_URL,
  legalName: null,
  legalMentions: null,
}

const TRAPPED_TEXT =
  'Bonjour {nom},\n\n**gras** et # titre\n\n[x](https://piege.test) <b>balise</b>'

const renderLaunch = async ({
  nature = 'statutaire',
  text = TRAPPED_TEXT,
}: {nature?: CampaignNature; text?: string} = {}) => {
  const html = await render(
    await CampaignMail({
      locale: 'fr',
      association: ASSOCIATION,
      nature,
      heading: 'Votre espace membre vous attend',
      preheader: 'Un espace personnel vous est ouvert.',
      bodyHtml: '',
      unsubscribeUrl: UNSUBSCRIBE_URL,
      invitation: {url: URL, expiresOn: '1 décembre 2026', text},
    })
  )
  return {html, doc: new DOMParser().parseFromString(html, 'text/html')}
}

describe('CampaignMail — contenu d’invitation dans l’habillage de campagne (s42b, écran 3, ADR 072 §7)', () => {
  it('en-tête au logo, titre de l’invitation, une action doublée de l’URL en clair, trois étapes', async () => {
    const {doc} = await renderLaunch()

    expect(doc.querySelector('img')?.getAttribute('src')).toBe(LOGO_URL)
    const headings = [...doc.querySelectorAll('h1')].map((h) => h.textContent)
    expect(headings).toEqual(['Votre espace sur le site de Clos-Fleuri'])
    const invitationLinks = [...doc.querySelectorAll('a')].filter(
      (link) => link.getAttribute('href') === URL
    )
    expect(
      invitationLinks.filter(
        (link) => link.textContent?.trim() === 'Ouvrir mon espace'
      )
    ).toHaveLength(1)
    expect(invitationLinks.some((link) => link.textContent === URL)).toBe(true)
    const steps = [...doc.querySelectorAll('ol li')].map((item) =>
      item.textContent?.trim()
    )
    expect(steps).toHaveLength(3)
    expect(steps[1]).toBe(
      'Ce lien vaut jusqu’au 1 décembre 2026 et ne sert qu’une fois.'
    )
  })

  it('le texte de l’association ressort littéralement : ni Markdown, ni HTML, ni variable', async () => {
    const {doc} = await renderLaunch()

    expect(doc.querySelector('b')).toBeNull()
    expect(doc.querySelector('strong')?.textContent).toBe('aucun mot de passe')
    expect(
      [...doc.querySelectorAll('a')].some(
        (link) => link.getAttribute('href') === 'https://piege.test'
      )
    ).toBe(false)
    const body = doc.body.textContent ?? ''
    expect(body).toContain('Bonjour {nom},')
    expect(body).toContain('**gras** et # titre')
    expect(body).toContain('[x](https://piege.test) <b>balise</b>')
  })

  it('pied statutaire : la mention de s27b et la désinscription des seuls envois facultatifs', async () => {
    const {doc} = await renderLaunch({nature: 'statutaire'})
    const footer = await getCampaignFooterTexts('fr', ASSOCIATION, 'statutaire')

    expect(footer.statutoryNotice).not.toBeNull()
    expect(doc.body.textContent).toContain(footer.statutoryNotice as string)
    const unsubscribe = [...doc.querySelectorAll('a')].filter(
      (link) => link.getAttribute('href') === UNSUBSCRIBE_URL
    )
    expect(unsubscribe.map((link) => link.textContent?.trim())).toEqual([
      'Ne plus recevoir les campagnes facultatives',
      UNSUBSCRIBE_URL,
    ])
  })

  it('pied facultatif : sans la mention statutaire, avec le lien de désinscription', async () => {
    const {doc} = await renderLaunch({nature: 'facultative'})
    const statutory = await getCampaignFooterTexts(
      'fr',
      ASSOCIATION,
      'statutaire'
    )

    expect(doc.body.textContent).not.toContain(
      statutory.statutoryNotice as string
    )
    expect(
      [...doc.querySelectorAll('a')].some(
        (link) =>
          link.getAttribute('href') === UNSUBSCRIBE_URL &&
          link.textContent?.trim() === 'Ne plus recevoir ces campagnes'
      )
    ).toBe(true)
  })
})

describe('renderCampaignText — invitation (s42b)', () => {
  it('porte le titre, le texte littéral, l’URL en clair, les trois étapes, puis le pied', async () => {
    const footer = await getCampaignFooterTexts('fr', ASSOCIATION, 'statutaire')
    const texts = getInvitationContentTexts('fr', {
      associationName: 'Clos-Fleuri',
      text: TRAPPED_TEXT,
      expiresOn: '1 décembre 2026',
    })
    const text = renderCampaignText({
      heading: 'Votre espace membre vous attend',
      bodyMarkdown: '',
      values: {nom: 'Claire', parcelle: '12', date: '24 novembre 2026'},
      footer,
      unsubscribeUrl: UNSUBSCRIBE_URL,
      invitation: invitationPlainContentOf(texts, URL),
    })

    expect(text.startsWith('Votre espace sur le site de Clos-Fleuri')).toBe(
      true
    )
    expect(text).toContain('Bonjour {nom},')
    expect(text).toContain('**gras** et # titre')
    expect(text).toContain('[x](https://piege.test) <b>balise</b>')
    expect(text).toContain(`Ouvrir mon espace : ${URL}`)
    expect(text).toContain(
      '1. Cliquez sur le bouton : votre espace s’ouvre directement.'
    )
    expect(text).toContain(
      '2. Ce lien vaut jusqu’au 1 décembre 2026 et ne sert qu’une fois.'
    )
    expect(text).toContain('3. Ensuite, pour revenir')
    expect(text).toContain('aucun mot de passe')
    expect(text).not.toContain('<strong>')
    expect(text).toContain(footer.statutoryNotice as string)
    expect(text).toContain(UNSUBSCRIBE_URL)
    expect(text).not.toContain('Votre espace membre vous attend')
  })
})
