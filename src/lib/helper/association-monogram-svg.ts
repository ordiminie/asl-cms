import {getAssociationMonogram} from '@/services/types/domain/association-identity-types'

/**
 * Aplat `accent-solid` de la teinte par defaut 195 (design system §1.2), en
 * hexadecimal : un SVG servi comme favicon ne lit pas les tokens CSS.
 * Seul endroit du code qui porte cette valeur ; s02 la remplacera par la
 * teinte parametree de l'association.
 */
export const DEFAULT_MONOGRAM_ACCENT_HEX = '#17849B'

const escapeXml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

/**
 * Favicon par defaut d'une association (ADR 015) : son monogramme, en clair
 * sur l'aplat de sa teinte. Contenu produit par l'application, jamais par un
 * utilisateur ; le nom est echappe.
 */
export const renderAssociationMonogramSvg = (associationName: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">` +
  `<rect width="64" height="64" rx="12" fill="${DEFAULT_MONOGRAM_ACCENT_HEX}"/>` +
  `<text x="32" y="33" text-anchor="middle" dominant-baseline="central" ` +
  `font-family="'Source Serif 4', Georgia, 'Times New Roman', serif" ` +
  `font-size="30" font-weight="600" fill="#FFFFFF">` +
  `${escapeXml(getAssociationMonogram(associationName))}</text></svg>`
