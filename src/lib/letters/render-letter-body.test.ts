import {describe, expect, it} from 'vitest'

import {
  letterBodyBlocksOf,
  letterTextBlocksOf,
  plainTextOfBlock,
} from './render-letter-body'

const values = {
  nom: 'Marcel Laurent',
  parcelle: '14 et 27',
  date: '12 novembre 2026',
}

/**
 * Le corps d'une campagne en blocs imprimables (ADR 066 §2) : l'arbre de
 * remark, le schema restreint du CMS, les variables remplacees dans les
 * noeuds texte, apres l'analyse.
 */
describe('letterBodyBlocksOf — le corps d’une lettre (ADR 066 §2)', () => {
  it('paragraphes, titres 2 et 3, listes et citation', () => {
    const blocks = letterBodyBlocksOf(
      'Bonjour {nom},\n\n## Ordre du jour\n\n### Point 1\n\n- un\n- deux\n\n1. premier\n\n> encadré',
      values
    )

    expect(blocks.map((block) => block.kind)).toEqual([
      'paragraph',
      'heading',
      'heading',
      'list',
      'list',
      'quote',
    ])
    expect(blocks[1]).toMatchObject({kind: 'heading', level: 2})
    expect(blocks[2]).toMatchObject({kind: 'heading', level: 3})
    expect(blocks[3]).toMatchObject({kind: 'list', ordered: false})
    expect(blocks[4]).toMatchObject({kind: 'list', ordered: true})
    expect(blocks.map(plainTextOfBlock)).toEqual([
      'Bonjour Marcel Laurent,',
      'Ordre du jour',
      'Point 1',
      'un\ndeux',
      'premier',
      'encadré',
    ])
  })

  it('remplace les variables dans le texte : {nom}, {parcelle}, {date}', () => {
    const [block] = letterBodyBlocksOf(
      'Parcelle {parcelle} de {nom}, le {date}. {inconnue}',
      values
    )

    expect(plainTextOfBlock(block)).toBe(
      'Parcelle 14 et 27 de Marcel Laurent, le 12 novembre 2026. {inconnue}'
    )
  })

  it('une valeur n’est jamais lue comme du Markdown', () => {
    const [block] = letterBodyBlocksOf('Bonjour {nom}', {
      ...values,
      nom: '**gras** _x_ [lien](https://x.fr)',
    })

    expect(plainTextOfBlock(block)).toBe(
      'Bonjour **gras** _x_ [lien](https://x.fr)'
    )
    expect(block.kind === 'paragraph' && block.runs).toEqual([
      {
        text: 'Bonjour **gras** _x_ [lien](https://x.fr)',
        bold: false,
        italic: false,
      },
    ])
  })

  it('garde le gras et l’italique écrits par le bureau', () => {
    const [block] = letterBodyBlocksOf('Un **mot** et un *autre*', values)

    expect(block.kind === 'paragraph' && block.runs).toEqual([
      {text: 'Un ', bold: false, italic: false},
      {text: 'mot', bold: true, italic: false},
      {text: ' et un ', bold: false, italic: false},
      {text: 'autre', bold: false, italic: true},
    ])
  })

  it('un lien s’imprime en clair : « texte (adresse) »', () => {
    const blocks = letterBodyBlocksOf(
      'Voir [le site](https://asl.test/ag) ou https://asl.test/docs',
      values
    )

    expect(plainTextOfBlock(blocks[0])).toBe(
      'Voir le site (https://asl.test/ag) ou https://asl.test/docs'
    )
  })

  it('un lien hors des protocoles permis garde son texte, sans adresse', () => {
    const [block] = letterBodyBlocksOf('[cliquez](javascript:alert(1))', values)

    expect(plainTextOfBlock(block)).toBe('cliquez')
  })

  it('le HTML brut et les images ne s’impriment pas ; un titre 1 devient du texte', () => {
    const blocks = letterBodyBlocksOf(
      '# Grand titre\n\n<script>alert(1)</script>\n\n![logo](https://x.fr/a.png)\n\nFin',
      values
    )

    expect(blocks.map(plainTextOfBlock)).toEqual(['Grand titre', 'Fin'])
    expect(blocks[0].kind).toBe('paragraph')
  })
})

describe('letterTextBlocksOf — le courrier du lancement (s42b, ADR 072 §6)', () => {
  it('des paragraphes **texte**, puis l’encart de l’adresse du site', () => {
    const blocks = letterTextBlocksOf(
      'Bonjour {nom},\r\n\r\n**gras** et # titre\n[x](https://piege.test) <b>b</b>\n\n\n',
      'Adresse du site : clos-fleuri.test'
    )

    expect(blocks).toEqual([
      {
        kind: 'paragraph',
        runs: [{text: 'Bonjour {nom},', bold: false, italic: false}],
      },
      {
        kind: 'paragraph',
        runs: [
          {
            text: '**gras** et # titre\n[x](https://piege.test) <b>b</b>',
            bold: false,
            italic: false,
          },
        ],
      },
      {
        kind: 'quote',
        paragraphs: [
          [
            {
              text: 'Adresse du site : clos-fleuri.test',
              bold: false,
              italic: false,
            },
          ],
        ],
      },
    ])
  })

  it('sans adresse de site, aucun encart', () => {
    expect(letterTextBlocksOf('Bonjour,', null).map((b) => b.kind)).toEqual([
      'paragraph',
    ])
    expect(plainTextOfBlock(letterTextBlocksOf('Bonjour,', null)[0])).toBe(
      'Bonjour,'
    )
  })
})
