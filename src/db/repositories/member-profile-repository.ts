import {
  and,
  asc,
  count,
  eq,
  exists,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from 'drizzle-orm'

import {memberProfileAccount} from '@/db/models/member-profile-account-model'
import {
  memberProfile,
  MemberProfileModel,
} from '@/db/models/member-profile-model'
import {parcel, parcelOwnership} from '@/db/models/parcel-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Fiches des proprietaires d'une association (s12, ADR 029). Sous RLS forcee :
 * hors `withTenant(organizationId, ...)`, rien ne sort et rien ne s'ecrit.
 *
 * Ce repository ne touche ni `user` ni `member` (Better Auth) : l'ouverture
 * et la fermeture du compte d'une fiche vivent dans `member-account-service`
 * (s12d) ; il n'ecrit ici que le lien fiche ↔ compte, dans
 * `member_profile_account` (s53, ADR 054).
 */

/** `null` quand la coordonnee est absente : jamais une chaine vide. */
export type MemberProfileContactWrite = {
  email: string | null
  phone: string | null
  addressLine: string | null
  addressComplement: string | null
  postalCode: string | null
  city: string | null
}

export type CreateMemberProfileResult = {
  status: 'created'
  row: MemberProfileModel
}

export type UpdateMemberProfileContactResult =
  {status: 'updated'; row: MemberProfileModel} | {status: 'not_found'}

/** Une fiche et le compte qui lui est relie, `null` sans compte (ADR 054). */
export type MemberProfileWithAccountRow = MemberProfileModel & {
  userId: string | null
}

export type MemberProfileListRow = MemberProfileWithAccountRow & {
  currentParcelNumbers: string[]
  /** Nombre de fiches reliees au compte de la fiche ; 0 sans compte. */
  accountProfileCount: number
}

/** Une fiche d'un compte, avec les numeros de ses parcelles actuelles. */
export type MyMemberProfileRow = MemberProfileModel & {
  currentParcelNumbers: string[]
}

export type MemberProfilePageRows = {
  rows: MemberProfileListRow[]
  total: number
}

/** Neutralise les jokers de `LIKE` dans un texte saisi. */
const escapeLike = (value: string): string =>
  value.replace(/[\\%_]/g, (char) => `\\${char}`)

/**
 * Cree une fiche. L'identifiant est genere par la base. L'adresse n'est plus
 * unique (ADR 054) : une adresse deja portee est detectee par le service,
 * avant l'ecriture.
 */
export const createMemberProfileTxnDao = async (
  input: MemberProfileContactWrite & {
    organizationId: string
    name: string
    pennylaneCustomerId?: string | null
  }
): Promise<CreateMemberProfileResult> =>
  getDb().transaction(async (tx) => {
    const [row] = await tx.insert(memberProfile).values(input).returning()
    return {status: 'created', row} as const
  })

/** Met a jour les coordonnees d'une fiche, et elles seules. */
export const updateMemberProfileContactTxnDao = async (
  memberProfileId: string,
  contact: MemberProfileContactWrite
): Promise<UpdateMemberProfileContactResult> =>
  getDb().transaction(async (tx) => {
    const [row] = await tx
      .update(memberProfile)
      .set({...contact, updatedAt: sql`now()`})
      .where(eq(memberProfile.id, memberProfileId))
      .returning()
    return row
      ? ({status: 'updated', row} as const)
      : ({status: 'not_found'} as const)
  })

/** Une fiche et le compte qui lui est relie (ADR 054). */
export const getMemberProfileByIdDao = async (
  memberProfileId: string
): Promise<MemberProfileWithAccountRow | undefined> => {
  const [row] = await getDb()
    .select({profile: memberProfile, userId: memberProfileAccount.userId})
    .from(memberProfile)
    .leftJoin(
      memberProfileAccount,
      eq(memberProfileAccount.memberProfileId, memberProfile.id)
    )
    .where(eq(memberProfile.id, memberProfileId))
  return row ? {...row.profile, userId: row.userId} : undefined
}

/**
 * **Toutes** les fiches de l'association qui portent cet email, sans tenir
 * compte de la casse, chacune avec son compte et ses parcelles actuelles
 * (s53, ADR 054 §4) : le service y lit le detenteur d'une adresse partagee.
 */
export const getMemberProfilesByEmailDao = async (
  organizationId: string,
  email: string
): Promise<
  (MemberProfileWithAccountRow & {currentParcelNumbers: string[]})[]
> => {
  const rows = await getDb()
    .select({profile: memberProfile, userId: memberProfileAccount.userId})
    .from(memberProfile)
    .leftJoin(
      memberProfileAccount,
      eq(memberProfileAccount.memberProfileId, memberProfile.id)
    )
    .where(
      and(
        eq(memberProfile.organizationId, organizationId),
        sql`lower(${memberProfile.email}) = lower(${email})`
      )
    )
    .orderBy(asc(memberProfile.id))
  const numbers = await getCurrentParcelNumbersByProfile(
    rows.map((row) => row.profile.id)
  )
  return rows.map((row) => ({
    ...row.profile,
    userId: row.userId,
    currentParcelNumbers: numbers[row.profile.id] ?? [],
  }))
}

/** Le nom, ou le numero d'une parcelle **actuelle** (periode ouverte). */
const matchesSearch = (search: string) => {
  const pattern = `%${escapeLike(search)}%`
  return or(
    ilike(memberProfile.name, pattern),
    exists(
      getDb()
        .select({one: sql`1`})
        .from(parcelOwnership)
        .innerJoin(parcel, eq(parcel.id, parcelOwnership.parcelId))
        .where(
          and(
            eq(parcelOwnership.memberProfileId, memberProfile.id),
            isNull(parcelOwnership.endsOn),
            ilike(parcel.number, pattern)
          )
        )
    )
  )
}

/** Les numeros des parcelles actuelles de chaque fiche. */
const getCurrentParcelNumbersByProfile = async (
  memberProfileIds: string[]
): Promise<Record<string, string[]>> => {
  if (memberProfileIds.length === 0) return {}

  const rows = await getDb()
    .select({
      memberProfileId: parcelOwnership.memberProfileId,
      number: parcel.number,
    })
    .from(parcelOwnership)
    .innerJoin(parcel, eq(parcel.id, parcelOwnership.parcelId))
    .where(
      and(
        inArray(parcelOwnership.memberProfileId, memberProfileIds),
        isNull(parcelOwnership.endsOn)
      )
    )

  return rows.reduce<Record<string, string[]>>(
    (numbers, row) => ({
      ...numbers,
      [row.memberProfileId]: [
        ...(numbers[row.memberProfileId] ?? []),
        row.number,
      ],
    }),
    {}
  )
}

/**
 * Une page de la liste du bureau, triee par nom tel que saisi puis par
 * identifiant — un departage stable, pour que la pagination ne saute ni ne
 * repete une ligne.
 */
export const getMemberProfilePageDao = async (input: {
  organizationId: string
  search?: string
  limit: number
  offset: number
}): Promise<MemberProfilePageRows> => {
  const where = and(
    eq(memberProfile.organizationId, input.organizationId),
    input.search ? matchesSearch(input.search) : undefined
  )

  const profiles = await getDb()
    .select({profile: memberProfile, userId: memberProfileAccount.userId})
    .from(memberProfile)
    .leftJoin(
      memberProfileAccount,
      eq(memberProfileAccount.memberProfileId, memberProfile.id)
    )
    .where(where)
    .orderBy(asc(memberProfile.name), asc(memberProfile.id))
    .limit(input.limit)
    .offset(input.offset)
  const [{total}] = await getDb()
    .select({total: count()})
    .from(memberProfile)
    .where(where)
  const numbers = await getCurrentParcelNumbersByProfile(
    profiles.map((row) => row.profile.id)
  )
  const profileCounts = await countProfilesByAccount(
    input.organizationId,
    profiles.flatMap((row) => (row.userId === null ? [] : [row.userId]))
  )

  return {
    rows: profiles.map((row) => ({
      ...row.profile,
      userId: row.userId,
      currentParcelNumbers: numbers[row.profile.id] ?? [],
      accountProfileCount:
        row.userId === null ? 0 : (profileCounts[row.userId] ?? 0),
    })),
    total,
  }
}

/** Le nombre de fiches reliees a chaque compte (critere 8 de s53). */
const countProfilesByAccount = async (
  organizationId: string,
  userIds: string[]
): Promise<Record<string, number>> => {
  if (userIds.length === 0) return {}

  const rows = await getDb()
    .select({userId: memberProfileAccount.userId, profiles: count()})
    .from(memberProfileAccount)
    .where(
      and(
        eq(memberProfileAccount.organizationId, organizationId),
        inArray(memberProfileAccount.userId, [...new Set(userIds)])
      )
    )
    .groupBy(memberProfileAccount.userId)

  return Object.fromEntries(rows.map((row) => [row.userId, row.profiles]))
}

/**
 * Combien de fiches, et combien d'incompletes (decision G) : courrier
 * uniquement, sans adresse, sans code postal et sans commune.
 */
export const countMemberProfilesDao = async (
  organizationId: string
): Promise<{total: number; incomplete: number}> => {
  const [row] = await getDb()
    .select({
      total: count(),
      incomplete: sql<number>`count(*) filter (where ${memberProfile.mailOnly} and ${memberProfile.addressLine} is null and ${memberProfile.postalCode} is null and ${memberProfile.city} is null)::int`,
    })
    .from(memberProfile)
    .where(eq(memberProfile.organizationId, organizationId))
  return row
}

/**
 * Relie une fiche a un compte (s53, ADR 054) : une fiche a au plus un compte,
 * un nouveau lien remplace l'ancien.
 */
export const linkMemberProfileAccountDao = async (input: {
  organizationId: string
  memberProfileId: string
  userId: string
}): Promise<void> => {
  await getDb()
    .insert(memberProfileAccount)
    .values(input)
    .onConflictDoUpdate({
      target: memberProfileAccount.memberProfileId,
      set: {userId: input.userId},
    })
}

/** Retire le lien d'une fiche a son compte ; le compte n'est pas touche. */
export const unlinkMemberProfileAccountDao = async (
  memberProfileId: string
): Promise<void> => {
  await getDb()
    .delete(memberProfileAccount)
    .where(eq(memberProfileAccount.memberProfileId, memberProfileId))
}

/** Le nombre de fiches de l'association reliees a ce compte. */
export const countLinkedProfilesDao = async (
  organizationId: string,
  userId: string
): Promise<number> => {
  const [{total}] = await getDb()
    .select({total: count()})
    .from(memberProfileAccount)
    .where(
      and(
        eq(memberProfileAccount.organizationId, organizationId),
        eq(memberProfileAccount.userId, userId)
      )
    )
  return total
}

/** Les fiches a adresse de l'association qui n'ont pas encore de compte. */
export const getUnlinkedMemberProfilesWithEmailDao = async (
  organizationId: string
): Promise<{id: string; name: string; email: string}[]> => {
  const rows = await getDb()
    .select({
      id: memberProfile.id,
      name: memberProfile.name,
      email: memberProfile.email,
    })
    .from(memberProfile)
    .leftJoin(
      memberProfileAccount,
      eq(memberProfileAccount.memberProfileId, memberProfile.id)
    )
    .where(
      and(
        eq(memberProfile.organizationId, organizationId),
        isNotNull(memberProfile.email),
        isNull(memberProfileAccount.id)
      )
    )
    .orderBy(asc(memberProfile.id))
  return rows.flatMap((row) =>
    row.email === null ? [] : [{id: row.id, name: row.name, email: row.email}]
  )
}

/** Les identifiants des fiches de l'association reliees a ce compte. */
const linkedProfileIds = (organizationId: string, userId: string) =>
  getDb()
    .select({id: memberProfileAccount.memberProfileId})
    .from(memberProfileAccount)
    .where(
      and(
        eq(memberProfileAccount.organizationId, organizationId),
        eq(memberProfileAccount.userId, userId)
      )
    )

/**
 * **Toutes** les fiches de l'association reliees a ce compte (s53, ADR 054),
 * avec leurs parcelles actuelles : « mes fiches », resolues depuis la session,
 * jamais depuis un identifiant venu du navigateur. Non triees : l'ordre est
 * la regle `orderMyProfiles`.
 */
export const getMemberProfilesByUserIdDao = async (
  organizationId: string,
  userId: string
): Promise<MyMemberProfileRow[]> => {
  const profiles = await getDb()
    .select()
    .from(memberProfile)
    .where(
      and(
        eq(memberProfile.organizationId, organizationId),
        inArray(memberProfile.id, linkedProfileIds(organizationId, userId))
      )
    )
  const numbers = await getCurrentParcelNumbersByProfile(
    profiles.map((profile) => profile.id)
  )
  return profiles.map((profile) => ({
    ...profile,
    currentParcelNumbers: numbers[profile.id] ?? [],
  }))
}

/**
 * Coordonnees qu'un membre corrige lui-meme (s16, ADR 040) : pas d'email, par
 * construction. `null` quand la coordonnee est absente.
 */
export type MemberPostalContactWrite = {
  phone: string | null
  addressLine: string | null
  addressComplement: string | null
  postalCode: string | null
  city: string | null
}

/**
 * Met a jour le telephone et l'adresse postale de **toutes** les fiches
 * reliees au compte (s53, arbitrage du 16/11), designees par
 * `(organization_id, user_id)`, jamais par un identifiant venu du navigateur.
 * Rend les fiches ecrites.
 */
export const updateMyMemberProfilesContactDao = async (
  organizationId: string,
  userId: string,
  contact: MemberPostalContactWrite
): Promise<MemberProfileModel[]> => {
  const {phone, addressLine, addressComplement, postalCode, city} = contact
  return getDb()
    .update(memberProfile)
    .set({
      phone,
      addressLine,
      addressComplement,
      postalCode,
      city,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(memberProfile.organizationId, organizationId),
        inArray(memberProfile.id, linkedProfileIds(organizationId, userId))
      )
    )
    .returning()
}

/**
 * La fiche de l'association qui porte cet identifiant client Pennylane (s13,
 * ADR 048) : la cle d'idempotence de l'import.
 */
export const getMemberProfileByPennylaneIdDao = async (
  organizationId: string,
  pennylaneCustomerId: string
): Promise<MemberProfileModel | undefined> => {
  const [row] = await getDb()
    .select()
    .from(memberProfile)
    .where(
      and(
        eq(memberProfile.organizationId, organizationId),
        eq(memberProfile.pennylaneCustomerId, pennylaneCustomerId)
      )
    )
  return row
}
