import {remark} from 'remark'
import remarkHtml from 'remark-html'

import {RESTRICTED_SANITIZE_SCHEMA} from '@/lib/cms/render-page-block'
import {escapeHtml, substituteVariables} from '@/services/rules/campaign-rules'
import type {CampaignVariableValues} from '@/services/types/domain/campaign-types'

import {EMAIL_COLORS, EMAIL_DARK_CLASSES, EMAIL_FONTS} from './theme'

/**
 * Styles en ligne du corps d'une campagne : un client de messagerie ignore la
 * feuille de style, et le schema restreint retire tout attribut `style` ecrit
 * par le bureau. Couleurs de `theme.ts` seulement.
 */
const TAG_STYLES: Record<string, string> = {
  p: 'margin:0 0 16px;font-size:17px;line-height:1.6;',
  h2: `margin:24px 0 12px;font-family:${EMAIL_FONTS.heading};font-size:20px;line-height:1.3;font-weight:700;`,
  h3: `margin:20px 0 8px;font-family:${EMAIL_FONTS.heading};font-size:18px;line-height:1.3;font-weight:700;`,
  ul: 'margin:0 0 16px;padding-left:24px;',
  ol: 'margin:0 0 16px;padding-left:24px;',
  li: 'margin:0 0 4px;',
  blockquote: `margin:0 0 16px;padding-left:16px;border-left:3px solid ${EMAIL_COLORS.border};`,
}

const LINK_STYLE = `color:${EMAIL_COLORS.link};text-decoration:underline;`

const inlineStyles = (html: string): string =>
  html
    .replace(
      /<(p|h2|h3|ul|ol|li|blockquote)>/g,
      (_whole, tag: string) => `<${tag} style="${TAG_STYLES[tag]}">`
    )
    .replace(
      /<a /g,
      `<a class="${EMAIL_DARK_CLASSES.link}" style="${LINK_STYLE}" `
    )

/**
 * Le corps d'une campagne en HTML d'email (s25, ADR 051) : Markdown rendu par
 * le **schema restreint du CMS** (aucun script, aucun style entrant), puis
 * variables remplacees par les valeurs **echappees** du destinataire, puis
 * styles en ligne. Remplacer apres le rendu empeche une valeur d'etre lue
 * comme du Markdown ou du HTML.
 */
export const renderCampaignBodyHtml = (
  markdown: string,
  values: CampaignVariableValues
): string => {
  const sanitized = String(
    remark()
      .use(remarkHtml, {sanitize: RESTRICTED_SANITIZE_SCHEMA})
      .processSync(markdown)
  ).trim()
  return inlineStyles(substituteVariables(sanitized, values, escapeHtml))
}
