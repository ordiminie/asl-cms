import {z} from 'zod'

export const chatMessageServiceSchema = z.object({
  content: z
    .string()
    .min(1, 'Le message ne peut pas être vide')
    .max(4000, 'Le message est trop long'),
  model: z.string().optional(),
})

export const chatProviderSchema = z.enum(['ollama', 'openai', 'anthropic'])
