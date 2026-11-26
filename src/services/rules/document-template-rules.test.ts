import {describe, expect, it} from 'vitest'

import {
  uniqueProfilesOf,
  unknownTemplateVariablesOf,
  usedTemplateVariablesOf,
} from './document-template-rules'

describe('unknownTemplateVariablesOf — une variable inconnue est signalée (critère 4)', () => {
  it('accepte les quatre variables des documents, {association} comprise', () => {
    expect(
      unknownTemplateVariablesOf({
        subject: 'Convocation de {nom}',
        bodyMarkdown: '{nom}, parcelles {parcelle}, le {date}, {association}.',
      })
    ).toEqual({subject: [], bodyMarkdown: []})
  })

  it('refuse {adresse} et {date_ag}, nommées une fois chacune dans l’ordre', () => {
    expect(
      unknownTemplateVariablesOf({
        subject: 'Objet',
        bodyMarkdown: '{adresse} puis {date_ag}, encore {adresse}.',
      }).bodyMarkdown
    ).toEqual(['adresse', 'date_ag'])
  })

  it('refuse {factures}, propre à la relance automatique (s29)', () => {
    expect(
      unknownTemplateVariablesOf({subject: '', bodyMarkdown: '{factures}'})
        .bodyMarkdown
    ).toEqual(['factures'])
  })

  it('vérifie l’objet autant que le texte', () => {
    expect(
      unknownTemplateVariablesOf({
        subject: 'Pour {adresse}',
        bodyMarkdown: 'Bonjour {nom}',
      })
    ).toEqual({subject: ['adresse'], bodyMarkdown: []})
  })
})

describe('usedTemplateVariablesOf — colonne « Variables » de la liste', () => {
  it('rend les variables connues employées, une fois, dans l’ordre des quatre', () => {
    expect(
      usedTemplateVariablesOf({
        subject: '{association} — {date}',
        bodyMarkdown: '{nom} {nom} {inconnue}',
      })
    ).toEqual(['nom', 'date', 'association'])
  })

  it('rend une liste vide sans variable', () => {
    expect(
      usedTemplateVariablesOf({subject: 'Objet', bodyMarkdown: 'Texte'})
    ).toEqual([])
  })
})

describe('uniqueProfilesOf — une fiche par identifiant (unité du lot)', () => {
  it('garde une ligne quand une fiche en porte trois', () => {
    const rows = [
      {memberProfileId: 'a', email: 'a1@x.fr'},
      {memberProfileId: 'a', email: 'a2@x.fr'},
      {memberProfileId: 'b', email: null},
      {memberProfileId: 'a', email: 'a3@x.fr'},
    ]
    expect(uniqueProfilesOf(rows)).toEqual([
      {memberProfileId: 'a', email: 'a1@x.fr'},
      {memberProfileId: 'b', email: null},
    ])
  })
})
