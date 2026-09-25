import {z} from 'zod'

/**
 * Validation des messages recus depuis la page Contact (s08, ADR 025). Le
 * message ne doit etre que **non vide** : « Bonjour ? » est un message.
 */

export const CONTACT_MESSAGE_NAME_MAX_LENGTH = 120
export const CONTACT_MESSAGE_SUBJECT_MIN_LENGTH = 3
export const CONTACT_MESSAGE_SUBJECT_MAX_LENGTH = 255
export const CONTACT_MESSAGE_BODY_MAX_LENGTH = 5000

export const contactMessageOrganizationIdSchema = z.string().uuid()
export const contactMessageIdSchema = z.string().uuid()
export const contactMessagePageNumberSchema = z.number().int().min(1)

/** Un nom fait d'espaces est un nom absent. */
const senderNameSchema = z
  .string()
  .trim()
  .max(CONTACT_MESSAGE_NAME_MAX_LENGTH)
  .optional()
  .transform((value) => (value ? value : null))

export const createContactMessageServiceSchema = z.object({
  organizationId: contactMessageOrganizationIdSchema,
  locale: z.string(),
  name: senderNameSchema,
  email: z.string().trim().email(),
  subject: z
    .string()
    .trim()
    .min(CONTACT_MESSAGE_SUBJECT_MIN_LENGTH)
    .max(CONTACT_MESSAGE_SUBJECT_MAX_LENGTH),
  body: z
    .string()
    .max(CONTACT_MESSAGE_BODY_MAX_LENGTH)
    .refine((value) => value.trim().length > 0),
})

export const contactMessagesPageServiceSchema = z.object({
  organizationId: contactMessageOrganizationIdSchema,
  page: contactMessagePageNumberSchema,
})

export const contactMessageServiceSchema = z.object({
  organizationId: contactMessageOrganizationIdSchema,
  messageId: contactMessageIdSchema,
})

export const setContactMessageReadServiceSchema =
  contactMessageServiceSchema.extend({read: z.boolean()})
