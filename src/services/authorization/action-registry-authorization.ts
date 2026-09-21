import {
  ACTION_REGISTRY,
  isActionAllowedForRole,
} from '@/services/types/domain/action-registry-types'
import {RoleConst} from '@/services/types/domain/auth-types'
import {User} from '@/services/types/domain/user-types'

/**
 * Autorisation generique par action (ADR 018, s03b) : le SuperAdmin passe
 * toujours, sinon le role de l'utilisateur dans **cette** organisation doit
 * figurer parmi les roles par defaut de l'action dans le registre de
 * production. Une action absente du registre est refusee (defaut ferme, voir
 * `isActionAllowedForRole`).
 *
 * Point d'accroche unique pour les services qui declarent une action au
 * registre — a la place d'un controle de role ecrit a la main.
 */
export const canPerformAction = (
  user: User | undefined,
  organizationId: string,
  actionId: string
): boolean => {
  if (!user) return false
  if (user.role === RoleConst.SUPER_ADMIN) return true

  const membership = (user.organizations ?? []).find(
    (org) => org.organizationId === organizationId
  )
  if (!membership) return false

  return isActionAllowedForRole(ACTION_REGISTRY, actionId, membership.role)
}
