'use client'

//import {useRouter} from 'next/navigation'

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {authClient} from '@/lib/better-auth/auth-client'
import {getReferenceIdByBillingMode} from '@/lib/helper/subscription-helper'
import {
  RoleConst,
  UserOrganizationRoleConst,
} from '@/services/types/domain/auth-types'
import {
  MemberData,
  Organization,
} from '@/services/types/domain/organization-types'
import {User} from '@/services/types/domain/user-types'

import {useAuth} from './auth-provider'

interface OrganizationContextType {
  // États
  user: User | null
  organizations: MemberData[]
  referenceId: string | undefined //uid or organizationId
  currentOrganization: Organization | null
  currentUserOrganization: MemberData | null

  // Actions
  setCurrentOrganization: (organizationId: string) => void
  setCurrentOrganizationWithoutRedirect: (organizationId: string) => void
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined
)

interface OrganizationProviderProps {
  children: React.ReactNode
  initialOrganization?: Organization | null
}

export function OrganizationProvider({
  children,
  initialOrganization = null,
}: OrganizationProviderProps) {
  const {user} = useAuth()

  const [currentOrganization, setCurrentOrganization] =
    useState<Organization | null>(initialOrganization)
  const {data: activeOrganization} = authClient.useActiveOrganization()
  const [referenceId, setReferenceId] = useState<string | undefined>(
    getReferenceIdByBillingMode(user?.id, initialOrganization?.id)
  )
  const [syncedOrganization, setSyncedOrganization] =
    useState(initialOrganization)

  // Resynchroniser sur la prop quand le serveur renvoie une autre organisation
  if (syncedOrganization !== initialOrganization) {
    setSyncedOrganization(initialOrganization)
    setCurrentOrganization(initialOrganization)
  }

  // Dérivation des organisations depuis l'utilisateur
  const organizations = useMemo(() => user?.organizations || [], [user])

  // Dérivation de l'organisation utilisateur courante
  const currentUserOrganization =
    organizations.find(
      (org) => org.organization?.id === currentOrganization?.id
    ) || null

  // Fonction utilitaire pour définir l'organisation active
  const setActiveOrganization = async (organization: Organization) => {
    await authClient.organization.setActive({
      organizationId: organization.id,
    })
  }

  // Fonction pour changer d'organisation avec redirection
  const handleSetCurrentOrganization = async (organizationId: string) => {
    await handleSetCurrentOrganizationWithoutRedirect(organizationId)
    // Rediriger vers la page de l'équipe
    // desactiver dans notre cas
    // router.push(`/team/${member.organization.slug}`)
  }

  // Fonction pour changer d'organisation sans redirection
  const handleSetCurrentOrganizationWithoutRedirect = async (
    organizationId: string
  ) => {
    const member = organizations.find(
      (org) => org.organization?.id === organizationId
    )
    if (
      member &&
      member.organization &&
      member.organization.id !== currentOrganization?.id
    ) {
      await setActiveOrganization(member.organization)
      setCurrentOrganization(member.organization)
      setReferenceId(
        getReferenceIdByBillingMode(user?.id, member.organization.id)
      )
    }
  }

  // Initialiser l'organisation courante lors du chargement
  useEffect(() => {
    const initializeOrganization = async () => {
      if (organizations.length === 0) return

      // Si l'organisation active est déjà définie et correspond à l'organisation courante, ne rien faire
      if (
        currentOrganization &&
        currentOrganization?.id === activeOrganization?.id
      ) {
        return
      }

      if (activeOrganization) {
        const member = organizations.find(
          (org) => org.organization?.id === activeOrganization.id
        )

        if (member && member.organization) {
          await setActiveOrganization(member.organization)
          setCurrentOrganization(member.organization)
          setReferenceId(
            getReferenceIdByBillingMode(user?.id, member.organization.id)
          )
          return
        }
      }

      // Par défaut, sélectionner la première organisation
      if (
        !currentOrganization &&
        organizations[0].organization &&
        organizations[0].organization.id !== activeOrganization?.id
      ) {
        await setActiveOrganization(organizations[0].organization)
        setCurrentOrganization(organizations[0].organization)
        setReferenceId(
          getReferenceIdByBillingMode(
            user?.id,
            organizations[0].organization.id
          )
        )
      }
    }
    initializeOrganization()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizations, activeOrganization])

  const value: OrganizationContextType = {
    // États
    user,
    organizations,
    referenceId,
    currentOrganization,
    currentUserOrganization,

    setCurrentOrganization: handleSetCurrentOrganization,
    setCurrentOrganizationWithoutRedirect:
      handleSetCurrentOrganizationWithoutRedirect,
  }

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  )
}

// Hook personnalisé pour utiliser le contexte
export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error(
      'useOrganization must be used within an OrganizationProvider'
    )
  }
  return context
}

export function useReferenceId() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error(
      'useReferenceId must be used within an OrganizationProvider'
    )
  }
  return context
}

// Hook utilitaire pour vérifier les permissions dans l'organisation courante
export function useOrganizationRole() {
  const {currentUserOrganization} = useOrganization()

  const isOwner =
    currentUserOrganization?.role === UserOrganizationRoleConst.OWNER
  const isAdmin =
    currentUserOrganization?.role === UserOrganizationRoleConst.ADMIN || isOwner
  const isMember =
    currentUserOrganization?.role === UserOrganizationRoleConst.MEMBER ||
    isAdmin

  return {
    role: currentUserOrganization?.role,
    isOwner,
    isAdmin,
    isMember,
  }
}

// Hook utilitaire pour vérifier les permissions dans l'organisation courante
export function useAuthUserRole() {
  const {user} = useOrganization()

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
