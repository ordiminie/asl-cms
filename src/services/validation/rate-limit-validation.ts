import {z} from 'zod'

export const magicLinkRequestQuotaServiceSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().trim().toLowerCase().min(1),
})
