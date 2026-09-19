import {z} from 'zod'

export const associationSettingsOrganizationIdSchema = z.string().uuid()

export const updateAssociationSettingsServiceSchema = z.object({
  organizationId: associationSettingsOrganizationIdSchema,
  changes: z.record(z.string(), z.string()),
})
