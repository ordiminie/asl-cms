import {z} from 'zod'

import {CATEGORY_NAME_MAX_LENGTH} from '@/services/types/domain/association-category-types'

/**
 * Le `dialog` d'une categorie de signalement (s10, ecran 4). Partage par le
 * client (React Hook Form) et par les actions serveur. L'adresse est
 * facultative : vide ou faite d'espaces, elle est absente (critere 6).
 */
const isBlank = (value: string) => value.trim().length === 0

export const categoryFormSchema = z.object({
  name: z.string(),
  routingEmail: z.string(),
})

export function createCategoryFormSchema(t: (key: string) => string) {
  return categoryFormSchema.extend({
    name: z
      .string()
      .refine((value) => !isBlank(value), {
        message: t('validation.nameRequired'),
      })
      .refine((value) => value.trim().length <= CATEGORY_NAME_MAX_LENGTH, {
        message: t('validation.nameMax'),
      }),
    routingEmail: z
      .string()
      .refine(
        (value) =>
          isBlank(value) || z.string().email().safeParse(value.trim()).success,
        {message: t('validation.emailInvalid')}
      ),
  })
}

export type CategoryFormSchemaType = z.infer<typeof categoryFormSchema>

export const CATEGORY_FORM_FIELDS = [
  'name',
  'routingEmail',
] as const satisfies readonly (keyof CategoryFormSchemaType)[]

export type CategoryFormField = (typeof CATEGORY_FORM_FIELDS)[number]

/** Resultat d'un ajout ou d'une modification, rendu par les Server Actions. */
export type CategoryActionResult =
  | {status: 'saved'; name: string}
  | {
      status: 'invalid'
      errors: {field: CategoryFormField; message: string}[]
    }
  | {status: 'limit_reached'; max: number}
  | {status: 'error'; message: string}

/** Resultat d'une suppression, rendu par la Server Action. */
export type CategoryDeleteResult =
  {status: 'deleted'} | {status: 'error'; message: string}
