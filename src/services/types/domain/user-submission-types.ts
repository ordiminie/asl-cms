import {
  AddUserSubmissionModel,
  UpdateUserSubmissionModel,
  UserSubmissionModel,
} from '@/db/models/user-submission-model'

export type UserSubmission = UserSubmissionModel

export type CreateUserSubmission = Omit<
  AddUserSubmissionModel,
  'id' | 'read' | 'archived' | 'createdAt' | 'updatedAt'
>

export type UpdateUserSubmission = {
  id: string
} & Partial<Omit<UpdateUserSubmissionModel, 'id'>>

export type SubmissionType = 'contact' | 'feedback' | 'support'

export const SubmissionTypeConst = {
  CONTACT: 'contact' as SubmissionType,
  FEEDBACK: 'feedback' as SubmissionType,
  SUPPORT: 'support' as SubmissionType,
} as const

export type UserSubmissionDTO = {
  id: string
  userId: string | null
  email: string | null
  organizationId: string | null
  type: SubmissionType
  subject: string
  message: string
  metadata: Record<string, unknown>
  read: boolean
  archived: boolean
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    name: string
    email: string
    image: string | null
  } | null
}

export type SubmissionMetadata = {
  sourceUrl?: string
  userAgent?: string
  category?: string
  priority?: 'low' | 'medium' | 'high'
}

export type UserSubmissionFilters = {
  type?: SubmissionType
  read?: boolean
  archived?: boolean
  search?: string
}

export type UserSubmissionWithUser = UserSubmission & {
  user: {
    id: string
    name: string
    email: string
    image: string | null
  } | null
}
