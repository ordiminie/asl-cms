import {z} from 'zod'

export const contactFormSchema = z.object({
  email: z
    .string()
    .min(1, {message: 'Email is required'})
    .email({message: 'Invalid email address'}),
  subject: z
    .string()
    .min(3, {message: 'Subject must be at least 3 characters'})
    .max(255, {message: 'Subject must not exceed 255 characters'}),
  content: z
    .string()
    .min(10, {message: 'Message must be at least 10 characters'})
    .max(5000, {message: 'Message must not exceed 5000 characters'}),
})

export function createContactFormSchema(t: (key: string) => string) {
  return contactFormSchema.extend({
    email: z
      .string()
      .min(1, {message: t('validation.emailRequired')})
      .email({message: t('validation.emailInvalid')}),
    subject: z
      .string()
      .min(3, {message: t('validation.subjectMin')})
      .max(255, {message: t('validation.subjectMax')}),
    content: z
      .string()
      .min(10, {message: t('validation.contentMin')})
      .max(5000, {message: t('validation.contentMax')}),
  })
}

export type ContactFormSchemaType = z.infer<typeof contactFormSchema>
