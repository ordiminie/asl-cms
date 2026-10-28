import 'server-only'

import {
  getMemberProfileByUserIdDao,
  updateMyMemberProfileContactDao,
} from '@/db/repositories/member-profile-repository'
import {
  getCurrentParcelsByMemberDao,
  getMemberFormerParcelsDao,
} from '@/db/repositories/parcel-ownership-repository'
import {withTenant} from '@/db/tenant-scope'

import {getAuthUser} from './authentication/auth-service'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {UserOrganizationRoleConst} from './types/domain/auth-types'
import {
  MyContactDTO,
  MyParcelsDTO,
  UpdateMyContactInput,
  UpdateMyContactResult,
} from './types/domain/member-space-types'
import {
  memberProfileOrganizationIdSchema,
  updateMyContactServiceSchema,
} from './validation/member-profile-validation'

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

/** Les coordonnees d'une fiche, sans son identifiant ni son compte. */
const toMyContact = (profile: MyContactDTO): MyContactDTO => ({
  email: profile.email,
  phone: profile.phone,
  addressLine: profile.addressLine,
  addressComplement: profile.addressComplement,
  postalCode: profile.postalCode,
  city: profile.city,
})

/**
 * Les coordonnees de la fiche du proprietaire connecte (s16) ; rien pour un
 * compte sans fiche dans l'association.
 */
export const getMyContactService = async (
  organizationId: string
): Promise<MyContactDTO | undefined> => {
  const parsed = memberProfileOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const authUser = await getAuthUser()
  if (!authUser) {
    throw new AuthorizationError('Connectez-vous pour voir vos coordonnees')
  }

  return withTenant(parsed.data, async () => {
    const profile = await getMemberProfileByUserIdDao(parsed.data, authUser.id)
    return profile ? toMyContact(profile) : undefined
  })
}

/**
 * Le proprietaire connecte corrige son telephone et son adresse postale
 * (s16, ADR 040). La fiche se resout par la session et le domaine appele :
 * un identifiant ou un email glisse dans l'entree est retire par Zod.
 */
export const updateMyContactService = async (
  input: UpdateMyContactInput
): Promise<UpdateMyContactResult> => {
  const parsed = updateMyContactServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const authUser = await getAuthUser()
  if (!authUser) {
    throw new AuthorizationError('Connectez-vous pour modifier vos coordonnees')
  }

  const {organizationId, ...contact} = parsed.data
  return withTenant(organizationId, async () => {
    const row = await updateMyMemberProfileContactDao(
      organizationId,
      authUser.id,
      contact
    )
    return row
      ? {status: 'saved', contact: toMyContact(row)}
      : {status: 'not_found'}
  })
}
