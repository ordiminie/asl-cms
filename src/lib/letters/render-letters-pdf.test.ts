import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs'
import {describe, expect, it, vi} from 'vitest'

import type {CampaignLetter} from '@/services/rules/campaign-letter-rules'

import {A4_MM, ADDRESS_FRAME_MM, mmToPt} from './letter-geometry'
import {renderCalibrationPdf} from './render-calibration-pdf'
import {RenderLettersInput, renderLettersPdf} from './render-letters-pdf'

vi.mock('server-only', () => ({}))

type PdfText = {str: string; xMm: number; yMm: number; fontName: string}
type PdfPage = {widthMm: number; heightMm: number; texts: PdfText[]}

const ptToMm = (pt: number) => pt / mmToPt(1)

/**
 * Relit le PDF produit (ADR 066 §4) : chaque texte avec la position de sa
 * ligne de base, en mm depuis le coin haut gauche de la page.
 */
const readPdf = async (buffer: Buffer): Promise<PdfPage[]> => {
  const pdf = await getDocument({data: new Uint8Array(buffer)}).promise
  const pages: PdfPage[] = []
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number)
    const {width, height} = page.getViewport({scale: 1})
    const content = await page.getTextContent()
    const texts = content.items.flatMap((item) =>
      'str' in item && item.str.trim() !== ''
        ? [
            {
              str: item.str,
              xMm: ptToMm(item.transform[4]),
              yMm: ptToMm(height - item.transform[5]),
              fontName: item.fontName,
            },
          ]
        : []
    )
    pages.push({widthMm: ptToMm(width), heightMm: ptToMm(height), texts})
  }
  return pages
}

const textOf = (page: PdfPage) => page.texts.map((text) => text.str).join(' ')

const find = (page: PdfPage, str: string): PdfText => {
  const found = page.texts.find((text) => text.str.includes(str))
  if (!found) throw new Error(`texte absent : ${str}`)
  return found
}

const letter = (overrides: Partial<CampaignLetter> = {}): CampaignLetter => ({
  memberProfileIds: ['p1'],
  name: 'Marcel Laurent',
  address: {
    source: 'home',
    lines: ['Marcel Laurent', '4 rue des Lilas', '69003 Lyon'],
  },
  parcelle: '14',
  ...overrides,
})

const input = (
  overrides: Partial<RenderLettersInput> = {}
): RenderLettersInput => ({
  association: {name: 'ASL Les Pins', legalMentions: 'SIRET 123 456 789'},
  subject: 'Travaux de la parcelle {parcelle}',
  bodyMarkdown:
    'Bonjour {nom},\n\nLes travaux de la parcelle {parcelle} commencent.',
  sendDate: '2026-11-12',
  letters: [letter()],
  offset: {xMm: 0, yMm: 0},
  texts: {
    subjectLabel: 'Objet :',
    dateLine: 'Le 12 novembre 2026',
    footer: 'Courrier envoyé par voie postale, faute d’adresse email connue.',
  },
  ...overrides,
})

