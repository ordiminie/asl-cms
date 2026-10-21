import 'server-only'

import {getMemberProfileByUserIdDao} from '@/db/repositories/member-profile-repository'
import {
  getCurrentParcelsByMemberDao,
  getMemberFormerParcelsDao,
} from '@/db/repositories/parcel-ownership-repository'
import {withTenant} from '@/db/tenant-scope'

import {getAuthUser} from './authentication/auth-service'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {UserOrganizationRoleConst} from './types/domain/auth-types'
import {MyParcelsDTO} from './types/domain/member-space-types'
import {memberProfileOrganizationIdSchema} from './validation/member-profile-validation'

/**
 * Espace membre (s12d, ecran C, critere 4). Lecture **cote membre** : aucun
 * identifiant de fiche en entree. La fiche se resout par l'association du
 * domaine appele et le compte de la session (ADR 037), sous `withTenant` :
 * un membre ne peut demander que la sienne.
 */

const byNumber = (a: {number: string}, b: {number: string}): number =>
  a.number.localeCompare(b.number, 'fr', {numeric: true})

/**
 * Les parcelles actuelles et anciennes du proprietaire connecte, sans
 * l'acquereur ; rien pour un compte sans fiche dans l'association.
 */
export const getMyParcelsService = async (
  organizationId: string
): Promise<MyParcelsDTO | undefined> => {
  const parsed = memberProfileOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const authUser = await getAuthUser()
  if (!authUser) {
    throw new AuthorizationError('Connectez-vous pour voir vos parcelles')
  }

  return withTenant(parsed.data, async () => {
    const profile = await getMemberProfileByUserIdDao(parsed.data, authUser.id)
    if (!profile) return undefined

    const current = await getCurrentParcelsByMemberDao(profile.id)
    const former = await getMemberFormerParcelsDao(profile.id)
    return {
      name: profile.name,
      current: current
        .map(({number, startsOn}) => ({number, startsOn}))
        .sort(byNumber),
      former: former
        .map(({number, startsOn, endsOn}) => ({number, startsOn, endsOn}))
        .sort((a, b) => b.endsOn.localeCompare(a.endsOn)),
    }
  })
}

/**
 * Le compte connecte est-il un simple membre de cette association ? Pour le
 * back-office : un proprietaire y voit l'ecran C4, qui le renvoie a son
 * espace, au lieu du refus generique. Le SuperAdmin n'en est pas un.
 */
export const isPlainMemberOfService = async (
  organizationId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()
  return (authUser?.organizations ?? []).some(
    (membership) =>
      membership.organizationId === organizationId &&
      membership.role === UserOrganizationRoleConst.MEMBER
  )
}
