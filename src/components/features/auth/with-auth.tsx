import {forbidden, redirect} from 'next/navigation'
import React from 'react'

import {getAuthUser} from '@/services/authentication/auth-service'
import {hasRequiredRole} from '@/services/authentication/auth-util'
import {RoleConst} from '@/services/types/domain/auth-types'
import {Roles, User} from '@/services/types/domain/user-types'

export type WithAuthProps = {
  user: User
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
      redirect('/login')
    }
    if (!hasRole) {
      forbidden()
    }

    return <WrappedComponent {...props} user={authUser} />
  }
}

export default withAuth

export const withAuthAdmin = <P extends object>(
  WrappedComponent: React.ComponentType<P & WithAuthProps>
) => withAuth(WrappedComponent, RoleConst.ADMIN)
