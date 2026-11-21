import {letterFontFilesOf} from './letter-fonts.server'
import {
  A4_MM,
  addressFrameOf,
  AddressOffsetMm,
  DL_WINDOW_MM,
  FOLD_LINES_MM,
  LETTER_MARGINS_MM,
  mmToPt,
  RectMm,
} from './letter-geometry'
import {
  addLetterPage,
  createLetterDocument,
  drawAddressBlock,
  LETTER_FONTS,
  LetterDocument,
  pdfBufferOf,
} from './letter-pdf-document'

/**
 * La page de calage (s28, ADR 067 §4) : une A4 noir et blanc, le contour de
 * la fenetre DL, le cadre de l'adresse decale du reglage, une adresse
 * d'exemple a sa place reelle, les deux plis et la consigne. Les textes
 * viennent de l'appelant, traduits, decalage applique compris.
 */
export type RenderCalibrationInput = {
  offset: AddressOffsetMm
  texts: {sampleLines: readonly string[]; instruction: string}
}

const RULE_WIDTH_PT = 0.5
const DASH_PT = 3
const INSTRUCTION_SIZE_PT = 11
/** La consigne, sous le premier pli : jamais coupee par un repere. */
const INSTRUCTION_Y_MM = FOLD_LINES_MM[0] + 8

const strokeRect = (doc: LetterDocument, rect: RectMm, dashed: boolean) => {
  doc.lineWidth(RULE_WIDTH_PT)
  if (dashed) doc.dash(DASH_PT, {space: DASH_PT})
  doc
    .rect(
      mmToPt(rect.x),
      mmToPt(rect.y),
      mmToPt(rect.width),
      mmToPt(rect.height)
    )
    .stroke('black')
  doc.undash()
}

const drawFolds = (doc: LetterDocument) => {
  doc.lineWidth(RULE_WIDTH_PT).dash(DASH_PT, {space: DASH_PT})
  for (const y of FOLD_LINES_MM) {
    doc
      .moveTo(0, mmToPt(y))
      .lineTo(mmToPt(A4_MM.width), mmToPt(y))
      .stroke('black')
  }
  doc.undash()
}

/** Le PDF d'une page de calage, en memoire. */
export const renderCalibrationPdf = (
  input: RenderCalibrationInput
): Promise<Buffer> => {
  const doc = createLetterDocument(letterFontFilesOf())
  addLetterPage(doc)
  strokeRect(doc, DL_WINDOW_MM, false)
  strokeRect(doc, addressFrameOf(input.offset), true)
  drawAddressBlock(doc, input.texts.sampleLines, input.offset)
  drawFolds(doc)
  doc.font(LETTER_FONTS.regular).fontSize(INSTRUCTION_SIZE_PT)
  doc.text(
    input.texts.instruction,
    mmToPt(LETTER_MARGINS_MM.left),
    mmToPt(INSTRUCTION_Y_MM),
    {
      width: mmToPt(
        A4_MM.width - LETTER_MARGINS_MM.left - LETTER_MARGINS_MM.right
      ),
    }
  )
  return pdfBufferOf(doc)
}
