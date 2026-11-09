import {z} from 'zod'

import {createReportFormSchema} from '@/app/[locale]/(public)/signaler/report-form-validation'

/**
 * Formulaire de declaration du membre connecte (s22). C'est le schema du
 * formulaire public (s10), **sans nom, email ni telephone** : l'identite
 * vient de la fiche, jamais d'une saisie. Les messages sont ceux de s10, mot
 * pour mot (espace `ReportPage`). Partage par le client et par l'action.
 */
export function createMyReportFormSchema(
  t: (key: string) => string,
  offeredCategoryIds: readonly string[]
) {
  return createReportFormSchema(t, offeredCategoryIds).pick({
    categoryId: true,
    location: true,
    description: true,
  })
}

export type MyReportFormSchemaType = z.infer<
  ReturnType<typeof createMyReportFormSchema>
>

/** Les champs du formulaire, dans l'ordre de la page. */
export const MY_REPORT_FORM_FIELDS = [
  'categoryId',
  'location',
  'description',
] as const satisfies readonly (keyof MyReportFormSchemaType)[]

export type MyReportFormField = (typeof MY_REPORT_FORM_FIELDS)[number]

export type MyReportFormError = {field: MyReportFormField; message: string}

/**
 * Etats de l'envoi. Le succes n'a pas d'etat : l'action renvoie a l'espace
 * membre (`/dashboard?signalement=envoye`). `failed` couvre l'echec technique
 * comme le compte sans fiche : le texte saisi est conserve.
 */
export type MyReportFormState =
  | {status: 'idle'}
  | {status: 'invalid'; errors: MyReportFormError[]}
  | {status: 'failed'}
