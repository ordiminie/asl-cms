import {z} from 'zod'

import {
  CreateUserSubmission,
  SubmissionType,
} from '../types/domain/user-submission-types'

export const submissionTypeSchema = z.enum([
  'contact',
  'feedback',
  'support',
]) satisfies z.Schema<SubmissionType>

export const createUserSubmissionServiceSchema = z.object({
  userId: z
    .string()
    .uuid({
      message: "L'ID utilisateur doit être un UUID valide.",
    })
    .optional()
    .nullable(),
  email: z
    .string()
    .email({
      message: "L'email doit être valide.",
    })
    .optional()
    .nullable(),
  organizationId: z
    .string()
    .uuid({
      message: "L'ID organisation doit être un UUID valide.",
    })
    .optional()
    .nullable(),
  type: submissionTypeSchema,
  subject: z
    .string()
    .min(1, {
      message: 'Le sujet est requis.',
    })
    .max(255, {
      message: 'Le sujet ne doit pas dépasser 255 caractères.',
    }),
  message: z
    .string()
    .min(1, {
      message: 'Le message est requis.',
    })
    .max(5000, {
      message: 'Le message ne doit pas dépasser 5000 caractères.',
    }),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
}) satisfies z.Schema<CreateUserSubmission>

export const markAsReadSubmissionServiceSchema = z.object({
  id: z.string().uuid({
    message: "L'ID de la soumission doit être un UUID valide.",
  }),
})

export const archiveSubmissionServiceSchema = z.object({
  id: z.string().uuid({
    message: "L'ID de la soumission doit être un UUID valide.",
  }),
})

export const uuidSchema = z.string().uuid({
  message: "L'ID doit être un UUID valide.",
})
