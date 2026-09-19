import {z} from 'zod'

export const magicLinkRequestQuotaServiceSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().trim().toLowerCase().min(1),
  ip: z.string().trim().min(1).optional(),
})
