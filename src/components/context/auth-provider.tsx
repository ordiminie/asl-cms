'use client'

import type {Session} from 'better-auth'
import {useParams} from 'next/navigation'
import {useTheme} from 'next-themes'
import React, {createContext, useContext, useEffect, useState} from 'react'

import {usePathname, useRouter} from '@/i18n/navigation'
import {stripLocalePrefix} from '@/lib/helper/locale-helper'
import {RoleConst} from '@/services/types/domain/auth-types'
import {User} from '@/services/types/domain/user-types'

interface AuthContextType {
  user: User | null
  session: Session | null
  //setUser: (user: User | null) => void
  //setSession: (session: Session | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
  initialUser?: User | null
  initialSession?: Session | null
}

export default function AuthProvider({
  children,
  initialUser = null,
  initialSession = null,
}: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [session, setSession] = useState<Session | null>(initialSession)

  const {theme, setTheme} = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  // La locale de l'URL fait foi : useLocale() peut retourner la locale par
  // défaut sur les pages statiques, et c'est justement ce décalage qui laisse
  // le préfixe dans le pathname retourné par usePathname().
  const currentLocale = params.locale as string
  // Synchroniser avec les props quand elles changent
  useEffect(() => {
    //init theme
    const userTheme = initialUser?.settings?.theme
    if (userTheme && theme !== userTheme) {
      setTheme(userTheme)
    }
    //init lang
    const userLang = initialUser?.settings?.language
    if (userLang && currentLocale !== userLang) {
      router.replace(stripLocalePrefix(pathname, currentLocale), {
        locale: userLang,
      })
    }

    //init user
    setUser(initialUser)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUser])

  useEffect(() => {
    setSession(initialSession)
  }, [initialSession])

  // useEffect(() => {

  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [initialUser])

  const value: AuthContextType = {
    user,
    session,
    // setUser,
    // setSession,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Hook personnalisé pour utiliser le contexte d'authentification
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
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
