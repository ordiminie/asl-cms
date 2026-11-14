import {z} from 'zod'

import {MEMBER_QUESTION_BODY_MAX_LENGTH} from '@/services/types/domain/member-question-types'

/**
 * Formulaire « Poser une question au bureau » du membre connecte (s23).
 * **Aucun champ d'identite** : elle vient de la fiche. Le sujet est
 * obligatoire et doit etre l'un de ceux que l'association propose (D2).
 * Partage par le client (React Hook Form) et par l'action serveur.
 */
const isNotBlank = (value: string) => value.trim().length > 0

export function createMyQuestionFormSchema(
  t: (key: string, values?: Record<string, number>) => string,
  offeredCategoryIds: readonly string[]
) {
  return z.object({
    categoryId: z
      .string()
      .refine((value) => offeredCategoryIds.includes(value), {
        message: t('validation.categoryRequired'),
      }),
    body: z
      .string()
      .refine(isNotBlank, {message: t('validation.bodyRequired')})
      .refine((value) => value.length <= MEMBER_QUESTION_BODY_MAX_LENGTH, {
        message: t('validation.bodyMax', {
          max: MEMBER_QUESTION_BODY_MAX_LENGTH,
        }),
      }),
  })
}

export type MyQuestionFormSchemaType = z.infer<
  ReturnType<typeof createMyQuestionFormSchema>
>

/** Les champs du formulaire, dans l'ordre de la page. */
export const MY_QUESTION_FORM_FIELDS = [
  'categoryId',
  'body',
] as const satisfies readonly (keyof MyQuestionFormSchemaType)[]

export type MyQuestionFormField = (typeof MY_QUESTION_FORM_FIELDS)[number]

export type MyQuestionFormError = {field: MyQuestionFormField; message: string}

/**
 * Etats de l'envoi. Le succes n'a pas d'etat : l'action renvoie a l'espace
 * membre (`/dashboard?question=envoyee`). `failed` couvre l'echec technique
 * comme le compte sans fiche : le texte saisi est conserve (B3).
 */
export type MyQuestionFormState =
  | {status: 'idle'}
  | {status: 'invalid'; errors: MyQuestionFormError[]}
  | {status: 'failed'}
