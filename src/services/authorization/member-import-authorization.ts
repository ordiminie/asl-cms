import {getAuthUser} from '../authentication/auth-service'
import {RoleConst} from '../types/domain/auth-types'

/**
 * L'import initial des membres (s13) est reserve au SuperAdmin Zourite
 * Studio : le bureau d'une association ne voit pas l'ecran.
 */
export const canImportMembers = async (): Promise<boolean> => {
  const authUser = await getAuthUser()
  return authUser?.role === RoleConst.SUPER_ADMIN
}
