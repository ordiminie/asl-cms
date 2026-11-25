import {substituteVariables} from '@/services/rules/campaign-rules'
import type {CampaignVariableValues} from '@/services/types/domain/campaign-types'

import type {InvitationPlainContent} from './invitation-content'

/** Les phrases du pied, partagees par le gabarit HTML et la version texte. */
export type CampaignFooterTexts = {
  associationName: string
  legalName: string | null
  legalMentions: string | null
  reason: string
  /**
   * Pourquoi un desinscrit recoit cet envoi (s27b, critere 4) ; `null` pour un
   * envoi facultatif.
   */
  statutoryNotice: string | null
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
  /**
   * Le contenu d'une invitation (s42b) : present, il remplace le titre et le
   * corps, ecrits comme texte.
   */
  invitation?: InvitationPlainContent
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
  invitation,
}: CampaignTextInput): string => {
  const head = invitation
    ? invitationTextBlocksOf(invitation)
    : [
        heading,
        plainTextOf(
          substituteVariables(bodyMarkdown, values, (value) => value)
        ),
      ]
  const footerBlocks = [
    [footer.associationName, footer.legalName, footer.legalMentions]
      .filter(isFilled)
      .join('\n'),
    footer.reason,
    ...(footer.statutoryNotice ? [footer.statutoryNotice] : []),
    `${footer.unsubscribeLabel} : ${unsubscribeUrl}`,
    footer.notice,
  ]
  return [...head, '--', ...footerBlocks].join('\n\n')
}

const invitationTextBlocksOf = (
  invitation: InvitationPlainContent
): string[] => [
  invitation.title,
  ...invitation.paragraphs,
  `${invitation.action} : ${invitation.url}`,
  invitation.steps.map((step, index) => `${index + 1}. ${step}`).join('\n'),
]
