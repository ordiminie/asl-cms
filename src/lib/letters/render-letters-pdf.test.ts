import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs'
import {describe, expect, it, vi} from 'vitest'

import type {CampaignLetter} from '@/services/rules/campaign-letter-rules'

import {
  A4_MM,
  ADDRESS_FRAME_MM,
  FOOTER_TOP_MM,
  LETTER_MARGINS_MM,
  mmToPt,
} from './letter-geometry'
import {addressFrameOf} from './letter-geometry'
import {renderCalibrationPdf} from './render-calibration-pdf'
import {letterTextBlocksOf} from './render-letter-body'
import {RenderLettersInput, renderLettersPdf} from './render-letters-pdf'

vi.mock('server-only', () => ({}))

type PdfText = {
  str: string
  xMm: number
  yMm: number
  widthMm: number
  sizePt: number
  fontName: string
}
type PdfPage = {widthMm: number; heightMm: number; texts: PdfText[]}

const ptToMm = (pt: number) => pt / mmToPt(1)

/**
 * Relit le PDF produit (ADR 066 §4) : chaque texte avec la position de sa
 * ligne de base, en mm depuis le coin haut gauche de la page.
 */
const readPdf = async (
  rendered: Buffer | {pdf: Buffer}
): Promise<PdfPage[]> => {
  const buffer = Buffer.isBuffer(rendered) ? rendered : rendered.pdf
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
              widthMm: ptToMm(item.width),
              sizePt: Math.hypot(item.transform[0], item.transform[1]),
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
    continuation: ({name, page, pageCount}) =>
      `${name} — suite, page ${page}/${pageCount}`,
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

  it('une lettre de relance porte son propre corps : sa liste de factures (s29, ADR 070 §9)', async () => {
    const [first, second] = await readPdf(
      await renderLettersPdf(
        input({
          bodyMarkdown: 'Bonjour {nom},\n\n{factures}',
          letters: [
            letter({
              bodyMarkdown:
                'Bonjour {nom},\n\n- Facture 2026, parcelle 14 : 320,00 €',
            }),
            letter({
              name: 'Anne Roy',
              bodyMarkdown:
                'Bonjour {nom},\n\n- Facture 2026, parcelle 30 : 185,00 €',
            }),
          ],
        })
      )
    )

    expect(textOf(first)).toContain('Facture 2026, parcelle 14 : 320,00 €')
    expect(textOf(first)).not.toContain('{factures}')
    expect(textOf(second)).toContain('Bonjour Anne Roy,')
    expect(textOf(second)).toContain('Facture 2026, parcelle 30 : 185,00 €')
  })

  it('un courrier de lancement imprime ses blocs, jamais le corps de l’email (s42b, ADR 072 §6)', async () => {
    const [page] = await readPdf(
      await renderLettersPdf(
        input({
          subject: 'le site de ASL Les Pins est en ligne',
          bodyMarkdown: 'Ouvrez votre espace : https://x.test/login',
          bodyBlocks: letterTextBlocksOf(
            'Le site est en ligne.\n\nLe bureau',
            'Adresse du site : asl-les-pins.test'
          ),
        })
      )
    )
    const text = textOf(page)

    expect(text).toContain('Objet : le site de ASL Les Pins est en ligne')
    expect(text).toContain('Le site est en ligne.')
    expect(text).toContain('Adresse du site : asl-les-pins.test')
    expect(text).not.toContain('Ouvrez votre espace')
    expect(text).not.toContain('/login')
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

describe('renderLettersPdf — une ligne d’adresse plus large que le cadre (M1, §6.1)', () => {
  const LONG_LINE = 'Lotissement Les Hauts de la Fourche, Bâtiment B, Esc. 3'
  const WIDE_LINE = 'Résidence du Grand Chêne allée des Tilleuls 77'
  const addressTexts = (page: PdfPage, offsetYMm = 0) =>
    page.texts.filter(
      (text) =>
        text.yMm >= ADDRESS_FRAME_MM.y + offsetYMm &&
        text.yMm <= ADDRESS_FRAME_MM.y + offsetYMm + ADDRESS_FRAME_MM.height
    )

  for (const offset of [
    {xMm: 0, yMm: 0},
    {xMm: 3, yMm: -4},
  ]) {
    it(`le bord droit de chaque ligne reste dans le cadre (décalage ${offset.xMm}, ${offset.yMm})`, async () => {
      const lines = ['Marcel Laurent', LONG_LINE, '07140 Les Vans']
      const [page] = await readPdf(
        await renderLettersPdf(
          input({offset, letters: [letter({address: {source: 'home', lines}})]})
        )
      )

      const frame = addressFrameOf(offset)
      const drawn = addressTexts(page, offset.yMm)
      expect(drawn.length).toBeGreaterThan(0)
      expect(drawn.length).toBeLessThanOrEqual(4)
      for (const text of drawn) {
        expect(text.xMm).toBeCloseTo(frame.x, 3)
        expect(text.xMm + text.widthMm).toBeLessThanOrEqual(
          frame.x + frame.width + 0.01
        )
      }
    })
  }

  it('une ligne un peu trop large : le corps se réduit, la ligne reste entière', async () => {
    const lines = ['Marcel Laurent', WIDE_LINE, '69003 Lyon']
    const [page] = await readPdf(
      await renderLettersPdf(
        input({letters: [letter({address: {source: 'home', lines}})]})
      )
    )

    const wide = find(page, WIDE_LINE)
    expect(wide.sizePt).toBeLessThan(12)
    expect(wide.sizePt).toBeGreaterThanOrEqual(10)
    expect(wide.xMm + wide.widthMm).toBeLessThanOrEqual(
      ADDRESS_FRAME_MM.x + ADDRESS_FRAME_MM.width + 0.01
    )
  })

  it('une ligne bien trop large : coupée après une virgule, 4 lignes au plus', async () => {
    const lines = ['Marcel Laurent', LONG_LINE, '07140 Les Vans']
    const [page] = await readPdf(
      await renderLettersPdf(
        input({letters: [letter({address: {source: 'home', lines}})]})
      )
    )

    const drawn = addressTexts(page).map((text) => text.str)
    expect(drawn).toHaveLength(4)
    expect(drawn[0]).toBe('Marcel Laurent')
    expect(drawn[1]).toMatch(/,$/)
    expect(`${drawn[1]} ${drawn[2]}`).toBe(LONG_LINE)
    expect(drawn[3]).toBe('07140 Les Vans')
  })
})

describe('renderLettersPdf — une lettre plus longue qu’une page (C1, §6.1)', () => {
  const FOOTER = 'Courrier envoyé par voie postale'
  const longBody = () => {
    const paragraph =
      'Les travaux de voirie de la parcelle {parcelle} commencent lundi. Merci de laisser le passage libre aux engins, de garer les véhicules hors du chemin et de signaler au bureau toute gêne constatée. '
    const blocks = ['Bonjour {nom},']
    for (let index = 0; blocks.join('\n\n').length < 7_500; index++) {
      blocks.push(
        index % 4 === 1 ? '## Calendrier' : '',
        index % 4 === 2 ? '- **lundi** : terrassement\n- *mardi* : enrobé' : '',
        index % 4 === 3 ? '> Le portail restera ouvert de 8 h à 18 h.' : '',
        paragraph.repeat(2)
      )
    }
    return blocks.filter(Boolean).join('\n\n')
  }
  const longInput = () =>
    input({
      bodyMarkdown: longBody(),
      letters: [
        letter(),
        letter({
          memberProfileIds: ['p2'],
          name: 'Hélène Roy',
          address: {source: 'home', lines: ['Hélène Roy', '9 rue Haute']},
        }),
      ],
    })

  it('le corps fait au moins 7 000 caractères', () => {
    expect(longBody().length).toBeGreaterThanOrEqual(7_000)
  })

  it('annonce exactement le nombre de pages du PDF, plus d’une page par lettre', async () => {
    const rendered = await renderLettersPdf(longInput())
    const pages = await readPdf(rendered)

    expect(rendered.pageCount).toBe(pages.length)
    expect(pages.length).toBeGreaterThan(2)
  })

  it('aucun texte du corps sous le haut du pied, sur chaque page', async () => {
    const pages = await readPdf(await renderLettersPdf(longInput()))

    for (const page of pages) {
      const belowFooterTop = page.texts.filter(
        (text) => text.yMm > FOOTER_TOP_MM - 4
      )
      expect(belowFooterTop.map((text) => text.str).join(' ')).toMatch(
        new RegExp(`^${FOOTER}.*SIRET 123 456 789$`)
      )
    }
  })

  it('le pied est redessiné sur chaque page, aucun texte hors des marges', async () => {
    const pages = await readPdf(await renderLettersPdf(longInput()))

    for (const page of pages) {
      expect(textOf(page)).toContain(FOOTER)
      for (const text of page.texts) {
        expect(text.xMm).toBeGreaterThanOrEqual(LETTER_MARGINS_MM.left - 0.01)
        expect(text.xMm + text.widthMm).toBeLessThanOrEqual(
          A4_MM.width - LETTER_MARGINS_MM.right + 0.01
        )
        expect(text.yMm).toBeGreaterThan(LETTER_MARGINS_MM.top)
        expect(text.yMm).toBeLessThanOrEqual(
          A4_MM.height - LETTER_MARGINS_MM.bottom
        )
      }
    }
  })

  it('chaque lettre commence sur une nouvelle page ; ses pages de suite portent le repère', async () => {
    const pages = await readPdf(await renderLettersPdf(longInput()))
    const firstPages = pages.flatMap((page, index) =>
      textOf(page).includes('Objet :') ? [index] : []
    )

    expect(firstPages).toHaveLength(2)
    expect(firstPages[0]).toBe(0)
    const [, secondStart] = firstPages
    expect(textOf(pages[secondStart])).toContain('9 rue Haute')
    const ownPages = [
      ['Marcel Laurent', pages.slice(0, secondStart)],
      ['Hélène Roy', pages.slice(secondStart)],
    ] as const
    for (const [name, letterPages] of ownPages) {
      expect(letterPages.length).toBeGreaterThan(1)
      letterPages.slice(1).forEach((page, index) => {
        const marker = find(
          page,
          `${name} — suite, page ${index + 2}/${letterPages.length}`
        )
        expect(marker.yMm).toBeGreaterThan(LETTER_MARGINS_MM.top)
        expect(page.texts.every((text) => text.yMm >= marker.yMm - 0.01)).toBe(
          true
        )
        expect(textOf(page)).not.toContain('Objet :')
      })
    }
  })
})

describe('renderLettersPdf — pied, en-tête et repère bornés à la largeur utile (M2, §6.1)', () => {
  const MENTION_LINE =
    'Association syndicale libre La Fourche, siège : 12 chemin de la Fourche, 07140 Les Vans, SIRET 123 456 789 00012'
  const longMentions = () => {
    const lines = [MENTION_LINE]
    while (lines.join('\n').length < 500) lines.push(MENTION_LINE)
    return `${lines.join('\n').slice(0, 499)}.`
  }
  const LONG_NAME =
    'SOCIÉTÉ CIVILE IMMOBILIÈRE DES COPROPRIÉTAIRES DU DOMAINE DE LAFOURCHE'
  const LONG_ASSOCIATION =
    'Association syndicale libre des propriétaires du lotissement Les Hauts de la Fourche et du hameau du Grand Chêne réunis'
  const bodyOverOnePage = () =>
    [
      'Bonjour {nom},',
      ...Array.from(
        {length: 30},
        () =>
          'Les travaux de voirie de la parcelle {parcelle} commencent lundi. Merci de laisser le passage libre aux engins.'
      ),
    ].join('\n\n')
  const boundedInput = () =>
    input({
      association: {name: LONG_ASSOCIATION, legalMentions: longMentions()},
      bodyMarkdown: bodyOverOnePage(),
      letters: [
        letter({
          name: LONG_NAME,
          address: {source: 'home', lines: [LONG_NAME, '07140 Les Vans']},
        }),
      ],
    })
  const footerTexts = (page: PdfPage) =>
    page.texts.filter((text) => text.yMm > FOOTER_TOP_MM)

  it('les cas d’entrée sont aux bornes : mentions de 500 caractères, nom de 70', () => {
    expect(longMentions()).toHaveLength(500)
    expect(LONG_NAME).toHaveLength(70)
    expect(LONG_ASSOCIATION.length).toBeLessThanOrEqual(120)
  })

  it('aucun texte hors de x 20-190 mm, sur chaque page', async () => {
    const pages = await readPdf(await renderLettersPdf(boundedInput()))

    expect(pages.length).toBeGreaterThan(1)
    for (const page of pages) {
      for (const text of page.texts) {
        expect(text.xMm).toBeGreaterThanOrEqual(LETTER_MARGINS_MM.left - 0.01)
        expect(text.xMm + text.widthMm).toBeLessThanOrEqual(
          A4_MM.width - LETTER_MARGINS_MM.right + 0.01
        )
      }
    }
  })

  it('les mentions, entières, restent dans le pied : sous le filet, au-dessus de la marge basse', async () => {
    const pages = await readPdf(await renderLettersPdf(boundedInput()))
    const expected = longMentions().replace(/\s*\n\s*/g, ' · ')

    for (const page of pages) {
      const footer = footerTexts(page)
      expect(footer.map((text) => text.str).join(' ')).toBe(
        `${input().texts.footer} ${expected}`
      )
      for (const text of footer) {
        expect(text.yMm - ptToMm(text.sizePt)).toBeGreaterThanOrEqual(
          FOOTER_TOP_MM
        )
        expect(text.yMm).toBeLessThanOrEqual(
          A4_MM.height - LETTER_MARGINS_MM.bottom
        )
      }
      const body = page.texts.filter(
        (text) => text.yMm <= FOOTER_TOP_MM && text.yMm > FOOTER_TOP_MM - 30
      )
      for (const text of body) expect(text.yMm).toBeLessThan(FOOTER_TOP_MM - 4)
    }
  })

  it('des mentions qui ne tiennent pas au plancher sont coupées en « … », jamais sous la marge basse', async () => {
    const legalMentions = Array.from({length: 125}, () => 'SIRET').join('\n')
    const [page] = await readPdf(
      await renderLettersPdf(
        input({association: {name: 'ASL Les Pins', legalMentions}})
      )
    )

    const footer = footerTexts(page)
    expect(footer.at(-1)?.str).toMatch(/…$/)
    for (const text of footer) {
      expect(text.yMm).toBeLessThanOrEqual(
        A4_MM.height - LETTER_MARGINS_MM.bottom
      )
      expect(text.xMm + text.widthMm).toBeLessThanOrEqual(
        A4_MM.width - LETTER_MARGINS_MM.right + 0.01
      )
    }
  })

  it('le repère d’une page de suite garde « page n/N » malgré un nom long', async () => {
    const pages = await readPdf(await renderLettersPdf(boundedInput()))

    pages.slice(1).forEach((page, index) => {
      const marker = page.texts.find((text) =>
        text.str.endsWith(`— suite, page ${index + 2}/${pages.length}`)
      )
      expect(marker).toBeDefined()
      expect(marker?.yMm).toBeGreaterThan(LETTER_MARGINS_MM.top)
    })
  })

  it('un nom trop long même au plancher : le nom se coupe en « … », le repère garde « page n/N » dans la largeur', async () => {
    const name = `${LONG_NAME} ${LONG_NAME}`
    const pages = await readPdf(
      await renderLettersPdf({
        ...boundedInput(),
        letters: [letter({name, address: {source: 'home', lines: ['X']}})],
      })
    )

    expect(pages.length).toBeGreaterThan(1)
    const marker = find(pages[1], `— suite, page 2/${pages.length}`)
    expect(marker.str.startsWith('SOCIÉTÉ CIVILE')).toBe(true)
    expect(marker.str).toContain('…')
    expect(marker.xMm + marker.widthMm).toBeLessThanOrEqual(
      A4_MM.width - LETTER_MARGINS_MM.right + 0.01
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
