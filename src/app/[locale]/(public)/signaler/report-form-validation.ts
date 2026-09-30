import {z} from 'zod'

import {
  REPORT_DESCRIPTION_MAX_LENGTH,
  REPORT_LOCATION_MAX_LENGTH,
  REPORTER_NAME_MAX_LENGTH,
  REPORTER_PHONE_MAX_LENGTH,
  REPORTER_PHONE_PATTERN,
} from '@/services/types/domain/incident-report-types'

/**
 * Formulaire public `/signaler` (s10, decision G). Partage par le client
 * (React Hook Form) et par l'action serveur.
 *
 * - La categorie n'est exigee que si l'association en propose, et doit etre
 *   l'une d'elles (decision D) : le schema recoit les identifiants offerts.
 * - Les trois coordonnees sont facultatives, separement : vides, elles ne
 *   sont pas validees.
 */
const isNotBlank = (value: string) => value.trim().length > 0
const isBlank = (value: string) => value.trim().length === 0

export const reportFormSchema = z.object({
  categoryId: z.string(),
  location: z.string(),
  description: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
})

export function createReportFormSchema(
  t: (key: string) => string,
  offeredCategoryIds: readonly string[]
) {
  return reportFormSchema.extend({
    categoryId: z
      .string()
      .refine(
        (value) =>
          offeredCategoryIds.length === 0 || offeredCategoryIds.includes(value),
        {message: t('validation.categoryRequired')}
      ),
    location: z
      .string()
      .refine(isNotBlank, {message: t('validation.locationRequired')})
      .refine((value) => value.trim().length <= REPORT_LOCATION_MAX_LENGTH, {
        message: t('validation.locationMax'),
      }),
    description: z
      .string()
      .refine(isNotBlank, {message: t('validation.descriptionRequired')})
      .refine((value) => value.length <= REPORT_DESCRIPTION_MAX_LENGTH, {
        message: t('validation.descriptionMax'),
      }),
    name: z
      .string()
      .refine((value) => value.trim().length <= REPORTER_NAME_MAX_LENGTH, {
        message: t('validation.nameMax'),
      }),
    email: z
      .string()
      .refine(
        (value) =>
          isBlank(value) || z.string().email().safeParse(value.trim()).success,
        {message: t('validation.emailInvalid')}
      ),
    phone: z
      .string()
      .refine(
        (value) => isBlank(value) || REPORTER_PHONE_PATTERN.test(value.trim()),
        {message: t('validation.phoneInvalid')}
      )
      .refine((value) => value.trim().length <= REPORTER_PHONE_MAX_LENGTH, {
        message: t('validation.phoneMax'),
      }),
  })
}

export type ReportFormSchemaType = z.infer<typeof reportFormSchema>

/** Les champs du formulaire, dans l'ordre de la page. */
export const REPORT_FORM_FIELDS = [
  'categoryId',
  'location',
  'description',
  'name',
  'email',
  'phone',
] as const satisfies readonly (keyof ReportFormSchemaType)[]

export type ReportFormField = (typeof REPORT_FORM_FIELDS)[number]
