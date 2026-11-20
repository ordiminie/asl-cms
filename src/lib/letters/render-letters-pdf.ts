import type {CampaignLetter} from '@/services/rules/campaign-letter-rules'
import {
  formatCampaignDate,
  substituteVariables,
} from '@/services/rules/campaign-rules'
import {getAssociationMonogram} from '@/services/types/domain/association-identity-types'
import type {CampaignVariableValues} from '@/services/types/domain/campaign-types'

import {letterFontFilesOf} from './letter-fonts.server'
import {
  A4_MM,
  AddressOffsetMm,
  BODY_FONT_SIZE_PT,
  BODY_LINE_HEIGHT,
  BODY_MIN_FONT_SIZE_PT,
  BODY_Y_MM,
  DATE_Y_MM,
  FOOTER_HEIGHT_MM,
  HEADER_MARK_MM,
  LETTER_MARGINS_MM,
  mmToPt,
  SUBJECT_FONT_SIZE_PT,
  SUBJECT_Y_MM,
} from './letter-geometry'
import {
  addLetterPage,
  createLetterDocument,
  drawAddressBlock,
  LETTER_FONTS,
  LetterDocument,
  pdfBufferOf,
  STRONG_STROKE_PT,
} from './letter-pdf-document'
import {LetterBlock, letterBodyBlocksOf, LetterRun} from './render-letter-body'

/**
 * Le lot du courrier postal (s28, ADR 066) : un seul PDF, une lettre par page
 * (§6.1), noir et blanc. Les textes fixes (« Objet : », date, pied) viennent
 * de l'appelant, traduits : aucun libelle n'est ecrit ici.
 */
export type RenderLettersInput = {
  association: {name: string; legalMentions: string | null}
  /** Objet et corps de la campagne, tels qu'ecrits (variables non remplacees). */
  subject: string
  bodyMarkdown: string
  /** Jour d'envoi de la campagne (`YYYY-MM-DD`), valeur de `{date}`. */
  sendDate: string
  letters: readonly CampaignLetter[]
  offset: AddressOffsetMm
  texts: {subjectLabel: string; dateLine: string; footer: string}
}

const CONTENT_X_MM = LETTER_MARGINS_MM.left
const CONTENT_WIDTH_MM =
  A4_MM.width - LETTER_MARGINS_MM.left - LETTER_MARGINS_MM.right
const FOOTER_TOP_MM = A4_MM.height - LETTER_MARGINS_MM.bottom - FOOTER_HEIGHT_MM
const HEADER_NAME_SIZE_PT = 14
const FOOTER_SIZE_PT = 9
const MENTIONS_SIZE_PT = 8
const RULE_WIDTH_PT = 0.5
const FRAME_WIDTH_PT = 1
const LIST_INDENT_MM = 6
const QUOTE_PADDING_MM = 3
const BODY_SIZE_STEP_PT = 0.5
/** Oblique de l'italique, en degres : la police du site n'a pas d'italique. */
const ITALIC_SKEW_DEG = 10

const x = (mm: number) => mmToPt(mm)

const drawHeader = (doc: LetterDocument, name: string): void => {
  const size = x(HEADER_MARK_MM)
  const top = x(LETTER_MARGINS_MM.top)
  const left = x(CONTENT_X_MM)
  doc.lineWidth(FRAME_WIDTH_PT).rect(left, top, size, size).stroke('black')
  const monogram = getAssociationMonogram(name)
  doc.font(LETTER_FONTS.serif).fontSize(HEADER_NAME_SIZE_PT).fillColor('black')
  doc.text(monogram, left, top + (size - doc.currentLineHeight()) / 2, {
    width: size,
    align: 'center',
    lineBreak: false,
  })
  doc.text(
    name,
    left + size + x(4),
    top + (size - doc.currentLineHeight()) / 2,
    {lineBreak: false}
  )
}

const drawDateLine = (doc: LetterDocument, dateLine: string): void => {
  doc.font(LETTER_FONTS.regular).fontSize(BODY_FONT_SIZE_PT)
  const right = x(CONTENT_X_MM + CONTENT_WIDTH_MM)
  doc.text(dateLine, right - doc.widthOfString(dateLine), x(DATE_Y_MM), {
    lineBreak: false,
  })
}

