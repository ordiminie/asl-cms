'use client'

import {useRouter} from 'next/navigation'
import {useEffect} from 'react'

import {authClient} from '@/lib/better-auth/auth-client'

import {useAuth} from './auth-provider'
import {useOrganizationSelection} from './organization-provider'

/**
 * Réconcilie l'organisation active de la session avec le choix client.
 *
 * Vit dans son propre composant, et non dans OrganizationProvider : lire la
 * session suspend, et un provider qui suspend emporte {children} avec lui. À
 * monter derrière un <Suspense>, il ne rend rien.
 */
export function OrganizationSync() {
  const {user, activeOrganization} = useAuth()
  const {selectedOrganization, setSelectedOrganization} =
    useOrganizationSelection()
  const router = useRouter()

  useEffect(() => {
    // La session a rattrapé le choix client : elle redevient la seule source.
    if (
      selectedOrganization &&
      activeOrganization?.id === selectedOrganization.id
    ) {
      setSelectedOrganization(null)
      return
    }

    // Aucune organisation active en session (premier login, invitation
    // acceptée) : activer la première dont l'utilisateur est membre.
    const firstOrganization = user?.organizations?.[0]?.organization
    if (!activeOrganization && !selectedOrganization && firstOrganization) {
      const activateFirstOrganization = async () => {
        await authClient.organization.setActive({
          organizationId: firstOrganization.id,
        })
        router.refresh()
      }
      activateFirstOrganization()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeOrganization, selectedOrganization])

  return null
}
