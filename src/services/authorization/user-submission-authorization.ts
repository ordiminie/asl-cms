import {getAuthUser} from '@/services/authentication/auth-service'

import {isUserAdmin} from './authorization-service'

export const canCreateUserSubmission = async (): Promise<boolean> => {
  const authUser = await getAuthUser()
  return !!authUser
}

export const canReadUserSubmissions = async (): Promise<boolean> => {
  const authUser = await getAuthUser()
  return isUserAdmin(authUser)
}

export const canManageUserSubmissions = async (): Promise<boolean> => {
  const authUser = await getAuthUser()
  return isUserAdmin(authUser)
}
