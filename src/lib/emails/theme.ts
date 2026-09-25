import {
  AccentHue,
  DEFAULT_ACCENT_HUE,
  isAccentHue,
} from '@/services/types/domain/association-settings-types'

/**
 * Couleurs de l'email (design system §5.3) : les jumelles hexadecimales des
 * tokens, l'email ne sachant pas calculer OKLCH. **Seul fichier du produit ou
 * une couleur est dupliquee** : toute evolution d'un token impose la mise a
 * jour de sa jumelle ici, jamais dans un modele.
 */
export const EMAIL_COLORS = {
  background: '#FFFFFF',
  foreground: '#1B1E26',
  muted: '#F6F7F8',
  mutedForeground: '#52565E',
  border: '#DFE1E5',
  input: '#8E939C',
  primary: '#2C3F63',
  primaryForeground: '#FDFDFE',
  /** Libelle du bouton : blanc pur, force en mode sombre (§5.2). */
  buttonForeground: '#FFFFFF',
  link: '#2B57A8',
  destructive: '#B32317',
  warning: '#F7E6C4',
  warningBorder: '#C9922F',
  warningForeground: '#5A3B12',
} as const

export const EMAIL_FONTS = {
  heading: 'Georgia, serif',
  body: 'Helvetica, Arial, sans-serif',
} as const

export type EmailAccent = {
  /** `accent-solid` : filet de l'en-tete. */
  solid: string
  /** `accent` : fond de l'en-tete. */
  surface: string
  /** `accent-foreground` : nom de l'association. */
  foreground: string
}

/** Les six teintes validees, precalculees (§1.2). */
const EMAIL_ACCENTS: Record<AccentHue, EmailAccent> = {
  195: {solid: '#17849B', surface: '#E8F5F8', foreground: '#185A66'},
  150: {solid: '#2E7D52', surface: '#E7F5EC', foreground: '#1E4A31'},
  255: {solid: '#3A6FB0', surface: '#EAF1FA', foreground: '#23445F'},
  40: {solid: '#A8623A', surface: '#F8EDE6', foreground: '#5E3421'},
  300: {solid: '#7A5AA8', surface: '#F1ECF9', foreground: '#3F2E5C'},
  95: {solid: '#7C7326', surface: '#F4F2E2', foreground: '#423D14'},
}

/** Le triplet d'une teinte, celui de la teinte par defaut si elle est inconnue. */
export const getEmailAccent = (hue: AccentHue): EmailAccent =>
  EMAIL_ACCENTS[isAccentHue(hue) ? hue : DEFAULT_ACCENT_HUE]

/**
 * Jumelles sombres (design system §5.2) : les valeurs qui reprennent la main
 * quand le client de messagerie impose son mode sombre. Le libelle du bouton
 * reste blanc, force.
 */
export const EMAIL_COLORS_DARK = {
  background: '#171A1E',
  text: '#E8EBEF',
  textMuted: '#9DA6AE',
  rule: '#32363A',
  buttonBg: '#2063B0',
  buttonText: '#FFFFFF',
  link: '#8CC3FC',
} as const

/**
 * Classes posees par un gabarit sur les elements que le mode sombre recolore.
 * Les styles en ligne restent les couleurs claires ; seules ces classes sont
 * visees par le bloc `<style>` de `emailDarkModeCss`.
 */
export const EMAIL_DARK_CLASSES = {
  background: 'email-dark-bg',
  text: 'email-dark-text',
  textMuted: 'email-dark-muted',
  rule: 'email-dark-rule',
  button: 'email-dark-button',
  buttonText: 'email-dark-button-text',
  link: 'email-dark-link',
} as const

const darkRules = (prefix: string): string => {
  const c = EMAIL_DARK_CLASSES
  const d = EMAIL_COLORS_DARK
  return [
    `${prefix}.${c.background}{background-color:${d.background} !important;}`,
    `${prefix}.${c.text}{color:${d.text} !important;}`,
    `${prefix}.${c.textMuted}{color:${d.textMuted} !important;}`,
    `${prefix}.${c.rule}{border-color:${d.rule} !important;}`,
    `${prefix}.${c.button}{background-color:${d.buttonBg} !important;}`,
    `${prefix}.${c.buttonText}{color:${d.buttonText} !important;}`,
    `${prefix}.${c.link}{color:${d.link} !important;}`,
  ].join('\n')
}

/**
 * Le bloc `<style>` du mode sombre d'un email : les jumelles de
 * `EMAIL_COLORS_DARK`, servies par `prefers-color-scheme` et par
 * `[data-ogsc]` (Outlook, qui ignore la requete media).
 */
export const emailDarkModeCss = (): string =>
  [
    '@media (prefers-color-scheme: dark) {',
    darkRules(''),
    '}',
    darkRules('[data-ogsc] '),
  ].join('\n')