const drawSubject = (doc: LetterDocument, subject: string): number => {
  doc.font(LETTER_FONTS.serif).fontSize(SUBJECT_FONT_SIZE_PT)
  doc.text(subject, x(CONTENT_X_MM), x(SUBJECT_Y_MM), {
    width: x(CONTENT_WIDTH_MM),
  })
  return doc.y
}

const drawFooter = (
  doc: LetterDocument,
  footer: string,
  legalMentions: string | null
): void => {
  const top = x(FOOTER_TOP_MM)
  doc
    .lineWidth(RULE_WIDTH_PT)
    .moveTo(x(CONTENT_X_MM), top)
    .lineTo(x(CONTENT_X_MM + CONTENT_WIDTH_MM), top)
    .stroke('black')
  doc.font(LETTER_FONTS.regular).fontSize(FOOTER_SIZE_PT)
  doc.text(footer, x(CONTENT_X_MM), top + x(3), {lineBreak: false})
  const mentions = legalMentions?.replace(/\s*\n\s*/g, ' · ').trim()
  if (mentions) {
    doc.fontSize(MENTIONS_SIZE_PT)
    doc.text(mentions, x(CONTENT_X_MM), top + x(8), {lineBreak: false})
  }
}

type BodyLayout = {size: number; lineGap: number}

const lineGapOf = (doc: LetterDocument, size: number): number => {
  doc.font(LETTER_FONTS.regular).fontSize(size)
  return Math.max(0, size * BODY_LINE_HEIGHT - doc.currentLineHeight())
}

const headingSizeOf = (level: 2 | 3, size: number) =>
  level === 2 ? size + 2 : size + 1

const textOfRuns = (runs: readonly LetterRun[]) =>
  runs.map((run) => run.text).join('')

const blockGapOf = (layout: BodyLayout) => layout.size * 0.6

/** La hauteur du corps a cette taille, pour choisir la plus grande qui tient. */
const measureBody = (
  doc: LetterDocument,
  blocks: readonly LetterBlock[],
  layout: BodyLayout
): number =>
  blocks.reduce((height, block) => {
    const width = x(CONTENT_WIDTH_MM)
    const options = {lineGap: layout.lineGap}
    if (block.kind === 'heading') {
      doc
        .font(LETTER_FONTS.serif)
        .fontSize(headingSizeOf(block.level, layout.size))
      return (
        height +
        doc.heightOfString(textOfRuns(block.runs), {width}) +
        blockGapOf(layout)
      )
    }
    doc.font(LETTER_FONTS.regular).fontSize(layout.size)
    const lines =
      block.kind === 'paragraph'
        ? [{runs: block.runs, width}]
        : block.kind === 'list'
          ? block.items.map((runs) => ({
              runs,
              width: width - x(LIST_INDENT_MM),
            }))
          : block.paragraphs.map((runs) => ({
              runs,
              width: width - 2 * x(QUOTE_PADDING_MM),
            }))
    const own = lines.reduce(
      (sum, line) =>
        sum +
        doc.heightOfString(textOfRuns(line.runs), {
          ...options,
          width: line.width,
        }),
      block.kind === 'quote' ? 2 * x(QUOTE_PADDING_MM) : 0
    )
    return height + own + blockGapOf(layout)
  }, 0)

const chooseLayout = (
  doc: LetterDocument,
  blocks: readonly LetterBlock[],
  available: number
): BodyLayout => {
  for (
    let size = BODY_FONT_SIZE_PT;
    size > BODY_MIN_FONT_SIZE_PT;
    size -= BODY_SIZE_STEP_PT
  ) {
    const layout = {size, lineGap: lineGapOf(doc, size)}
    if (measureBody(doc, blocks, layout) <= available) return layout
  }
  return {
    size: BODY_MIN_FONT_SIZE_PT,
    lineGap: lineGapOf(doc, BODY_MIN_FONT_SIZE_PT),
  }
}

/**
 * Des passages a la suite, sur la largeur donnee. Dans le corps, un passage
 * en gras est la Regular au trait epaissi (voir `LETTER_FONTS`) ; un titre
 * passe sa propre police.
 */
