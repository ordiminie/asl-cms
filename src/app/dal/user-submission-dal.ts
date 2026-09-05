import 'server-only'

import {cache} from 'react'

import {canManageUserSubmissions} from '@/services/authorization/user-submission-authorization'
import {
  getAllUserSubmissionsService,
  getUnreadSubmissionsCountService,
  getUserSubmissionByIdService,
} from '@/services/facades/user-submission-service-facade'
import {Pagination} from '@/services/types/common-type'
import {UserSubmissionFilters} from '@/services/types/domain/user-submission-types'

export const getAllUserSubmissionsWithPaginationDal = cache(
  async (pagination: Pagination, filters?: UserSubmissionFilters) => {
    return await getAllUserSubmissionsService(pagination, filters)
  }
)

export const getUserSubmissionByIdDal = cache(async (id: string) => {
  return await getUserSubmissionByIdService(id)
})

export const getUnreadSubmissionsCountDal = cache(async () => {
  return await getUnreadSubmissionsCountService()
})

export const getUserSubmissionPermissionsDal = cache(async () => {
  const canManage = await canManageUserSubmissions()

  return {
    canRead: canManage,
    canMarkAsRead: canManage,
    canArchive: canManage,
    canManage,
  }
})
