/**
 * Geometrie de la lettre de publipostage (design system §6.1, ADR 067 §3).
 * Une norme d'enveloppe (DL 110 x 220, fenetre gauche, NF Z 11-011), pas une
 * preference d'association : des constantes de code, en millimetres depuis le
 * coin haut gauche de la page. Seul le cadre de l'adresse se decale, par les
 * deux reglages bornes de l'association (ADR 067 §4).
 */

export type RectMm = {x: number; y: number; width: number; height: number}

/** Decalage du cadre de l'adresse, en mm (reglages de l'association). */
export type AddressOffsetMm = {xMm: number; yMm: number}

const POINTS_PER_INCH = 72
const MM_PER_INCH = 25.4

/** Des millimetres en points PDF (1/72 de pouce). */
export const mmToPt = (mm: number): number =>
  (mm * POINTS_PER_INCH) / MM_PER_INCH

export const A4_MM = {width: 210, height: 297} as const

/** Marges : 20 mm a gauche et a droite, 15 en haut, 20 en bas. */
export const LETTER_MARGINS_MM = {
  top: 15,
  right: 20,
  bottom: 20,
  left: 20,
} as const

/** La fenetre de l'enveloppe DL gauche, repere jamais imprime sur la lettre. */
export const DL_WINDOW_MM: RectMm = {x: 20, y: 45, width: 100, height: 35}

/** Garde entre la fenetre et le cadre de l'adresse, sur les quatre cotes. */
const WINDOW_GUARD_MM = 5

/** Le cadre de l'adresse : la fenetre moins sa garde, 90 x 25 mm. */
export const ADDRESS_FRAME_MM: RectMm = {
  x: DL_WINDOW_MM.x + WINDOW_GUARD_MM,
  y: DL_WINDOW_MM.y + WINDOW_GUARD_MM,
  width: DL_WINDOW_MM.width - 2 * WINDOW_GUARD_MM,
  height: DL_WINDOW_MM.height - 2 * WINDOW_GUARD_MM,
}

/** Les deux plis d'une A4 pliee en trois parts egales. */
export const FOLD_LINES_MM = [A4_MM.height / 3, (2 * A4_MM.height) / 3]

/** Le cadre de l'adresse decale du reglage ; rien d'autre ne bouge. */
export const addressFrameOf = (offset: AddressOffsetMm): RectMm => ({
  ...ADDRESS_FRAME_MM,
  x: ADDRESS_FRAME_MM.x + offset.xMm,
  y: ADDRESS_FRAME_MM.y + offset.yMm,
})

/** Corps du bloc adresse, en points, sans gras (§6.1). */
export const ADDRESS_FONT_SIZE_PT = 12
/** Interligne du bloc : quatre lignes dans les 25 mm du cadre. */
export const ADDRESS_LINE_HEIGHT_MM = ADDRESS_FRAME_MM.height / 4

/** En-tete : logo ou monogramme de 9 mm, a la marge haute. */
export const HEADER_MARK_MM = 9

/** Date de la lettre, sous la fenetre ; objet, puis corps en dessous. */
export const DATE_Y_MM = DL_WINDOW_MM.y + DL_WINDOW_MM.height + 8
export const SUBJECT_Y_MM = DATE_Y_MM + 12
export const BODY_Y_MM = SUBJECT_Y_MM + 12

/** Hauteur reservee au pied (filet, phrase postale, mentions) sur la marge basse. */
export const FOOTER_HEIGHT_MM = 16

/** Corps du texte : 12,5 pt, interligne 1,7, plancher 11 pt (§6.1). */
export const BODY_FONT_SIZE_PT = 12.5
export const BODY_MIN_FONT_SIZE_PT = 11
export const BODY_LINE_HEIGHT = 1.7
/** Objet : 13 pt, graisse 600 (§6.1). */
export const SUBJECT_FONT_SIZE_PT = 13
