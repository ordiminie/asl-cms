import {z} from 'zod'

import {
  CONTACT_MESSAGE_BODY_MAX_LENGTH,
  CONTACT_MESSAGE_NAME_MAX_LENGTH,
  CONTACT_MESSAGE_SUBJECT_MAX_LENGTH,
  CONTACT_MESSAGE_SUBJECT_MIN_LENGTH,
} from '@/services/validation/contact-message-validation'

/**
 * Formulaire public `/contact` (s08). Partage par le client (React Hook Form)
 * et par l'action serveur. Le message ne doit etre que **non vide** apres
 * `trim` (decision D) : « Bonjour ? » est un message.
 */
const isNotBlank = (value: string) => value.trim().length > 0

export const contactFormSchema = z.object({
  name: z
    .string()
    .max(CONTACT_MESSAGE_NAME_MAX_LENGTH, {
      message: 'Name must not exceed 120 characters',
    })
    .optional(),
  email: z
    .string()
    .min(1, {message: 'Email is required'})
    .email({message: 'Invalid email address'}),
  subject: z
    .string()
    .min(CONTACT_MESSAGE_SUBJECT_MIN_LENGTH, {
      message: 'Subject must be 3 to 255 characters',
    })
    .max(CONTACT_MESSAGE_SUBJECT_MAX_LENGTH, {
      message: 'Subject must be 3 to 255 characters',
    }),
  content: z
    .string()
    .max(CONTACT_MESSAGE_BODY_MAX_LENGTH, {
      message: 'Message must not exceed 5000 characters',
    })
    .refine(isNotBlank, {message: 'Message is required'}),
})

export function createContactFormSchema(t: (key: string) => string) {
  return contactFormSchema.extend({
    name: z
      .string()
      .max(CONTACT_MESSAGE_NAME_MAX_LENGTH, {message: t('validation.nameMax')})
      .optional(),
    email: z
      .string()
      .min(1, {message: t('validation.emailRequired')})
      .email({message: t('validation.emailInvalid')}),
    subject: z
      .string()
      .trim()
      .min(CONTACT_MESSAGE_SUBJECT_MIN_LENGTH, {
        message: t('validation.subjectRange'),
      })
      .max(CONTACT_MESSAGE_SUBJECT_MAX_LENGTH, {
        message: t('validation.subjectRange'),
      }),
    content: z
      .string()
      .max(CONTACT_MESSAGE_BODY_MAX_LENGTH, {
        message: t('validation.contentMax'),
      })
      .refine(isNotBlank, {message: t('validation.contentRequired')}),
  })
}

export type ContactFormSchemaType = z.infer<typeof contactFormSchema>

/** Les champs du formulaire, dans l'ordre de la page. */
export const CONTACT_FORM_FIELDS = [
  'name',
  'email',
  'subject',
  'content',
] as const satisfies readonly (keyof ContactFormSchemaType)[]

export type ContactFormField = (typeof CONTACT_FORM_FIELDS)[number]
