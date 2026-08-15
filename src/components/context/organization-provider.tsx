'use client'

import {useRouter} from 'next/navigation'
import React, {createContext, useContext, useState} from 'react'

import {authClient} from '@/lib/better-auth/auth-client'
import {getReferenceIdByBillingMode} from '@/lib/helper/subscription-helper'
import {UserOrganizationRoleConst} from '@/services/types/domain/auth-types'
import {Organization} from '@/services/types/domain/organization-types'

import {useAuth} from './auth-provider'

// Le provider ne porte que l'état client : l'organisation choisie à la main,
// en attendant que la session serveur la reflète. Tout le reste (la liste des
// organisations, l'organisation active) vient de la session et se dérive dans
// le hook — qui suspend, donc s'appelle derrière un <Suspense>.
interface OrganizationSelection {
  selectedOrganization: Organization | null
  setSelectedOrganization: (organization: Organization | null) => void
}

const OrganizationContext = createContext<OrganizationSelection | undefined>(
  undefined
)

export function OrganizationProvider({children}: {children: React.ReactNode}) {
  const [selectedOrganization, setSelectedOrganization] =
    useState<Organization | null>(null)

  return (
    <OrganizationContext.Provider
      value={{selectedOrganization, setSelectedOrganization}}
    >
      {children}
    </OrganizationContext.Provider>
  )
}

/**
 * Accès brut à l'état client, sans lire la session : réservé à
 * OrganizationSync, qui doit pouvoir écrire sans suspendre le provider.
 */
export function useOrganizationSelection() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error(
      'useOrganizationSelection must be used within an OrganizationProvider'
    )
  }
  return context
}

/**
 * Suspend tant que la session n'est pas résolue : à n'appeler que depuis un
 * composant placé derrière un <Suspense>.
 */
export function useOrganization() {
  const selection = useOrganizationSelection()
  const {user, activeOrganization} = useAuth()
  const router = useRouter()

  const organizations = user?.organizations ?? []
  const currentOrganization =
    selection.selectedOrganization ?? activeOrganization
  const currentUserOrganization =
    organizations.find(
      (member) => member.organization?.id === currentOrganization?.id
    ) ?? null
  const referenceId = getReferenceIdByBillingMode(
    user?.id,
    currentOrganization?.id
  )

  const setCurrentOrganization = async (organizationId: string) => {
    if (organizationId === currentOrganization?.id) return

    const member = organizations.find(
      (org) => org.organization?.id === organizationId
    )
    if (!member?.organization) return

    // Choix appliqué tout de suite côté client, puis la session serveur est
    // mise à jour et relue. OrganizationSync rendra la main à la session dès
    // qu'elle aura rattrapé ce choix.
    selection.setSelectedOrganization(member.organization)
    await authClient.organization.setActive({organizationId})
    router.refresh()
  }

  return {
    user,
    organizations,
    referenceId,
    currentOrganization,
    currentUserOrganization,
    setCurrentOrganization,
  }
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
