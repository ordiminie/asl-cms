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

/**
 * Vrai si l'utilisateur connecté est le SuperAdmin de la plateforme (s47,
 * ADR 035). Le nom est historique : il n'existe plus de rôle global `admin`.
 */
export const isAuthAdmin = async (): Promise<boolean> => {
  const authUser = await getAuthUser()
  return isUserAdmin(authUser)
}

export const canManageUsers = async (): Promise<boolean> => {
  const authUser = await getAuthUser()
  return isUserAdmin(authUser)
}
