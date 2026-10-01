import {
  AccentHue,
  DEFAULT_ACCENT_HUE,
  isAccentHue,
} from '@/services/types/domain/association-settings-types'

/**
 * Couleurs de l'image de partage generee (s11) : les hexadecimaux des six
 * teintes precalculees du design system (§1.2). Une image ne lit pas les
 * variables CSS ; comme pour l'email (`src/lib/emails/theme.ts`), elle recoit
 * la couleur elle-meme. Toute evolution du §1.2 impose la mise a jour ici.
 */
export type ShareImageColors = {
  /** `accent` : fond de l'image. */
  surface: string
  /** `accent-foreground` : nom de l'association. */
  ink: string
  /** `accent-solid` : carre du monogramme. */
  solid: string
}

const SHARE_IMAGE_COLORS: Record<AccentHue, ShareImageColors> = {
  195: {solid: '#17849B', surface: '#E8F5F8', ink: '#185A66'},
  150: {solid: '#2E7D52', surface: '#E7F5EC', ink: '#1E4A31'},
  255: {solid: '#3A6FB0', surface: '#EAF1FA', ink: '#23445F'},
  40: {solid: '#A8623A', surface: '#F8EDE6', ink: '#5E3421'},
  300: {solid: '#7A5AA8', surface: '#F1ECF9', ink: '#3F2E5C'},
  95: {solid: '#7C7326', surface: '#F4F2E2', ink: '#423D14'},
}

/** `primary-foreground` : lettres du monogramme, comme `<AssociationMark />`. */
export const SHARE_IMAGE_MONOGRAM_TEXT = '#FDFDFE'

/** Les couleurs d'une teinte, celles de la teinte par defaut si inconnue. */
export const getShareImageColors = (hue: AccentHue): ShareImageColors =>
  SHARE_IMAGE_COLORS[isAccentHue(hue) ? hue : DEFAULT_ACCENT_HUE]
