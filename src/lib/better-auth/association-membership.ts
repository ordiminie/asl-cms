import {normalizeTenantHost} from '@/lib/helper/tenant-helper'
import {RoleConst} from '@/services/types/domain/auth-types'
import type {Organization} from '@/services/types/domain/organization-types'

/** Ce que la regle lit d'un compte : son role global et ses appartenances. */
type AccountMemberships = {
  role?: string | null
  organizations?: {organizationId: string}[]
}

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
 * La regle unique d'ouverture de session sur un domaine (ADR 034) : le
 * SuperAdmin partout, sinon un membre de l'association du domaine. Un domaine
 * sans association n'est ouvert qu'au SuperAdmin.
 */
export const canOpenSessionOn = (
  user: AccountMemberships,
  organization: Organization | undefined
): boolean => {
  if (user.role === RoleConst.SUPER_ADMIN) return true
  return organization ? isMemberOf(user, organization) : false
}
