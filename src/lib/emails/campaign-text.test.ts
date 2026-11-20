import {describe, expect, it} from 'vitest'

import {renderCampaignText} from './campaign-text'

const UNSUBSCRIBE_URL =
  'https://asl-les-pins.test/desinscription/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const render = (bodyMarkdown: string) =>
  renderCampaignText({
    heading: 'Peinture du portail',
    bodyMarkdown,
    values: {
      nom: 'Claire <Aubert>',
      parcelle: '12 et 14',
      date: '12 novembre 2026',
    },
    footer: {
      associationName: 'ASL Les Pins',
      legalName: 'Association syndicale libre des Pins',
      legalMentions: '4 allée des Pins\nSIRET 000',
      reason:
        'Vous recevez cet email parce que vous êtes membre de ASL Les Pins.',
      statutoryNotice: null,
      unsubscribeLabel: 'Ne plus recevoir ces campagnes',
      notice: 'Se désinscrire ne vous prive d’aucune information obligatoire.',
    },
    unsubscribeUrl: UNSUBSCRIBE_URL,
  })

describe('renderCampaignText', () => {
  it('écrit l’URL de désinscription en clair', () => {
    expect(render('Bonjour')).toContain(UNSUBSCRIBE_URL)
  })

  it('remplace les variables sans les échapper : c’est du texte brut', () => {
    const text = render('Bonjour {nom}, parcelle {parcelle}, le {date}.')

    expect(text).toContain(
      'Bonjour Claire <Aubert>, parcelle 12 et 14, le 12 novembre 2026.'
    )
  })

  it('retire la syntaxe Markdown et garde l’adresse des liens', () => {
    const text = render(
      '## Ordre du jour\n\n**Samedi** à 10 h : [formulaire de pouvoir](https://asl.test/pouvoir).'
    )

    expect(text).toContain('Ordre du jour')
    expect(text).not.toContain('##')
    expect(text).not.toContain('**')
    expect(text).toContain('formulaire de pouvoir (https://asl.test/pouvoir)')
  })

  it('porte le titre, puis le pied : nom, raison sociale, mentions, motif, phrase finale', () => {
    const text = render('Bonjour')

    expect(text.startsWith('Peinture du portail')).toBe(true)
    for (const line of [
      'ASL Les Pins',
      'Association syndicale libre des Pins',
      '4 allée des Pins',
      'SIRET 000',
      'Vous recevez cet email parce que vous êtes membre de ASL Les Pins.',
      'Ne plus recevoir ces campagnes',
      'Se désinscrire ne vous prive d’aucune information obligatoire.',
    ]) {
      expect(text).toContain(line)
    }
  })

  it('n’écrit aucune ligne vide de mention quand elles manquent', () => {
    const text = renderCampaignText({
      heading: 'Objet',
      bodyMarkdown: 'Bonjour',
      values: {nom: '', parcelle: '', date: ''},
      footer: {
        associationName: 'ASL Les Pins',
        legalName: null,
        legalMentions: null,
        reason: 'Motif.',
        statutoryNotice: null,
        unsubscribeLabel: 'Ne plus recevoir',
        notice: 'Phrase.',
      },
      unsubscribeUrl: UNSUBSCRIBE_URL,
    })

    expect(text).not.toMatch(/\n{3,}/)
    expect(text).not.toContain('null')
  })
})

describe('renderCampaignText — envoi statutaire (s27b, critère 4)', () => {
  it('écrit la phrase statutaire avant le lien de désinscription des envois facultatifs', () => {
    const text = renderCampaignText({
      heading: 'Convocation',
      bodyMarkdown: 'Bonjour',
      values: {nom: '', parcelle: '', date: ''},
      footer: {
        associationName: 'ASL Les Pins',
        legalName: null,
        legalMentions: null,
        reason: 'Motif.',
        statutoryNotice: 'Phrase statutaire.',
        unsubscribeLabel: 'Ne plus recevoir les campagnes facultatives',
        notice: 'Phrase finale.',
      },
      unsubscribeUrl: UNSUBSCRIBE_URL,
    })

    expect(text).toContain(
      `Phrase statutaire.\n\nNe plus recevoir les campagnes facultatives : ${UNSUBSCRIBE_URL}`
    )
    expect(text.endsWith('Phrase finale.')).toBe(true)
  })

  it('un envoi facultatif n’écrit aucune phrase statutaire', () => {
    expect(render('Bonjour')).not.toContain('Phrase statutaire')
    expect(render('Bonjour')).not.toMatch(/\n\n\n/)
  })
})
