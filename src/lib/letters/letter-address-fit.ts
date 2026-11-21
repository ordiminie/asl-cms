import {LETTER_ADDRESS_MAX_LINES} from '@/services/rules/campaign-letter-rules'

import {
  ADDRESS_FONT_SIZE_PT,
  ADDRESS_FONT_SIZE_STEP_PT,
  ADDRESS_FRAME_MM,
  ADDRESS_MIN_FONT_SIZE_PT,
  mmToPt,
} from './letter-geometry'

/**
 * Le bloc adresse tient-il dans le cadre de 90 mm (s28, arbitrage du
 * 20/11/2026, §6.1) ? Chaque ligne est mesuree : le corps se reduit de 12 a
 * 10 pt ; si une ligne ne tient toujours pas, elle est coupee apres une
 * virgule, dans la limite de 4 lignes ; sinon l'adresse ne tient pas et la
 * lettre est signalee au bureau. Regle pure : la mesure vient de l'appelant.
 */
export type AddressFit = {fits: boolean; sizePt: number; lines: string[]}

/** La largeur d'un texte a un corps donne, en points. */
export type MeasureText = (text: string, sizePt: number) => number

const ADDRESS_FRAME_WIDTH_PT = mmToPt(ADDRESS_FRAME_MM.width)

const sizesOf = (): number[] => {
  const sizes: number[] = []
  for (
    let size = ADDRESS_FONT_SIZE_PT;
    size >= ADDRESS_MIN_FONT_SIZE_PT;
    size -= ADDRESS_FONT_SIZE_STEP_PT
  ) {
    sizes.push(size)
  }
  return sizes
}

/** Une ligne coupee apres ses virgules, morceaux regroupes tant qu'ils tiennent. */
const wrapAtCommas = (
  line: string,
  fitsWidth: (text: string) => boolean
): string[] | null => {
  const segments = line.split(/(?<=,)\s+/)
  const wrapped: string[] = []
  for (const segment of segments) {
    const last = wrapped.at(-1)
    const joined = last === undefined ? segment : `${last} ${segment}`
    if (last !== undefined && fitsWidth(joined))
      wrapped[wrapped.length - 1] = joined
    else wrapped.push(segment)
  }
  return wrapped.every(fitsWidth) ? wrapped : null
}

export const fitAddressLines = (
  lines: readonly string[],
  widthOf: MeasureText,
  maxWidthPt: number = ADDRESS_FRAME_WIDTH_PT
): AddressFit => {
  for (const sizePt of sizesOf()) {
    if (lines.every((line) => widthOf(line, sizePt) <= maxWidthPt)) {
      return {fits: true, sizePt, lines: [...lines]}
    }
  }
  const sizePt = ADDRESS_MIN_FONT_SIZE_PT
  const fitsWidth = (text: string) => widthOf(text, sizePt) <= maxWidthPt
  const wrapped: string[] = []
  for (const line of lines) {
    const pieces = fitsWidth(line) ? [line] : wrapAtCommas(line, fitsWidth)
    if (!pieces) return {fits: false, sizePt, lines: [...lines]}
    wrapped.push(...pieces)
  }
  return wrapped.length <= LETTER_ADDRESS_MAX_LINES
    ? {fits: true, sizePt, lines: wrapped}
    : {fits: false, sizePt, lines: [...lines]}
}