describe('renderLettersPdf — le lot imprimable (critères 1, 3, 4)', () => {
  it('un PDF A4, une page par lettre', async () => {
    const pages = await readPdf(
      await renderLettersPdf(
        input({
          letters: [
            letter(),
            letter({memberProfileIds: ['p2'], name: 'Hélène Roy'}),
            letter({memberProfileIds: ['p3'], name: 'Anne Dubois'}),
          ],
        })
      )
    )

    expect(pages).toHaveLength(3)
    for (const page of pages) {
      expect(page.widthMm).toBeCloseTo(A4_MM.width, 0)
      expect(page.heightMm).toBeCloseTo(A4_MM.height, 0)
    }
  })

  it('un corps réel, titres, listes, citation et liens compris, tient sur une page par lettre', async () => {
    const paragraph =
      'Les travaux de voirie de la parcelle {parcelle} commencent lundi. Merci de laisser le passage libre aux engins, et de garer les véhicules hors du chemin. '
    const bodyMarkdown = [
      'Bonjour {nom},',
      paragraph.repeat(3),
      '## Calendrier',
      '- **lundi** : terrassement',
      '- *mardi* : enrobé',
      '1. premier passage',
      '2. second passage',
      '> Le portail restera ouvert de 8 h à 18 h.',
      'Plus d’informations sur [le site](https://asl.test/voirie).',
      paragraph.repeat(2),
    ].join('\n\n')
    const pages = await readPdf(
      await renderLettersPdf(
        input({bodyMarkdown, letters: [letter(), letter({name: 'Hélène Roy'})]})
      )
    )

    expect(pages).toHaveLength(2)
    expect(textOf(pages[0])).toContain('(https://asl.test/voirie)')
    expect(textOf(pages[0])).toContain('Courrier envoyé par voie postale')
  })

  it('la première ligne d’adresse tombe dans le cadre x 25-115 mm · y 50-75 mm (critère 4)', async () => {
    const [page] = await readPdf(await renderLettersPdf(input()))
    const first = find(page, 'Marcel Laurent')

    expect(first.xMm).toBeGreaterThanOrEqual(25)
    expect(first.xMm).toBeLessThanOrEqual(115)
    expect(first.yMm).toBeGreaterThanOrEqual(50)
    expect(first.yMm).toBeLessThanOrEqual(75)
    const last = find(page, '69003 Lyon')
    expect(last.xMm).toBeCloseTo(first.xMm, 3)
    expect(last.yMm).toBeGreaterThan(first.yMm)
    expect(last.yMm).toBeLessThanOrEqual(
      ADDRESS_FRAME_MM.y + ADDRESS_FRAME_MM.height
    )
  })

  it('le réglage décale exactement le cadre de l’adresse, et lui seul', async () => {
    const [still] = await readPdf(await renderLettersPdf(input()))
    const [moved] = await readPdf(
      await renderLettersPdf(input({offset: {xMm: 3, yMm: -4}}))
    )

    const before = find(still, '4 rue des Lilas')
    const after = find(moved, '4 rue des Lilas')
    expect(after.xMm - before.xMm).toBeCloseTo(3, 3)
    expect(after.yMm - before.yMm).toBeCloseTo(-4, 3)
    expect(find(moved, 'Objet :').yMm).toBeCloseTo(
      find(still, 'Objet :').yMm,
      3
    )
    expect(find(moved, 'Bonjour').xMm).toBeCloseTo(
      find(still, 'Bonjour').xMm,
      3
    )
  })

  it('au plus 4 lignes d’adresse dans le cadre', async () => {
    const lines = [
      'Marcel Laurent',
      'SARL Laurent',
      '4 rue des Lilas, Bât. B',
      '69003 Lyon',
    ]
    const [page] = await readPdf(
      await renderLettersPdf(
        input({letters: [letter({address: {source: 'home', lines}})]})
      )
    )

    const inFrame = page.texts.filter(
      (text) =>
        text.yMm >= ADDRESS_FRAME_MM.y &&
        text.yMm <= ADDRESS_FRAME_MM.y + ADDRESS_FRAME_MM.height
    )
    expect(inFrame.map((text) => text.str)).toEqual(lines)
  })

  it('les variables du destinataire viennent du contenu de la campagne (critère 3)', async () => {
    const [page] = await readPdf(
      await renderLettersPdf(input({letters: [letter({parcelle: '14 et 27'})]}))
    )

    expect(textOf(page)).toContain('Bonjour Marcel Laurent,')
    expect(textOf(page)).toContain(
      'Les travaux de la parcelle 14 et 27 commencent.'
    )
    expect(textOf(page)).toContain('Objet : Travaux de la parcelle 14 et 27')
    expect(textOf(page)).toContain('Le 12 novembre 2026')
    expect(textOf(page)).toContain('ASL Les Pins')
  })

  it('l’objet et les titres sont dans une autre police que le corps (graisse 600, §6.1)', async () => {
    const [page] = await readPdf(
      await renderLettersPdf(
        input({bodyMarkdown: 'Bonjour {nom},\n\n## Calendrier\n\nFin.'})
      )
    )

    const body = find(page, 'Bonjour').fontName
    expect(find(page, 'Objet :').fontName).not.toBe(body)
    expect(find(page, 'Calendrier').fontName).not.toBe(body)
    expect(find(page, '4 rue des Lilas').fontName).toBe(body)
  })

  it('une valeur `**gras**` substituée reste littérale', async () => {
    const [page] = await readPdf(
      await renderLettersPdf(input({letters: [letter({name: '**gras**'})]}))
    )

    expect(textOf(page)).toContain('Bonjour **gras**,')
  })

  it('aucun texte de désinscription ; le pied postal et les mentions légales', async () => {
    const [page] = await readPdf(await renderLettersPdf(input()))
    const text = textOf(page)

    expect(text).not.toMatch(/désinscri|unsubscribe/i)
    expect(text).toContain(
      'Courrier envoyé par voie postale, faute d’adresse email connue.'
    )
    expect(text).toContain('SIRET 123 456 789')
    expect(find(page, 'Courrier envoyé').yMm).toBeLessThanOrEqual(
      A4_MM.height - 20
    )
  })
})

describe('renderCalibrationPdf — la page de calage (ADR 067 §4)', () => {
  const texts = {
    sampleLines: ['Nom du destinataire', 'Adresse', 'Code postal Ville'],
    instruction: 'Glissez cette feuille pliée dans une enveloppe à fenêtre.',
  }

  it('une page A4, l’adresse d’exemple à sa place réelle', async () => {
    const pages = await readPdf(
      await renderCalibrationPdf({offset: {xMm: 0, yMm: 0}, texts})
    )

    expect(pages).toHaveLength(1)
    expect(pages[0].widthMm).toBeCloseTo(A4_MM.width, 0)
    const sample = find(pages[0], 'Nom du destinataire')
    expect(sample.xMm).toBeGreaterThanOrEqual(25)
    expect(sample.yMm).toBeGreaterThanOrEqual(50)
    expect(sample.yMm).toBeLessThanOrEqual(75)
    expect(textOf(pages[0])).toContain(texts.instruction)
  })

  it('le même décalage que les lettres', async () => {
    const offset = {xMm: -2, yMm: 5}
    const [calibration] = await readPdf(
      await renderCalibrationPdf({offset, texts})
    )
    const [lettersPage] = await readPdf(
      await renderLettersPdf(
        input({
          offset,
          letters: [
            letter({address: {source: 'home', lines: ['Nom du destinataire']}}),
          ],
        })
      )
    )

    const sample = find(calibration, 'Nom du destinataire')
    const real = find(lettersPage, 'Nom du destinataire')
    expect(sample.xMm).toBeCloseTo(real.xMm, 3)
    expect(sample.yMm).toBeCloseTo(real.yMm, 3)
  })
})
