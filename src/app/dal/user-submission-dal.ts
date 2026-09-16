import 'server-only'

import {cache} from 'react'

import {withCurrentTenant} from '@/app/dal/tenant-dal'
import {canManageUserSubmissions} from '@/services/authorization/user-submission-authorization'
import {
  getAllUserSubmissionsService,
  getUnreadSubmissionsCountService,
  getUserSubmissionByIdService,
} from '@/services/facades/user-submission-service-facade'
import {Pagination} from '@/services/types/common-type'
import {UserSubmissionFilters} from '@/services/types/domain/user-submission-types'

// `user_submissions` porte une policy RLS forcee (ADR 002) : ces lectures
// s'executent dans le scope du tenant du domaine appele, sans quoi elles ne
// rendent rien. Aucun cache ici : la donnee est celle d'un tenant et d'un
// administrateur, elle se streame derriere un <Suspense>.
export const getAllUserSubmissionsWithPaginationDal = cache(
  async (pagination: Pagination, filters?: UserSubmissionFilters) => {
    return await withCurrentTenant(async () =>
      getAllUserSubmissionsService(pagination, filters)
    )
  }
)

export const getUserSubmissionByIdDal = cache(async (id: string) => {
  return await withCurrentTenant(async () => getUserSubmissionByIdService(id))
})

export const getUnreadSubmissionsCountDal = cache(async () => {
  return await withCurrentTenant(async () => getUnreadSubmissionsCountService())
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
