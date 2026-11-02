import 'server-only'

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  getActingContext,
  getSessionAuth,
} from '@/services/authentication/auth-service'
import type {ImpersonationBarDTO} from '@/services/types/domain/impersonation-types'

const BAR_ROLES = ['member', 'board', 'owner'] as const

/**
 * La banniere d'une session a la place d'un compte (s48, critere 2) : rien hors
 * imitation. Donnee par utilisateur : aucun cache, lue derriere un
 * `<Suspense>`. L'heure de fin est celle de la session, jamais une duree
 * ecrite dans un composant (ADR 042).
 */
export const getImpersonationBarDal =
  async (): Promise<ImpersonationBarDTO | null> => {
    const acting = await getActingContext()
    if (!acting?.impersonator) return null

    const [session, tenant] = await Promise.all([
      getSessionAuth(),
      getCurrentTenantDal(),
    ])
    const expiresAt = session?.session?.expiresAt
    if (!expiresAt) return null

    const membership = acting.user.organizations?.find(
      (organization) => organization.organizationId === tenant?.id
    )
    const role = BAR_ROLES.find((known) => known === membership?.role)
    return {
      subjectName: acting.user.name,
      role: role ?? 'member',
      organizationName: tenant?.name ?? '',
      expiresAt: new Date(expiresAt).toISOString(),
    }
  }
