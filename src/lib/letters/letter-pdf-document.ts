import PDFDocument from 'pdfkit'

import {LetterFontFiles} from './letter-fonts.server'
import {
  ADDRESS_FONT_SIZE_PT,
  ADDRESS_LINE_HEIGHT_MM,
  addressFrameOf,
  AddressOffsetMm,
  mmToPt,
} from './letter-geometry'

/**
 * Le document PDF commun aux lettres et a la page de calage (ADR 066) : A4,
 * polices embarquees, aucune page automatique, rendu en memoire.
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
 * Le bloc adresse, dans le cadre decale du reglage (ADR 067 §2-4) : 12 pt,
 * sans gras, une ligne par entree, jamais renvoyee a la ligne.
 */
export const drawAddressBlock = (
  doc: LetterDocument,
  lines: readonly string[],
  offset: AddressOffsetMm
): void => {
  const frame = addressFrameOf(offset)
  doc.font(LETTER_FONTS.regular).fontSize(ADDRESS_FONT_SIZE_PT)
  lines.forEach((line, index) => {
    doc.text(
      line,
      mmToPt(frame.x),
      mmToPt(frame.y + index * ADDRESS_LINE_HEIGHT_MM),
      {lineBreak: false}
    )
  })
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
