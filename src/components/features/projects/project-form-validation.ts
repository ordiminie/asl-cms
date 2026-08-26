import z from 'zod'

export const projectFormSchema = z.object({
  name: z.string().min(1, 'The project name is required'),
  description: z.string().optional(),
})

export const projectCreateFormSchema = projectFormSchema.extend({
  organizationId: z.string().min(1, 'The organization is required'),
})

export function createProjectFormSchema(t: (key: string) => string) {
  return projectFormSchema.extend({
    name: z.string().min(1, t('validation.nameRequired')),
    description: z.string().optional(),
  })
}

export function createProjectCreateFormSchema(t: (key: string) => string) {
  return createProjectFormSchema(t).extend({
    organizationId: z.string().min(1, t('validation.organizationRequired')),
  })
}

export type ProjectFormSchemaType = z.infer<typeof projectFormSchema>
export type ProjectCreateFormSchemaType = z.infer<
  typeof projectCreateFormSchema
>
