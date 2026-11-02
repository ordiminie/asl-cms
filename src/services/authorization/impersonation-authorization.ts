import {RoleConst} from '@/services/types/domain/auth-types'
import {User} from '@/services/types/domain/user-types'

/**
 * Ouvrir une session a la place d'un compte (s48, ADR 041) : reserve au
 * SuperAdmin de la plateforme, quel que soit son role dans l'association. Un
 * compte `user`, Bureau ou Presidence compris, est refuse.
 */
export const canImpersonateAccount = (user: User | undefined): boolean =>
  user?.role === RoleConst.SUPER_ADMIN
