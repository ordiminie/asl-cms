import {forbidden, redirect} from 'next/navigation'
import React from 'react'

import {
  getAuthUser,
  getSessionAuth,
} from '@/services/authentication/auth-service'
import {hasRequiredRole} from '@/services/authentication/auth-util'
import {RoleConst} from '@/services/types/domain/auth-types'
import {Roles, User} from '@/services/types/domain/user-types'

export type WithAuthProps = {
  user: User
}

/**
 * Route de passage d'un acces ferme (s12d, ADR 038) : elle ferme la session et
 * renvoie a `/login?acces=ferme`.
 */
export const CLOSED_ACCESS_PATH = '/login/acces-ferme'

/**
 * Ou renvoyer un compte refuse : sans session, a la connexion ; avec une
 * session dont l'acces a ete ferme ici, a la route qui la ferme et le dit.
 */
const deniedPath = async (): Promise<string> => {
  const session = await getSessionAuth()
  return session?.session?.userId ? CLOSED_ACCESS_PATH : '/login'
}
const withAuth = <P extends object>(
  WrappedComponent: React.ComponentType<P & WithAuthProps>,
  requiredRole?: Roles
) => {
  return async function WithAuth(props: P) {
    const authUser = await getAuthUser()
    const hasRole = hasRequiredRole(
      authUser,
      requiredRole ? (requiredRole as Roles) : RoleConst.USER
    )

    if (!authUser) {
      redirect(await deniedPath())
    }
    if (!hasRole) {
      forbidden()
    }

    return <WrappedComponent {...props} user={authUser} />
  }
}

export default withAuth

/**
 * Réserve la page à la console plateforme : seul le SuperAdmin passe (s47,
 * ADR 035). Le nom est historique, il n'existe plus de rôle global `admin`.
 */
export const withAuthAdmin = <P extends object>(
  WrappedComponent: React.ComponentType<P & WithAuthProps>
) => withAuth(WrappedComponent, RoleConst.SUPER_ADMIN)