const drawRuns = (
  doc: LetterDocument,
  runs: readonly LetterRun[],
  left: number,
  top: number,
  width: number,
  layout: BodyLayout,
  font: string = LETTER_FONTS.regular
): void => {
  doc.lineWidth(STRONG_STROKE_PT).strokeColor('black').fillColor('black')
  runs.forEach((run, index) => {
    doc.font(font).fontSize(layout.size)
    const options = {
      width,
      lineGap: layout.lineGap,
      continued: index < runs.length - 1,
      oblique: run.italic ? ITALIC_SKEW_DEG : false,
      fill: true,
      stroke: run.bold && font === LETTER_FONTS.regular,
    }
    if (index === 0) doc.text(run.text, left, top, options)
    else doc.text(run.text, options)
  })
}

const drawBlock = (
  doc: LetterDocument,
  block: LetterBlock,
  layout: BodyLayout
): void => {
  const left = x(CONTENT_X_MM)
  const width = x(CONTENT_WIDTH_MM)
  if (block.kind === 'paragraph') {
    drawRuns(doc, block.runs, left, doc.y, width, layout)
  } else if (block.kind === 'heading') {
    drawRuns(
      doc,
      block.runs,
      left,
      doc.y,
      width,
      {...layout, size: headingSizeOf(block.level, layout.size)},
      LETTER_FONTS.serif
    )
  } else if (block.kind === 'list') {
    block.items.forEach((runs, index) => {
      const top = doc.y
      doc.font(LETTER_FONTS.regular).fontSize(layout.size)
      doc.text(block.ordered ? `${index + 1}.` : '•', left, top, {
        lineBreak: false,
      })
      drawRuns(
        doc,
        runs,
        left + x(LIST_INDENT_MM),
        top,
        width - x(LIST_INDENT_MM),
        layout
      )
    })
  } else {
    const top = doc.y
    doc.y = top + x(QUOTE_PADDING_MM)
    for (const runs of block.paragraphs) {
      drawRuns(
        doc,
        runs,
        left + x(QUOTE_PADDING_MM),
        doc.y,
        width - 2 * x(QUOTE_PADDING_MM),
        layout
      )
    }
    const bottom = doc.y + x(QUOTE_PADDING_MM)
    doc
      .lineWidth(FRAME_WIDTH_PT)
      .rect(left, top, width, bottom - top)
      .stroke('black')
    doc.y = bottom
  }
  doc.y += blockGapOf(layout)
}

const drawBody = (
  doc: LetterDocument,
  blocks: readonly LetterBlock[],
  top: number
): void => {
  const start = Math.max(top + x(4), x(BODY_Y_MM))
  const layout = chooseLayout(doc, blocks, x(FOOTER_TOP_MM - 4) - start)
  doc.y = start
  for (const block of blocks) drawBlock(doc, block, layout)
}

const valuesOf = (
  letter: CampaignLetter,
  sendDate: string
): CampaignVariableValues => ({
  nom: letter.name,
  parcelle: letter.parcelle,
  date: formatCampaignDate(sendDate),
})

const drawLetter = (
  doc: LetterDocument,
  input: RenderLettersInput,
  letter: CampaignLetter
): void => {
  const values = valuesOf(letter, input.sendDate)
  addLetterPage(doc)
  drawFooter(doc, input.texts.footer, input.association.legalMentions)
  drawHeader(doc, input.association.name)
  drawAddressBlock(doc, letter.address.lines, input.offset)
  drawDateLine(doc, input.texts.dateLine)
  const subject = substituteVariables(input.subject, values, (v) => v)
  const subjectBottom = drawSubject(
    doc,
    `${input.texts.subjectLabel} ${subject}`
  )
  drawBody(doc, letterBodyBlocksOf(input.bodyMarkdown, values), subjectBottom)
}

/** Le PDF du lot, une page par lettre, dans l'ordre recu (trie par nom). */
export const renderLettersPdf = (
  input: RenderLettersInput
): Promise<Buffer> => {
  const doc = createLetterDocument(letterFontFilesOf())
  for (const letter of input.letters) drawLetter(doc, input, letter)
  return pdfBufferOf(doc)
}
