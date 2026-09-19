import {getAssociationMonogram} from '@/services/types/domain/association-identity-types'
import {AccentHue} from '@/services/types/domain/association-settings-types'

/**
 * Aplat `accent-solid` d'une teinte : meme formule que le token de
 * `globals.css`. Un SVG servi comme favicon ne lit pas les variables CSS de la
 * page ; il recoit donc la couleur elle-meme, calculee depuis la teinte.
 */
const accentSolidOf = (hue: AccentHue) => `oklch(0.55 0.1 ${hue})`

const escapeXml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

/**
 * Favicon par defaut d'une association (ADR 015) : son monogramme, en clair
 * sur l'aplat de sa teinte d'accent (s02). Contenu produit par l'application, jamais par un
 * utilisateur ; le nom est echappe.
 */
export const renderAssociationMonogramSvg = (
  associationName: string,
  hue: AccentHue
) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">` +
  `<rect width="64" height="64" rx="12" fill="${accentSolidOf(hue)}"/>` +
  `<text x="32" y="33" text-anchor="middle" dominant-baseline="central" ` +
  `font-family="'Source Serif 4', Georgia, 'Times New Roman', serif" ` +
  `font-size="30" font-weight="600" fill="#FFFFFF">` +
  `${escapeXml(getAssociationMonogram(associationName))}</text></svg>`
