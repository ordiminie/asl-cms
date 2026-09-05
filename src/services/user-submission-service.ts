import {
  archiveUserSubmissionDao,
  createUserSubmissionDao,
  getAllUserSubmissionsWithPaginationDao,
  getUnreadSubmissionsCountDao,
  getUserSubmissionByIdDao,
  markUserSubmissionAsReadDao,
} from '@/db/repositories/user-submission-repository'
import {getAuthUser} from '@/services/authentication/auth-service'

import {
  canCreateUserSubmission,
  canManageUserSubmissions,
} from './authorization/user-submission-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {sendInternalEmailService} from './facades/email-service-facade'
import {Pagination} from './types/common-type'
import {
  CreateUserSubmission,
  UserSubmissionFilters,
} from './types/domain/user-submission-types'
import {
  archiveSubmissionServiceSchema,
  createUserSubmissionServiceSchema,
  markAsReadSubmissionServiceSchema,
} from './validation/user-submission-validation'

const submissionTypeLabels: Record<string, string> = {
  contact: 'Contact',
  feedback: 'Feedback',
  support: 'Support',
}

export const createUserSubmissionService = async (
  data: CreateUserSubmission
) => {
  const parsed = createUserSubmissionServiceSchema.safeParse(data)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const hasUserId = !!parsed.data.userId
  const hasEmail = !!parsed.data.email

  if (!hasUserId && !hasEmail) {
    const canCreate = await canCreateUserSubmission()
    if (!canCreate) {
      throw new AuthorizationError(
        'Vous devez être connecté ou fournir un email'
      )
    }
  }

  const submission = await createUserSubmissionDao(parsed.data)

  try {
    const authUser = await getAuthUser()
    const senderName = authUser?.name || 'Anonyme'
    const senderEmail = authUser?.email || parsed.data.email || 'email inconnu'

    await sendInternalEmailService({
      title: `Nouvelle soumission ${submissionTypeLabels[parsed.data.type]}`,
      data: `
Type: ${submissionTypeLabels[parsed.data.type]}
Sujet: ${parsed.data.subject}
De: ${senderName} (${senderEmail})

Message:
${parsed.data.message}
      `.trim(),
    })
  } catch (emailError) {
    console.error("Erreur lors de l'envoi de l'email admin:", emailError)
  }

  return submission
}

export const getAllUserSubmissionsService = async (
  pagination: Pagination,
  filters?: UserSubmissionFilters
) => {
  const canManage = await canManageUserSubmissions()
  if (!canManage) {
    throw new AuthorizationError(
      "Vous n'avez pas les droits pour voir les soumissions"
    )
  }

  return await getAllUserSubmissionsWithPaginationDao(pagination, filters)
}

export const getUserSubmissionByIdService = async (id: string) => {
  const canManage = await canManageUserSubmissions()
  if (!canManage) {
    throw new AuthorizationError(
      "Vous n'avez pas les droits pour voir cette soumission"
    )
  }

  return await getUserSubmissionByIdDao(id)
}

export const markAsReadService = async (id: string) => {
  const canManage = await canManageUserSubmissions()
  if (!canManage) {
    throw new AuthorizationError(
      "Vous n'avez pas les droits pour modifier cette soumission"
    )
  }

  const parsed = markAsReadSubmissionServiceSchema.safeParse({id})
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  return await markUserSubmissionAsReadDao(id)
}

export const archiveUserSubmissionService = async (id: string) => {
  const canManage = await canManageUserSubmissions()
  if (!canManage) {
    throw new AuthorizationError(
      "Vous n'avez pas les droits pour archiver cette soumission"
    )
  }

  const parsed = archiveSubmissionServiceSchema.safeParse({id})
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  return await archiveUserSubmissionDao(id)
}

export const getUnreadSubmissionsCountService = async () => {
  const canManage = await canManageUserSubmissions()
  if (!canManage) {
    return 0
  }

  return await getUnreadSubmissionsCountDao()
}
