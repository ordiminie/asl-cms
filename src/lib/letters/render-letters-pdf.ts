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
  BODY_BOTTOM_MM,
  BODY_FONT_SIZE_PT,
  BODY_LINE_HEIGHT,
  BODY_MIN_FONT_SIZE_PT,
  BODY_Y_MM,
  DATE_Y_MM,
  FOOTER_TOP_MM,
  HEADER_MARK_MM,
  LETTER_MARGINS_MM,
  mmToPt,
  SUBJECT_FONT_SIZE_PT,
  SUBJECT_Y_MM,
} from './letter-geometry'
import {
  addLetterBodyPage,
  createLetterDocument,
  drawAddressBlock,
  lastPageIndexOf,
  LETTER_FONTS,
  LetterDocument,
  pdfBufferOf,
  STRONG_STROKE_PT,
} from './letter-pdf-document'
import {LetterBlock, letterBodyBlocksOf, LetterRun} from './render-letter-body'

/**
 * Le lot du courrier postal (s28, ADR 066) : un seul PDF, une suite de
 * lettres, chacune commencant sur une nouvelle page (§6.1), noir et blanc.
 * Les textes fixes (« Objet : », date, pied, repere de suite) viennent de
 * l'appelant, traduits : aucun libelle n'est ecrit ici.
 */
export type RenderLettersInput = {
  association: {name: string; legalMentions: string | null}
  /** Objet et corps de la campagne, tels qu'ecrits (variables non remplacees). */
  subject: string
  bodyMarkdown: string
  /**
   * Le corps deja mis en blocs, a la place de `bodyMarkdown` : le courrier du
   * lancement des invitations (s42b, ADR 072 §6), texte sans variable.
   */
  bodyBlocks?: LetterBlock[]
  /** Jour d'envoi de la campagne (`YYYY-MM-DD`), valeur de `{date}`. */
  sendDate: string
  /**
   * Des variables en plus de celles des campagnes, remplacees dans l'objet et
   * le corps : `{association}` des documents (s36, ADR 074 §2). Aucune par
   * defaut.
   */
  extraValues?: Readonly<Record<string, string>>
  letters: readonly CampaignLetter[]
  offset: AddressOffsetMm
  texts: {
    subjectLabel: string
    dateLine: string
    footer: string
    /** Le repere en tete d'une page de suite : « <nom> — suite, page n/N ». */
    continuation: (values: ContinuationValues) => string
  }
}

export type ContinuationValues = {name: string; page: number; pageCount: number}

/** Le lot rendu et son nombre de pages, annonce au bureau (§6.1). */
export type RenderedLetters = {pdf: Buffer; pageCount: number}

const CONTENT_X_MM = LETTER_MARGINS_MM.left
const CONTENT_WIDTH_MM =
  A4_MM.width - LETTER_MARGINS_MM.left - LETTER_MARGINS_MM.right
const HEADER_NAME_SIZE_PT = 14
/** Plancher du nom de l'en-tete, ramene a la largeur utile (§6.1). */
const HEADER_NAME_MIN_SIZE_PT = 11
const HEADER_NAME_GAP_MM = 4
const CONTINUATION_SIZE_PT = 10
/** Plancher du repere de suite ; en dessous, le nom se coupe en « … ». */
const CONTINUATION_MIN_SIZE_PT = 8
const FOOTER_SIZE_PT = 9
const MENTIONS_SIZE_PT = 8
/** Plancher des mentions : 500 caracteres tiennent en 4 lignes dans le pied. */
const MENTIONS_MIN_SIZE_PT = 6
/** De la phrase postale au filet du pied. */
const FOOTER_TEXT_GAP_MM = 2
const TEXT_SIZE_STEP_PT = 0.5
const RULE_WIDTH_PT = 0.5
const FRAME_WIDTH_PT = 1
const LIST_INDENT_MM = 6
const QUOTE_PADDING_MM = 3
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
  const nameLeft = left + size + x(HEADER_NAME_GAP_MM)
  const nameWidth = x(CONTENT_X_MM + CONTENT_WIDTH_MM) - nameLeft
  doc.fontSize(
    lineSizeOf(doc, name, nameWidth, {
      size: HEADER_NAME_SIZE_PT,
      floor: HEADER_NAME_MIN_SIZE_PT,
    })
  )
  drawBoundedLine(doc, name, {
    left: nameLeft,
    top: top + (size - doc.currentLineHeight()) / 2,
    width: nameWidth,
  })
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

/**
 * La plus grande taille, du corps demande jusqu'au plancher, ou le texte tient
 * sur une ligne de la largeur donnee ; la police doit etre choisie.
 */
const lineSizeOf = (
  doc: LetterDocument,
  text: string,
  width: number,
  sizes: {size: number; floor: number}
): number =>
  largestFittingSizeOf(sizes, (candidate) => {
    doc.fontSize(candidate)
    return doc.widthOfString(text) <= width
  })

/**
 * Une ligne bornee a la largeur donnee (§6.1), a la taille courante : ce qui
 * deborde encore est coupe, termine par « … ».
 */
