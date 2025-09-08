import {z} from 'zod'

export const taskFormSchema = z.object({
  title: z
    .string()
    .min(3, 'Le titre doit contenir au moins 3 caractères')
    .max(100, 'Le titre ne peut pas dépasser 100 caractères')
    .trim(),
  description: z
    .string()
    .max(500, 'La description ne peut pas dépasser 500 caractères')
    .trim()
    .optional(),
  status: z.enum(['todo', 'in_progress', 'done'] as const, {
    message: 'Le statut est requis',
  }),
  assignedTo: z.string().optional().or(z.literal('unassigned')),
  organizationId: z.string().min(1, "L'organisation est requise"),
  projectId: z.string().min(1, 'Le projet est requis'),
})

export type TaskFormSchemaType = z.infer<typeof taskFormSchema>

export type TaskValidationError = {
  field: keyof TaskFormSchemaType
  message: string
}
