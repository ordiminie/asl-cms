'use client'

import React, {createContext, use, useContext} from 'react'

import type {CurrentUserContext} from '@/app/dal/user-dal'
import {RoleConst} from '@/services/types/domain/auth-types'

// Le contexte porte la promesse, pas sa valeur : le provider ne doit jamais
// suspendre, sinon il emporte {children} avec lui et le shell statique est
// perdu. Ce sont les consommateurs qui la déroulent, chacun derrière son
// <Suspense>.
// undefined = hors provider, null = provider sans session (pages publiques).
const AuthContext = createContext<
  Promise<CurrentUserContext> | null | undefined
>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
  userPromise?: Promise<CurrentUserContext> | null
}

export default function AuthProvider({
  children,
  userPromise = null,
}: AuthProviderProps) {
  return (
    <AuthContext.Provider value={userPromise}>{children}</AuthContext.Provider>
  )
}

/**
 * Suspend tant que la session n'est pas résolue : à n'appeler que depuis un
 * composant placé derrière un <Suspense>.
 */
export function useAuth() {
  const userPromise = useContext(AuthContext)
  if (userPromise === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  if (!userPromise) {
    return {user: null, activeOrganization: null}
  }
  return use(userPromise)
}

// Hook utilitaire pour vérifier les rôles de l'utilisateur
export function useAuthUserRole() {
  const {user} = useAuth()

  const isAdmin = user?.role === RoleConst.ADMIN
  const isUser = user?.role === RoleConst.USER
  const isSuperAdmin = user?.role === RoleConst.SUPER_ADMIN
  const isPublic = user?.role === RoleConst.PUBLIC
  const isRedactor = user?.role === RoleConst.REDACTOR
  const isModerator = user?.role === RoleConst.MODERATOR

  return {
    isAdmin,
    isUser,
    isSuperAdmin,
    isPublic,
    isRedactor,
    isModerator,
  }
}