const drawBoundedLine = (
  doc: LetterDocument,
  text: string,
  at: {left: number; top: number; width: number}
): void => {
  doc.text(text, at.left, at.top, {
    width: at.width,
    height: doc.currentLineHeight(true),
    ellipsis: true,
  })
}

const largestFittingSizeOf = (
  sizes: {size: number; floor: number},
  fits: (size: number) => boolean
): number => {
  for (let size = sizes.size; size > sizes.floor; size -= TEXT_SIZE_STEP_PT) {
    if (fits(size)) return size
  }
  return sizes.floor
}

/**
 * Le pied (§6.1), dans ses 16 mm au-dessus de la marge basse : la phrase
 * postale sur une ligne, puis les mentions legales a la ligne sur la largeur
 * utile, reduites jusqu'au plancher si elles ne tiennent pas dans la hauteur
 * restante, coupees en « … » au plancher.
 */
const drawFooter = (
  doc: LetterDocument,
  footer: string,
  legalMentions: string | null
): void => {
  const top = x(FOOTER_TOP_MM)
  const left = x(CONTENT_X_MM)
  const width = x(CONTENT_WIDTH_MM)
  doc
    .lineWidth(RULE_WIDTH_PT)
    .moveTo(left, top)
    .lineTo(left + width, top)
    .stroke('black')
  doc.font(LETTER_FONTS.regular).fontSize(FOOTER_SIZE_PT)
  drawBoundedLine(doc, footer, {
    left,
    top: top + x(FOOTER_TEXT_GAP_MM),
    width,
  })
  const mentions = legalMentions?.replace(/\s*\n\s*/g, ' · ').trim()
  if (!mentions) return
  const mentionsTop = doc.y
  const height = x(A4_MM.height - LETTER_MARGINS_MM.bottom) - mentionsTop
  const size = largestFittingSizeOf(
    {size: MENTIONS_SIZE_PT, floor: MENTIONS_MIN_SIZE_PT},
    (candidate) => {
      doc.fontSize(candidate)
      return doc.heightOfString(mentions, {width}) <= height
    }
  )
  doc.fontSize(size)
  doc.text(mentions, left, mentionsTop, {width, height, ellipsis: true})
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
    size -= TEXT_SIZE_STEP_PT
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

const lineHeightOf = (
  doc: LetterDocument,
  layout: BodyLayout,
  font: string = LETTER_FONTS.regular,
  size: number = layout.size
): number => {
  doc.font(font).fontSize(size)
  return doc.currentLineHeight(true) + layout.lineGap
}

/** Passe a une page de suite si la hauteur demandee ne tient plus. */
const ensureRoom = (doc: LetterDocument, height: number): void => {
  if (doc.y + height > doc.page.maxY()) doc.continueOnNewPage()
}

/**
 * Le cadre d'une citation, page par page : une citation coupee par une page
 * de suite garde ses deux bords sur chaque page, son haut sur la premiere et
 * son bas sur la derniere.
 */
const drawQuoteFrame = (
  doc: LetterDocument,
  start: {page: number; y: number},
  end: {page: number; y: number}
): void => {
  const left = x(CONTENT_X_MM)
  const right = left + x(CONTENT_WIDTH_MM)
  for (let page = start.page; page <= end.page; page++) {
    doc.switchToPage(page)
    const top = page === start.page ? start.y : doc.page.margins.top
    const bottom = page === end.page ? end.y : doc.page.maxY()
    doc.lineWidth(FRAME_WIDTH_PT)
    if (start.page === end.page) {
      doc.rect(left, top, right - left, bottom - top).stroke('black')
    } else {
      doc.moveTo(left, top).lineTo(left, bottom).stroke('black')
      doc.moveTo(right, top).lineTo(right, bottom).stroke('black')
      if (page === start.page) {
        doc.moveTo(left, top).lineTo(right, top).stroke('black')
      }
      if (page === end.page) {
        doc.moveTo(left, bottom).lineTo(right, bottom).stroke('black')
      }
    }
  }
  doc.switchToPage(end.page)
  doc.lineWidth(STRONG_STROKE_PT)
}

const drawBlock = (
  doc: LetterDocument,
  block: LetterBlock,
  layout: BodyLayout
): void => {
  const left = x(CONTENT_X_MM)
  const width = x(CONTENT_WIDTH_MM)
  if (block.kind === 'paragraph') {
    ensureRoom(doc, lineHeightOf(doc, layout))
    drawRuns(doc, block.runs, left, doc.y, width, layout)
  } else if (block.kind === 'heading') {
    const size = headingSizeOf(block.level, layout.size)
    ensureRoom(
      doc,
      lineHeightOf(doc, layout, LETTER_FONTS.serif, size) +
        lineHeightOf(doc, layout)
    )
    drawRuns(
      doc,
      block.runs,
      left,
      doc.y,
      width,
      {...layout, size},
      LETTER_FONTS.serif
    )
  } else if (block.kind === 'list') {
    block.items.forEach((runs, index) => {
      ensureRoom(doc, lineHeightOf(doc, layout))
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
    ensureRoom(doc, lineHeightOf(doc, layout) + 2 * x(QUOTE_PADDING_MM))
    const start = {page: lastPageIndexOf(doc), y: doc.y}
    doc.y = start.y + x(QUOTE_PADDING_MM)
    for (const runs of block.paragraphs) {
      ensureRoom(doc, lineHeightOf(doc, layout))
      drawRuns(
        doc,
        runs,
        left + x(QUOTE_PADDING_MM),
        doc.y,
        width - 2 * x(QUOTE_PADDING_MM),
        layout
      )
    }
    const end = {page: lastPageIndexOf(doc), y: doc.y + x(QUOTE_PADDING_MM)}
    drawQuoteFrame(doc, start, end)
    doc.y = end.y
  }
  doc.y += blockGapOf(layout)
}

/**
 * Le corps, borne a `[debut du corps, haut du pied - 4 mm]` par les marges de
 * la page (`addLetterBodyPage`) : la plus grande taille qui tient sur la
 * premiere page, sinon le plancher, et ce qui deborde continue sur une page de
 * suite.
 */
const drawBody = (
  doc: LetterDocument,
  blocks: readonly LetterBlock[],
  top: number
): void => {
  const start = Math.max(top + x(4), x(BODY_Y_MM))
  const layout = chooseLayout(doc, blocks, x(BODY_BOTTOM_MM) - start)
  doc.y = start
  for (const block of blocks) drawBlock(doc, block, layout)
}

/**
 * Le repere d'une page de suite, borne a la largeur utile (§6.1) : reduit
 * jusqu'au plancher, puis le nom seul se coupe en « … » : « page n/N » reste.
 */
const continuationMarkerOf = (
  doc: LetterDocument,
  continuation: RenderLettersInput['texts']['continuation'],
  values: ContinuationValues
): string => {
  const width = x(CONTENT_WIDTH_MM)
  const marker = continuation(values)
  doc.fontSize(
    lineSizeOf(doc, marker, width, {
      size: CONTINUATION_SIZE_PT,
      floor: CONTINUATION_MIN_SIZE_PT,
    })
  )
  const fits = (text: string) => doc.widthOfString(text) <= width
  let name = values.name
  let shortened = marker
  while (!fits(shortened) && name.length > 0) {
    name = name.slice(0, -1).trimEnd()
    shortened = continuation({...values, name: `${name}…`})
  }
  return shortened
}

const drawContinuationMarker = (
  doc: LetterDocument,
  continuation: RenderLettersInput['texts']['continuation'],
  values: ContinuationValues
): void => {
  doc.font(LETTER_FONTS.regular).fillColor('black')
  const marker = continuationMarkerOf(doc, continuation, values)
  drawBoundedLine(doc, marker, {
    left: x(CONTENT_X_MM),
    top: x(LETTER_MARGINS_MM.top),
    width: x(CONTENT_WIDTH_MM),
  })
}

/** Pied et repere de chaque page de suite, une fois la lettre entiere ecrite. */
const drawContinuationPages = (
  doc: LetterDocument,
  input: RenderLettersInput,
  name: string,
  firstPage: number
): void => {
  const lastPage = lastPageIndexOf(doc)
  const pageCount = lastPage - firstPage + 1
  for (let page = firstPage + 1; page <= lastPage; page++) {
    doc.switchToPage(page)
    drawFooter(doc, input.texts.footer, input.association.legalMentions)
    drawContinuationMarker(doc, input.texts.continuation, {
      name,
      page: page - firstPage + 1,
      pageCount,
    })
  }
  doc.switchToPage(lastPage)
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
  addLetterBodyPage(doc)
  const firstPage = lastPageIndexOf(doc)
  drawFooter(doc, input.texts.footer, input.association.legalMentions)
  drawHeader(doc, input.association.name)
  drawAddressBlock(doc, letter.address.lines, input.offset)
  drawDateLine(doc, input.texts.dateLine)
  const extra = input.extraValues ?? {}
  const subject = substituteVariables(input.subject, values, (v) => v, extra)
  const subjectBottom = drawSubject(
    doc,
    `${input.texts.subjectLabel} ${subject}`
  )
  drawBody(
    doc,
    input.bodyBlocks ??
      letterBodyBlocksOf(
        letter.bodyMarkdown ?? input.bodyMarkdown,
        values,
        extra
      ),
    subjectBottom
  )
  drawContinuationPages(doc, input, letter.name, firstPage)
}

/**
 * Le PDF du lot, dans l'ordre recu (trie par nom) : chaque lettre commence sur
 * une nouvelle page, et le nombre de pages est rendu avec le fichier.
 */
export const renderLettersPdf = async (
  input: RenderLettersInput
): Promise<RenderedLetters> => {
  const doc = createLetterDocument(letterFontFilesOf())
  // Une page de suite repart de l'etat graphique par defaut : le trait du gras.
  doc.on('pageAdded', () => doc.lineWidth(STRONG_STROKE_PT))
  for (const letter of input.letters) drawLetter(doc, input, letter)
  const pageCount = doc.bufferedPageRange().count
  return {pdf: await pdfBufferOf(doc), pageCount}
}
