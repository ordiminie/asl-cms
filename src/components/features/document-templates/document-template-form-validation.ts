import {z} from 'zod'

import {
  DOCUMENT_TEMPLATE_BODY_MAX_LENGTH,
  DOCUMENT_TEMPLATE_NAME_MAX_LENGTH,
  DOCUMENT_TEMPLATE_SUBJECT_MAX_LENGTH,
  DOCUMENT_TEMPLATE_VARIABLES,
  DocumentTemplateField,
  DocumentTemplateFieldIssue,
  DocumentTemplateIssues,
} from '@/services/types/domain/document-template-types'

/**
 * Formulaire d'un modele de document (s36, ecran 2). Le navigateur verifie
 * les champs vides et les plafonds ; les variables inconnues sont refusees
 * par le serveur, qui decide (critere 4).
 */

export const DOCUMENT_TEMPLATE_FORM_FIELDS = [
  'name',
  'subject',
  'bodyMarkdown',
] as const satisfies readonly DocumentTemplateField[]

export const DOCUMENT_TEMPLATE_MAX_LENGTHS: Record<
  DocumentTemplateField,
  number
> = {
  name: DOCUMENT_TEMPLATE_NAME_MAX_LENGTH,
  subject: DOCUMENT_TEMPLATE_SUBJECT_MAX_LENGTH,
  bodyMarkdown: DOCUMENT_TEMPLATE_BODY_MAX_LENGTH,
}

type Translate = (
  key: string,
  values?: Record<string, string | number>
) => string

const VARIABLE_LIST_FORMAT = new Intl.ListFormat('fr', {
  style: 'long',
  type: 'conjunction',
})

/** « {adresse} et {date_ag} » : les variables, entre accolades. */
export const variableListOf = (names: readonly string[]): string =>
  VARIABLE_LIST_FORMAT.format(names.map((name) => `{${name}}`))

/** Le message de champ d'un refus, qui nomme chaque variable fautive. */
export const templateIssueMessageOf = (
  t: Translate,
  field: DocumentTemplateField,
  issue: DocumentTemplateFieldIssue
): string => {
  switch (issue.code) {
    case 'missing':
      return t(`issues.${field}Missing`)
    case 'tooLong':
      return t(`issues.${field}TooLong`, {max: issue.max})
    case 'unknownVariables':
      return t('issues.unknownVariables', {
        count: issue.variables.length,
        variables: variableListOf(issue.variables),
        allowed: variableListOf(DOCUMENT_TEMPLATE_VARIABLES),
      })
  }
}

/** La ligne du resume ancre : le champ, puis ce qui ne va pas. */
export const templateIssueSummaryOf = (
  t: Translate,
  field: DocumentTemplateField,
  issue: DocumentTemplateFieldIssue
): string =>
  issue.code === 'unknownVariables'
    ? t('issues.unknownVariablesSummary', {
        field: t(`fieldNames.${field}`),
        count: issue.variables.length,
        variables: variableListOf(issue.variables),
      })
    : templateIssueMessageOf(t, field, issue)

const requiredWithin = (t: Translate, field: DocumentTemplateField) =>
  z
    .string()
    .refine((value) => value.trim().length > 0, {
      message: templateIssueMessageOf(t, field, {code: 'missing'}),
    })
    .refine(
      (value) => value.trim().length <= DOCUMENT_TEMPLATE_MAX_LENGTHS[field],
      {
        message: templateIssueMessageOf(t, field, {
          code: 'tooLong',
          max: DOCUMENT_TEMPLATE_MAX_LENGTHS[field],
        }),
      }
    )

export const createDocumentTemplateFormSchema = (t: Translate) =>
  z.object({
    name: requiredWithin(t, 'name'),
    subject: requiredWithin(t, 'subject'),
    bodyMarkdown: requiredWithin(t, 'bodyMarkdown'),
  })

export type DocumentTemplateFormValues = z.infer<
  ReturnType<typeof createDocumentTemplateFormSchema>
>

/**
 * Etats de l'enregistrement. Le succes n'a pas d'etat : l'action renvoie a
 * l'editeur du modele (`?enregistre=1`).
 */
export type DocumentTemplateFormState =
  | {status: 'idle'}
  | {status: 'rejected'; issues: DocumentTemplateIssues}
  | {status: 'error'; message: string}
