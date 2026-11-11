import {substituteVariables} from '@/services/rules/campaign-rules'
import type {CampaignVariableValues} from '@/services/types/domain/campaign-types'

/** Les phrases du pied, partagees par le gabarit HTML et la version texte. */
export type CampaignFooterTexts = {
  associationName: string
  legalName: string | null
  legalMentions: string | null
  reason: string
  unsubscribeLabel: string
  notice: string
}

export type CampaignTextInput = {
  /** L'objet saisi, titre du message. */
  heading: string
  bodyMarkdown: string
  values: CampaignVariableValues
  footer: CampaignFooterTexts
  unsubscribeUrl: string
}

const plainTextOf = (markdown: string): string =>
  markdown
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1 ($2)')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1$2')
    .trim()

const isFilled = (value: string | null): value is string =>
  value !== null && value.trim() !== ''

/**
 * La version texte brut d'une campagne (s25) : le Markdown sans sa syntaxe,
 * variables remplacees **sans echappement**, et le pied complet avec l'URL de
 * desinscription **en clair** — certains clients n'affichent que cette
 * version.
 */
export const renderCampaignText = ({
  heading,
  bodyMarkdown,
  values,
  footer,
  unsubscribeUrl,
}: CampaignTextInput): string => {
  const body = plainTextOf(
    substituteVariables(bodyMarkdown, values, (value) => value)
  )
  const footerBlocks = [
    [footer.associationName, footer.legalName, footer.legalMentions]
      .filter(isFilled)
      .join('\n'),
    footer.reason,
    `${footer.unsubscribeLabel} : ${unsubscribeUrl}`,
    footer.notice,
  ]
  return [heading, body, '--', ...footerBlocks].join('\n\n')
}
