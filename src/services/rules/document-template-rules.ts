import {
  DOCUMENT_TEMPLATE_EXTRA_VARIABLES,
  DOCUMENT_TEMPLATE_VARIABLES,
  DocumentTemplateVariable,
} from '../types/domain/document-template-types'
import {findUnknownVariables} from './campaign-rules'

/**
 * Regles pures des modeles de documents (s36, ADR 074). Aucun acces a la
 * base.
 */

type TemplateText = {subject: string; bodyMarkdown: string}

/**
 * Les variables inconnues de l'objet et du texte, chacune une fois dans
 * l'ordre d'apparition : celles des campagnes plus `{association}` sont
 * permises (critere 4).
 */
export const unknownTemplateVariablesOf = ({
  subject,
  bodyMarkdown,
}: TemplateText): {subject: string[]; bodyMarkdown: string[]} => ({
  subject: findUnknownVariables(subject, DOCUMENT_TEMPLATE_EXTRA_VARIABLES),
  bodyMarkdown: findUnknownVariables(
    bodyMarkdown,
    DOCUMENT_TEMPLATE_EXTRA_VARIABLES
  ),
})

/** Les variables connues qu'emploie un modele, dans l'ordre des quatre. */
export const usedTemplateVariablesOf = ({
  subject,
  bodyMarkdown,
}: TemplateText): DocumentTemplateVariable[] => {
  const text = `${subject}\n${bodyMarkdown}`
  return DOCUMENT_TEMPLATE_VARIABLES.filter((variable) =>
    text.includes(`{${variable}}`)
  )
}

/**
 * Une ligne par fiche : la cible rend une ligne par adresse active. La
 * premiere ligne d'une fiche est gardee.
 */
export const uniqueProfilesOf = <Row extends {memberProfileId: string}>(
  rows: readonly Row[]
): Row[] => {
  const byId = new Map<string, Row>()
  for (const row of rows) {
    if (!byId.has(row.memberProfileId)) {
      byId.set(row.memberProfileId, row)
    }
  }
  return [...byId.values()]
}
