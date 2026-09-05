import {getUserByIdDao} from '@/db/repositories/user-repository'
import {getAuthUser} from '@/services/authentication/auth-service'

import {isUserAdmin, userCanOnResource} from './authorization-service'
import {ActionsConst, SubjectsConst} from './casl-abilities'

export const canReadUser = async (resourceId: string): Promise<boolean> => {
  const authUser = await getAuthUser()
  const targetUser = await getUserByIdDao(resourceId)
  if (!targetUser) return false

  return userCanOnResource(authUser, ActionsConst.READ, SubjectsConst.USER, {
    id: targetUser.id,
    visibility: targetUser.visibility,
  })
}

export const canUpdateUser = async (resourceId: string): Promise<boolean> => {
  const authUser = await getAuthUser()
  const targetUser = await getUserByIdDao(resourceId)
  if (!targetUser) return false

  return userCanOnResource(authUser, ActionsConst.UPDATE, SubjectsConst.USER, {
    id: targetUser.id,
    visibility: targetUser.visibility,
  })
}

// Fonction de compatibilité - maintenant basée sur CASL
export const isAuthAdmin = async (): Promise<boolean> => {
  const authUser = await getAuthUser()
  return isUserAdmin(authUser)
}

export const canManageUsers = async (): Promise<boolean> => {
  const authUser = await getAuthUser()
  return isUserAdmin(authUser)
}
