import 'server-only'

import {
  MyMemberProfileRow,
  updateMyMemberProfilesContactDao,
} from '@/db/repositories/member-profile-repository'
import {
  getCurrentParcelsByMemberDao,
  getMemberFormerParcelsDao,
} from '@/db/repositories/parcel-ownership-repository'
import {withTenant} from '@/db/tenant-scope'

import {getAuthUser} from './authentication/auth-service'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {getMyMemberProfiles} from './member-account-service'
import {UserOrganizationRoleConst} from './types/domain/auth-types'
import {
  MyContactDTO,
  MyContactGroupDTO,
  MyLandDTO,
  MyLandsDTO,
  MyPostalContactDTO,
  UpdateMyContactInput,
  UpdateMyContactResult,
} from './types/domain/member-space-types'
import {
  memberProfileOrganizationIdSchema,
  updateMyContactServiceSchema,
} from './validation/member-profile-validation'

/**
 * Espace membre (s12d, ecran C, critere 4 ; s53). Lecture **cote membre** :
 * aucun identifiant de fiche en entree. Les fiches se resolvent par
 * l'association du domaine appele et le compte de la session, par la table
 * de liaison (ADR 054), sous `withTenant` : un membre ne peut demander que
 * les siennes.
 */

const byNumber = (a: {number: string}, b: {number: string}): number =>
  a.number.localeCompare(b.number, 'fr', {numeric: true})

/** Un terrain : les parcelles actuelles et anciennes d'une fiche. */
const readLand = async (profile: MyMemberProfileRow): Promise<MyLandDTO> => {
  const current = await getCurrentParcelsByMemberDao(profile.id)
  const former = await getMemberFormerParcelsDao(profile.id)
  return {
    name: profile.name,
    current: current
      .map(({number, startsOn, meterNumber}) => ({
        number,
        startsOn,
        meterNumber,
      }))
      .sort(byNumber),
    former: former
      .map(({number, startsOn, endsOn}) => ({number, startsOn, endsOn}))
      .sort((a, b) => b.endsOn.localeCompare(a.endsOn)),
  }
}

/**
 * « Mes terrains » du proprietaire connecte (s53, critere 2) : une entree par
 * fiche reliee a son compte, dans l'ordre de l'ADR 054 §7, sans l'acquereur ;
 * rien pour un compte sans fiche dans l'association.
 */
export const getMyLandsService = async (
  organizationId: string
): Promise<MyLandsDTO | undefined> => {
  const parsed = memberProfileOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const authUser = await getAuthUser()
  if (!authUser) {
    throw new AuthorizationError('Connectez-vous pour voir vos terrains')
  }

  return withTenant(parsed.data, async () => {
    const profiles = await getMyMemberProfiles(parsed.data, authUser.id)
    if (profiles.length === 0) return undefined

    const lands: MyLandDTO[] = []
    for (const profile of profiles) lands.push(await readLand(profile))
    return {accountName: authUser.name, lands}
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

/**
 * Telephone et domicile d'une fiche, rien d'autre : le terrain n'entre ni dans
 * « Mes coordonnees » ni dans la cle des groupes divergents (s55).
 */
const postalContactOf = (profile: MyPostalContactDTO): MyPostalContactDTO => ({
  phone: profile.phone,
  homeAddressLine: profile.homeAddressLine,
  homeAddressComplement: profile.homeAddressComplement,
  homePostalCode: profile.homePostalCode,
  homeCity: profile.homeCity,
})

/** Une fiche telle que « Mes coordonnees » la lit : sans email (s54). */
type ContactProfile = MyPostalContactDTO & {
  name: string
  currentParcelNumbers: string[]
}

const postalKeyOf = (profile: MyPostalContactDTO): string =>
  JSON.stringify(postalContactOf(profile))

/**
 * Un groupe par jeu de coordonnees, dans l'ordre des terrains (s53, 2b) ;
 * aucun quand toutes les fiches ont les memes. Un groupe ne nomme que les
 * fiches dont le nom n'est pas celui du compte.
 */
const contactGroupsOf = (
  profiles: ContactProfile[],
  accountName: string
): MyContactGroupDTO[] => {
  const groups = new Map<string, MyContactGroupDTO>()
  for (const profile of profiles) {
    const key = postalKeyOf(profile)
    const group = groups.get(key) ?? {
      ...postalContactOf(profile),
      parcelNumbers: [],
      names: [],
    }
    groups.set(key, {
      ...group,
      parcelNumbers: [...group.parcelNumbers, ...profile.currentParcelNumbers]
        .map((number) => ({number}))
        .sort(byNumber)
        .map(({number}) => number),
      names:
        profile.name === accountName || group.names.includes(profile.name)
          ? group.names
          : [...group.names, profile.name],
    })
  }
  return groups.size > 1 ? [...groups.values()] : []
}

/**
 * Les coordonnees de la personne (s16, s53) : celles du premier terrain,
 * sans identifiant de fiche ni de compte, avec le nombre de terrains et les
 * groupes quand elles divergent.
 */
const toMyContact = (
  profiles: ContactProfile[],
  accountName: string
): MyContactDTO => {
  const [first] = profiles
  const groups = contactGroupsOf(profiles, accountName)
  return {
    ...postalContactOf(first),
    landCount: profiles.length,
    divergent: groups.length > 0,
    groups,
  }
}

/**
 * Les coordonnees du proprietaire connecte (s16, s53, ecran 2) ; rien pour
 * un compte sans fiche dans l'association.
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
    const profiles = await getMyMemberProfiles(parsed.data, authUser.id)
    return profiles.length > 0
      ? toMyContact(profiles, authUser.name)
      : undefined
  })
}

/**
 * Le proprietaire connecte corrige son telephone et son domicile
 * (s16, ADR 040, s55), pour **toutes** ses fiches d'un coup (s53, arbitrage du
 * 16/11). Les fiches se resolvent par la session et le domaine appele : un
 * identifiant ou un email glisse dans l'entree est retire par Zod.
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
    const rows = await updateMyMemberProfilesContactDao(
      organizationId,
      authUser.id,
      contact
    )
    if (rows.length === 0) return {status: 'not_found'}
    // Toutes les fiches portent desormais les memes coordonnees : ni ordre ni
    // groupe a calculer.
    const written = rows.map((row) => ({...row, currentParcelNumbers: []}))
    return {status: 'saved', contact: toMyContact(written, authUser.name)}
  })
}
