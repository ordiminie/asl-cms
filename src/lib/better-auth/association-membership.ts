import {normalizeTenantHost} from '@/lib/helper/tenant-helper'
import {logger} from '@/lib/logger'
import {
  RoleConst,
  UserOrganizationRoleConst,
} from '@/services/types/domain/auth-types'
import type {Organization} from '@/services/types/domain/organization-types'

/** Ce que la regle lit d'un compte : son role global et ses appartenances. */
type AccountMemberships = {
  role?: string | null
  organizations?: {organizationId: string; role?: string | null}[]
}

/** Ce que la regle de session lit d'un compte : son identifiant en plus. */
type SessionAccount = AccountMemberships & {id: string}

/** Ce que l'appelant sait de la session : ouverte a la place d'un compte. */
type SessionOpeningOptions = {impersonated?: boolean}

/**
 * L'association servie par le domaine appele, s'il en sert une. La facade est
 * chargee **a l'appel** : `auth.ts` importe ce module, et un import statique de
 * la couche service fermerait le cycle `auth.ts` → facade → `auth-service` →
 * `auth.ts` (garde : `magic-link-integration-imports.test.ts`).
 */
export const organizationOfRequest = async (
  host: string | undefined
): Promise<Organization | undefined> => {
  const domain = normalizeTenantHost(host)
  if (!domain) return undefined

  const {getOrganizationByDomainService} =
    await import('@/services/facades/organization-service-facade')
  const organization = await getOrganizationByDomainService(domain)
  return organization?.domain ? organization : undefined
}

/** Le compte appartient-il a l'association du domaine appele ? */
export const isMemberOf = (
  user: AccountMemberships,
  organization: Organization
) =>
  (user.organizations ?? []).some(
    (membership) => membership.organizationId === organization.id
  )

/**
 * Le compte garde-t-il l'espace membre (s57, ADR 075 §3) ? La facade est
 * chargee a l'appel, pour la meme raison que dans `organizationOfRequest`.
 * Une erreur de lecture refuse (ferme par defaut), journalisee sans adresse.
 */
const keepsMemberSpace = async (
  user: SessionAccount,
  organization: Organization
): Promise<boolean> => {
  try {
    const {hasMemberSpaceAccessService} =
      await import('@/services/facades/member-profile-access-service-facade')
    return await hasMemberSpaceAccessService(organization.id, user.id)
  } catch (error) {
    logger.error('[SESSION] Acces a l’espace membre non verifie : refus', {
      organizationId: organization.id,
      reason: error instanceof Error ? error.message : 'inconnue',
    })
    return false
  }
}

/**
 * La regle unique d'ouverture **et** de lecture de session sur un domaine
 * (ADR 034, ADR 038, ADR 075 §3) : le SuperAdmin partout ; sinon un membre de
 * l'association du domaine ; une session ouverte a la place d'un compte (s48)
 * passe ; un role d'association autre que `member` (bureau, presidence) n'est
 * jamais retire ; un membre ne passe que s'il garde au moins une fiche
 * ouverte, ou n'en a aucune. Un domaine sans association n'est ouvert qu'au
 * SuperAdmin.
 */
export const canOpenSessionOn = async (
  user: SessionAccount,
  organization: Organization | undefined,
  options: SessionOpeningOptions = {}
): Promise<boolean> => {
  if (user.role === RoleConst.SUPER_ADMIN) return true
  if (!organization) return false
  const membership = (user.organizations ?? []).find(
    (candidate) => candidate.organizationId === organization.id
  )
  if (!membership) return false
  if (options.impersonated) return true
  if (membership.role && membership.role !== UserOrganizationRoleConst.MEMBER) {
    return true
  }
  return keepsMemberSpace(user, organization)
}
