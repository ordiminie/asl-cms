import * as z from 'zod'

export const organizationFormSchema = z.object({
  id: z.string().uuid('ID invalide'),
  name: z
    .string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(50, 'Le nom ne doit pas dépasser 50 caractères'),
  slug: z
    .string()
    .min(2, 'Le slug doit contenir au moins 2 caractères')
    .max(50, 'Le slug ne doit pas dépasser 50 caractères')
    .regex(
      /^[a-z0-9-]+$/,
      'Le slug ne doit contenir que des lettres minuscules, des chiffres et des tirets'
    ),
  description: z
    .string()
    .max(500, 'La description ne doit pas dépasser 500 caractères')
    .optional(),
  logo: z.string().url('URL invalide').optional().or(z.literal('')),
})

export type OrganizationFormSchemaType = z.infer<typeof organizationFormSchema>
