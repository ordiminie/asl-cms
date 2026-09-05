import {getAuthUser} from '@/services/authentication/auth-service'

import {isUserAdmin} from './authorization-service'

export const canReadAppSettings = async (): Promise<boolean> => {
  const authUser = await getAuthUser()
  return isUserAdmin(authUser)
}

export const canUpdateAppSettings = async (): Promise<boolean> => {
  const authUser = await getAuthUser()
  return isUserAdmin(authUser)
}

export const canDeleteAppSettings = async (): Promise<boolean> => {
  const authUser = await getAuthUser()
  return isUserAdmin(authUser)
}
