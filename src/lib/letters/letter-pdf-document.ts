import PDFDocument from 'pdfkit'

import {AddressFit, fitAddressLines} from './letter-address-fit'
import {LetterFontFiles} from './letter-fonts.server'
import {
  A4_MM,
  ADDRESS_LINE_HEIGHT_MM,
  addressFrameOf,
  AddressOffsetMm,
  BODY_BOTTOM_MM,
  CONTINUATION_BODY_Y_MM,
  LETTER_MARGINS_MM,
  mmToPt,
} from './letter-geometry'

/**
 * Le document PDF commun aux lettres et a la page de calage (ADR 066) : A4,
 * polices embarquees, rendu en memoire. Les pages restent en memoire jusqu'a
 * la fin (`bufferPages`) : le repere « suite, page n/N » d'une lettre ne
 * s'ecrit qu'une fois son nombre de pages connu.
 */

/**
 * Deux polices : Public Sans Regular (corps, adresse) et Source Serif 4
 * SemiBold (en-tete, objet, titres : la graisse 600 du §6.1). pdfkit
 * dedoublonne les polices par nom PostScript et tables : une seconde instance
 * du meme woff2 variable serait remplacee par la premiere. Le gras du corps
 * est donc un trait epaissi de la Regular (`STRONG_STROKE_PT`).
 */
export const LETTER_FONTS = {
  regular: 'letter-regular',
  serif: 'letter-serif',
} as const

/** L'instance nommee de Public Sans embarquee (woff2 variable, defaut Thin). */
const SANS_REGULAR_INSTANCE = 'Regular'

/** Epaisseur du trait qui donne sa graisse a un passage en gras du corps. */
export const STRONG_STROKE_PT = 0.25

export type LetterDocument = InstanceType<typeof PDFDocument>

export const createLetterDocument = (
  fonts: LetterFontFiles
): LetterDocument => {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    autoFirstPage: false,
    bufferPages: true,
    compress: true,
  })
  doc.registerFont(LETTER_FONTS.regular, fonts.sans, SANS_REGULAR_INSTANCE)
  doc.registerFont(LETTER_FONTS.serif, fonts.serifSemiBold)
  return doc
}

/** Une page A4 sans marge : chaque element est place par ses coordonnees. */
export const addLetterPage = (doc: LetterDocument): void => {
  doc.addPage({size: 'A4', margin: 0})
}

/**
 * Une page de lettre (§6.1) : ses marges bornent le corps, de la marge haute
 * d'une page de suite jusqu'a 4 mm au-dessus du pied. Le corps qui deborde
 * continue sur une page aux memes marges, jamais sur le pied ni hors marge.
 */
export const addLetterBodyPage = (doc: LetterDocument): void => {
  doc.addPage({
    size: 'A4',
    margins: {
      top: mmToPt(CONTINUATION_BODY_Y_MM),
      bottom: mmToPt(A4_MM.height - BODY_BOTTOM_MM),
      left: mmToPt(LETTER_MARGINS_MM.left),
      right: mmToPt(LETTER_MARGINS_MM.right),
    },
  })
}

/** L'index de la derniere page du document, celle ou le corps s'ecrit. */
export const lastPageIndexOf = (doc: LetterDocument): number => {
  const range = doc.bufferedPageRange()
  return range.start + range.count - 1
}

/** La largeur d'un texte de l'adresse, mesuree sur la police embarquee. */
export const addressWidthOf =
  (doc: LetterDocument) =>
  (text: string, sizePt: number): number =>
    doc.font(LETTER_FONTS.regular).fontSize(sizePt).widthOfString(text)

/**
 * Le bloc adresse, dans le cadre decale du reglage (ADR 067 §2-4) : sans gras,
 * une ligne par entree, jamais plus large que le cadre (`fitAddressLines`) ;
 * une adresse qui ne tient pas est dessinee au plancher, et signalee au
 * bureau avant la generation.
 */
export const drawAddressBlock = (
  doc: LetterDocument,
  lines: readonly string[],
  offset: AddressOffsetMm
): AddressFit => {
  const frame = addressFrameOf(offset)
  const fit = fitAddressLines(lines, addressWidthOf(doc))
  doc.font(LETTER_FONTS.regular).fontSize(fit.sizePt)
  fit.lines.forEach((line, index) => {
    doc.text(
      line,
      mmToPt(frame.x),
      mmToPt(frame.y + index * ADDRESS_LINE_HEIGHT_MM),
      {lineBreak: false}
    )
  })
  return fit
}

/** Le PDF termine, en memoire : jamais ecrit sur le disque (ADR 066 §5). */
export const pdfBufferOf = (doc: LetterDocument): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
