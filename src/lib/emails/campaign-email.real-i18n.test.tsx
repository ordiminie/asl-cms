// @vitest-environment jsdom
import {readFileSync} from 'node:fs'
import path from 'node:path'

import {render} from 'react-email'
import {describe, expect, it} from 'vitest'

import {findUnknownVariables} from '@/services/rules/campaign-rules'
import {CAMPAIGN_TEMPLATE_IDS} from '@/services/types/domain/campaign-types'

import fr from '../../../messages/fr.json'
import CampaignMail, {
  type CampaignEmailAssociation,
  getCampaignFooterTexts,
} from './campaign-email'
import {renderCampaignBodyHtml} from './render-campaign-body'
import {EMAIL_DARK_CLASSES} from './theme'

const UNSUBSCRIBE_URL =
  'https://asl-les-pins.test/desinscription/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const LOGO_URL = 'https://asl-les-pins.test/api/identity/logo?v=1'
const VALUES = {
  nom: 'Claire Aubert',
  parcelle: '12 et 14',
  date: '12 novembre 2026',
}

const ASSOCIATION: CampaignEmailAssociation = {
  name: 'ASL Les Pins',
  hue: 195,
  logoUrl: LOGO_URL,
  legalName: 'Association syndicale libre des Pins',
  legalMentions: '4 allée des Pins, 33680 Lacanau\nSIRET 000 000 000 00000',
}

const TEMPLATES = fr.email.campaign.templates
const MODEL_IDS = CAMPAIGN_TEMPLATE_IDS.filter(
  (id): id is Exclude<(typeof CAMPAIGN_TEMPLATE_IDS)[number], 'free'> =>
    id !== 'free'
)

const FREE_BODY =
  'Bonjour {nom},\n\nLe portail sera repeint du **mercredi 18 au vendredi 20 novembre**.'

const renderMail = async ({
  bodyMarkdown = FREE_BODY,
  heading = 'Peinture du portail',
  association = ASSOCIATION,
}: {
  bodyMarkdown?: string
  heading?: string
  association?: CampaignEmailAssociation
} = {}) => {
  const html = await render(
    await CampaignMail({
      locale: 'fr',
      association,
      heading,
      preheader: 'Merci de laisser le passage libre.',
      bodyHtml: renderCampaignBodyHtml(bodyMarkdown, VALUES),
      unsubscribeUrl: UNSUBSCRIBE_URL,
    })
  )
  return {html, doc: new DOMParser().parseFromString(html, 'text/html')}
}

const expectCommonDressing = (doc: Document) => {
  const logo = doc.querySelector(`img[src="${LOGO_URL}"]`)
  expect(logo?.getAttribute('alt')).toBe('ASL Les Pins')
  const links = [...doc.querySelectorAll(`a[href="${UNSUBSCRIBE_URL}"]`)]
  expect(links.map((link) => link.textContent)).toEqual([
    'Ne plus recevoir ces campagnes',
    UNSUBSCRIBE_URL,
  ])
  expect(doc.body.textContent).toContain(
    'Se désinscrire ne vous prive d’aucune information obligatoire.'
  )
}

describe('CampaignMail — écran E du design s25', () => {
  it('habille le mode libre : en-tête au logo, bouton et URL de désinscription en clair', async () => {
    const {doc} = await renderMail()

    expect(doc.documentElement.getAttribute('lang')).toBe('fr')
    expect(doc.querySelector('h1')?.textContent).toBe('Peinture du portail')
    expectCommonDressing(doc)
  })

  it.each(MODEL_IDS)(
    'habille le modèle « %s » du même en-tête et du même pied',
    async (id) => {
      const {doc} = await renderMail({
        bodyMarkdown: TEMPLATES[id].body,
        heading: TEMPLATES[id].subject,
      })

      expectCommonDressing(doc)
    }
  )

  it.each(MODEL_IDS)(
    'le modèle « %s » commence par la ligne « Texte provisoire » en gras, sans variable inconnue',
    (id) => {
      const template = TEMPLATES[id]

      expect(template.body.startsWith(fr.email.campaign.provisionalLine)).toBe(
        true
      )
      expect(fr.email.campaign.provisionalLine).toBe(
        '**[Texte provisoire — à remplacer avant l’envoi]**'
      )
      expect(
        findUnknownVariables(
          `${template.subject}\n${template.preheader}\n${template.body}`
        )
      ).toEqual([])
    }
  )

  it('écrit les mentions du pied : nom, raison sociale, mentions sur plusieurs lignes, motif', async () => {
    const {doc, html} = await renderMail()
    const text = doc.body.textContent ?? ''

    expect(text).toContain('Association syndicale libre des Pins')
    expect(html).toMatch(/4 allée des Pins, 33680 Lacanau<br\/?>SIRET/)
    expect(text).toContain(
      'Vous recevez cet email parce que vous êtes membre de ASL Les Pins.'
    )
  })

  it('sans mentions renseignées, le pied porte le nom seul', async () => {
    const {doc} = await renderMail({
      association: {
        name: 'ASL Les Pins',
        hue: 195,
        logoUrl: LOGO_URL,
        legalName: null,
        legalMentions: null,
      },
    })

    expect(doc.body.textContent).not.toContain('null')
    expectCommonDressing(doc)
  })

  it('sans logo PNG (WebP), l’en-tête porte le nom seul, sans image', async () => {
    const {doc} = await renderMail({
      association: {...ASSOCIATION, logoUrl: undefined},
    })

    expect(doc.querySelector('img')).toBeNull()
    expect(doc.body.textContent).toContain('ASL Les Pins')
  })

  it('pose le corps rendu, variables remplacées et échappées', async () => {
    const {doc} = await renderMail({
      bodyMarkdown: 'Bonjour {nom}',
    })

    expect(doc.body.textContent).toContain('Bonjour Claire Aubert')
  })

  it('sert les jumelles sombres par prefers-color-scheme et [data-ogsc]', async () => {
    const {html} = await renderMail()

    expect(html).toContain('prefers-color-scheme: dark')
    expect(html).toContain('[data-ogsc]')
    expect(html).toContain(EMAIL_DARK_CLASSES.text)
    expect(html).toContain(EMAIL_DARK_CLASSES.link)
  })

  it('pose chaque texte recoloré en sombre sur un fond qui passe aussi en sombre', async () => {
    const {doc} = await renderMail({
      bodyMarkdown: 'Un [lien](https://asl.test/pouvoir).',
    })
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

  it('donne au gabarit et à la version texte les mêmes phrases du pied', async () => {
    const footer = await getCampaignFooterTexts('fr', ASSOCIATION)

    expect(footer).toEqual({
      associationName: 'ASL Les Pins',
      legalName: 'Association syndicale libre des Pins',
      legalMentions: '4 allée des Pins, 33680 Lacanau\nSIRET 000 000 000 00000',
      reason:
        'Vous recevez cet email parce que vous êtes membre de ASL Les Pins.',
      unsubscribeLabel: 'Ne plus recevoir ces campagnes',
      notice: 'Se désinscrire ne vous prive d’aucune information obligatoire.',
    })
  })

  it('n’écrit aucune couleur dans le gabarit : toutes viennent de theme.ts', () => {
    for (const file of ['campaign-email.tsx', 'render-campaign-body.ts']) {
      const source = readFileSync(
        path.resolve(import.meta.dirname, file),
        'utf8'
      )

      expect(source).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/)
      expect(source).not.toMatch(/oklch|rgb\(/)
    }
  })
})
