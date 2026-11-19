import {
  and,
  asc,
  count,
  eq,
  exists,
  getTableColumns,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from 'drizzle-orm'

import {user} from '@/db/models/auth-model'
import {memberProfileAccount} from '@/db/models/member-profile-account-model'
import {memberProfileEmail} from '@/db/models/member-profile-email-model'
import {
  memberProfile,
  MemberProfileModel,
} from '@/db/models/member-profile-model'
import {parcel, parcelOwnership} from '@/db/models/parcel-model'
import {recipientGroupMember} from '@/db/models/recipient-group-model'
import {getDb} from '@/db/tenant-scope'

import {
  activeHolderEmailSql,
  holderUserIdSql,
  mailOnlySql,
  otherActiveEmailCountSql,
} from './member-profile-email-repository'

/**
 * Fiches des proprietaires d'une association (s12, ADR 029). Sous RLS forcee :
 * hors `withTenant(organizationId, ...)`, rien ne sort et rien ne s'ecrit.
 *
 * Ce repository ne touche ni `user` ni `member` (Better Auth) : l'ouverture
 * et la fermeture du compte d'une fiche vivent dans `member-account-service`
 * (s12d) ; il n'ecrit ici que le lien fiche ↔ compte, dans
 * `member_profile_account` (s53, ADR 054).
 *
 * Les adresses vivent dans `member_profile_email` (s54, ADR 056) : les
 * lectures exposent la **titulaire active** comme email de la fiche, et
 * « courrier uniquement » par `NOT EXISTS` d'une adresse active. Aucune
 * lecture ne joint `member_profile_account` a la fiche : une fiche a
 * plusieurs comptes, elle resterait une ligne par compte.
 */

/**
 * `null` quand la coordonnee est absente : jamais une chaine vide. Le bureau
 * ecrit le domicile, le terrain et le nom de l'entreprise (s55, ADR 058).
 */
export type MemberProfileContactWrite = MemberPostalContactWrite & {
  landAddressLine: string | null
  landAddressComplement: string | null
  landPostalCode: string | null
  landCity: string | null
  companyName: string | null
}

export type CreateMemberProfileResult = {
  status: 'created'
  row: MemberProfileModel
}

export type UpdateMemberProfileContactResult =
  {status: 'updated'; row: MemberProfileModel} | {status: 'not_found'}

/**
 * Une fiche lue : ses colonnes, l'adresse titulaire active (`null` sans
 * adresse active) et « courrier uniquement », calcule (ADR 056 §2).
 */
export type MemberProfileReadRow = MemberProfileModel & {
  email: string | null
  mailOnly: boolean
}

/** Un compte relie a une fiche : un par adresse active (ADR 056 §3). */
export type LinkedAccountRow = {userId: string; email: string; name: string}

export type MemberProfileListRow = MemberProfileReadRow & {
  currentParcelNumbers: string[]
  /** Adresses actives de la fiche autres que la titulaire (design 5a). */
  otherEmailCount: number
  /** Le compte de l'adresse titulaire, relie a la fiche ; `null` sinon. */
  holderUserId: string | null
  /** Nombre de fiches reliees au compte titulaire ; 0 sans compte. */
  accountProfileCount: number
}

/** Une fiche d'un compte, avec les numeros de ses parcelles actuelles. */
export type MyMemberProfileRow = MemberProfileReadRow & {
  currentParcelNumbers: string[]
}

/** Les colonnes d'une fiche lue, adresse titulaire et courrier compris. */
const profileReadColumns = () => ({
  ...getTableColumns(memberProfile),
  email: activeHolderEmailSql(),
  mailOnly: mailOnlySql(),
})

export type MemberProfilePageRows = {
  rows: MemberProfileListRow[]
  total: number
}

/** Neutralise les jokers de `LIKE` dans un texte saisi. */
const escapeLike = (value: string): string =>
  value.replace(/[\\%_]/g, (char) => `\\${char}`)

/**
 * Cree une fiche. L'identifiant est genere par la base. Ses adresses
 * s'ecrivent ensuite dans `member_profile_email` (ADR 056), par le service.
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

/** Une fiche lue, avec sa titulaire active (ADR 056), ou rien. */
export const getMemberProfileByIdDao = async (
  memberProfileId: string
): Promise<MemberProfileReadRow | undefined> => {
  const [row] = await getDb()
    .select(profileReadColumns())
    .from(memberProfile)
    .where(eq(memberProfile.id, memberProfileId))
  return row
}

/**
 * Le compte de l'adresse titulaire active d'une fiche, s'il lui est relie
 * (s54) : celui que la carte « Role dans l'association » designe.
 */
export const getHolderAccountUserIdDao = async (
  memberProfileId: string
): Promise<string | null> => {
  const [row] = await getDb()
    .select({userId: holderUserIdSql()})
    .from(memberProfile)
    .where(eq(memberProfile.id, memberProfileId))
  return row?.userId ?? null
}

/**
 * Les comptes relies a une fiche, un par adresse active (ADR 056 §3), avec
 * leur adresse de connexion et leur nom.
 */
export const getLinkedAccountsDao = async (
  memberProfileId: string
): Promise<LinkedAccountRow[]> =>
  getDb()
    .select({
      userId: memberProfileAccount.userId,
      email: user.email,
      name: user.name,
    })
    .from(memberProfileAccount)
    .innerJoin(user, eq(user.id, memberProfileAccount.userId))
    .where(eq(memberProfileAccount.memberProfileId, memberProfileId))
    .orderBy(asc(user.email))

/** Une fiche qui porte une adresse, avec le role de l'adresse sur elle. */
export type MemberProfileByEmailRow = MemberProfileReadRow & {
  /** Le compte de cette adresse relie a cette fiche ; `null` sinon. */
  userId: string | null
  role: 'holder' | 'additional'
  currentParcelNumbers: string[]
}

/**
 * **Toutes** les fiches de l'association qui portent cette adresse
 * **active**, sans tenir compte de la casse, chacune avec le compte de
 * l'adresse s'il lui est relie et ses parcelles actuelles (s53, ADR 054 §4 ;
 * s54, ADR 056) : le service y lit le detenteur d'une adresse partagee.
 */
export const getMemberProfilesByEmailDao = async (
  organizationId: string,
  email: string
): Promise<MemberProfileByEmailRow[]> => {
  const rows = await getDb()
    .select({
      profile: profileReadColumns(),
      role: memberProfileEmail.role,
      userId: sql<
        string | null
      >`(select mpa_email."user_id" from "member_profile_account" mpa_email inner join "user" u_email on u_email."id" = mpa_email."user_id" where mpa_email."member_profile_id" = "member_profile_email"."member_profile_id" and lower(u_email."email") = lower("member_profile_email"."email") limit 1)`,
    })
    .from(memberProfileEmail)
    .innerJoin(
      memberProfile,
      eq(memberProfile.id, memberProfileEmail.memberProfileId)
    )
    .where(
      and(
        eq(memberProfileEmail.organizationId, organizationId),
        sql`lower(${memberProfileEmail.email}) = lower(${email})`,
        eq(memberProfileEmail.status, 'active')
      )
    )
    .orderBy(asc(memberProfile.id))
  const numbers = await getCurrentParcelNumbersByProfile(
    rows.map((row) => row.profile.id)
  )
  return rows.map((row) => ({
    ...row.profile,
    userId: row.userId,
    role: row.role,
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

/** La fiche appartient au groupe (s27, ADR 060 §4). */
const inRecipientGroup = (groupId: string) =>
  inArray(
    memberProfile.id,
    getDb()
      .select({id: recipientGroupMember.memberProfileId})
      .from(recipientGroupMember)
      .where(eq(recipientGroupMember.groupId, groupId))
  )

/**
 * Une page de la liste du bureau, triee par nom tel que saisi puis par
 * identifiant — un departage stable, pour que la pagination ne saute ni ne
 * repete une ligne.
 */
export const getMemberProfilePageDao = async (input: {
  organizationId: string
  search?: string
  /** Le filtre « Groupe » de la liste (s27) : les seules fiches du groupe. */
  groupId?: string
  limit: number
  offset: number
}): Promise<MemberProfilePageRows> => {
  const where = and(
    eq(memberProfile.organizationId, input.organizationId),
    input.search ? matchesSearch(input.search) : undefined,
    input.groupId ? inRecipientGroup(input.groupId) : undefined
  )

  const profiles = await getDb()
    .select({
      ...profileReadColumns(),
      otherEmailCount: otherActiveEmailCountSql(),
      holderUserId: holderUserIdSql(),
    })
    .from(memberProfile)
    .where(where)
    .orderBy(asc(memberProfile.name), asc(memberProfile.id))
    .limit(input.limit)
    .offset(input.offset)
  const [{total}] = await getDb()
    .select({total: count()})
    .from(memberProfile)
    .where(where)
  const numbers = await getCurrentParcelNumbersByProfile(
    profiles.map((row) => row.id)
  )
  const profileCounts = await countProfilesByAccount(
    input.organizationId,
    profiles.flatMap((row) =>
      row.holderUserId === null ? [] : [row.holderUserId]
    )
  )

  return {
    rows: profiles.map((row) => ({
      ...row,
      currentParcelNumbers: numbers[row.id] ?? [],
      accountProfileCount:
        row.holderUserId === null ? 0 : (profileCounts[row.holderUserId] ?? 0),
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
 * uniquement (aucune adresse active, ADR 056), et un domicile sans adresse,
 * sans code postal et sans commune (s55, ADR 058 : le terrain ne compte pas).
 * Meme regle que `isIncomplete`, a garder alignee.
 */
export const countMemberProfilesDao = async (
  organizationId: string
): Promise<{total: number; incomplete: number}> => {
  const [row] = await getDb()
    .select({
      total: count(),
      incomplete: sql<number>`count(*) filter (where ${mailOnlySql()} and ${memberProfile.homeAddressLine} is null and ${memberProfile.homePostalCode} is null and ${memberProfile.homeCity} is null)::int`,
    })
    .from(memberProfile)
    .where(eq(memberProfile.organizationId, organizationId))
  return row
}

/**
 * Relie une fiche a un compte (s53, ADR 054). Depuis s54 (ADR 056 §3), une
 * fiche a un compte par adresse active : le lien s'ajoute, il ne remplace
 * jamais celui d'une autre adresse ; un lien deja pose ne change rien.
 */
export const linkMemberProfileAccountDao = async (input: {
  organizationId: string
  memberProfileId: string
  userId: string
}): Promise<void> => {
  await getDb()
    .insert(memberProfileAccount)
    .values(input)
    .onConflictDoNothing({
      target: [
        memberProfileAccount.memberProfileId,
        memberProfileAccount.userId,
      ],
    })
}

/**
 * Retire le lien de **ce** compte a **cette** fiche (s54, critere 10) : les
 * autres comptes de la fiche gardent le leur ; le compte n'est pas touche.
 */
export const unlinkMemberProfileAccountDao = async (
  memberProfileId: string,
  userId: string
): Promise<void> => {
  await getDb()
    .delete(memberProfileAccount)
    .where(
      and(
        eq(memberProfileAccount.memberProfileId, memberProfileId),
        eq(memberProfileAccount.userId, userId)
      )
    )
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

/**
 * Les adresses actives de l'association dont le compte n'est pas encore
 * relie a leur fiche (ADR 056 §3) : une ligne par (fiche, adresse).
 */
export const getUnlinkedMemberProfilesWithEmailDao = async (
  organizationId: string
): Promise<{id: string; name: string; email: string}[]> =>
  getDb()
    .select({
      id: memberProfile.id,
      name: memberProfile.name,
      email: memberProfileEmail.email,
    })
    .from(memberProfileEmail)
    .innerJoin(
      memberProfile,
      eq(memberProfile.id, memberProfileEmail.memberProfileId)
    )
    .where(
      and(
        eq(memberProfileEmail.organizationId, organizationId),
        eq(memberProfileEmail.status, 'active'),
        sql`not exists (select 1 from "member_profile_account" mpa_unlinked inner join "user" u_unlinked on u_unlinked."id" = mpa_unlinked."user_id" where mpa_unlinked."member_profile_id" = "member_profile_email"."member_profile_id" and lower(u_unlinked."email") = lower("member_profile_email"."email"))`
      )
    )
    .orderBy(asc(memberProfile.id), asc(memberProfileEmail.id))

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
    .select(profileReadColumns())
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
 * construction, ni terrain ni nom d'entreprise (s55). `null` quand la
 * coordonnee est absente.
 */
export type MemberPostalContactWrite = {
  phone: string | null
  homeAddressLine: string | null
  homeAddressComplement: string | null
  homePostalCode: string | null
  homeCity: string | null
}

/**
 * Met a jour le telephone et le domicile de **toutes** les fiches
 * reliees au compte (s53, arbitrage du 16/11), designees par
 * `(organization_id, user_id)`, jamais par un identifiant venu du navigateur.
 * Rend les fiches ecrites.
 */
export const updateMyMemberProfilesContactDao = async (
  organizationId: string,
  userId: string,
  contact: MemberPostalContactWrite
): Promise<MemberProfileModel[]> => {
  const {
    phone,
    homeAddressLine,
    homeAddressComplement,
    homePostalCode,
    homeCity,
  } = contact
  return getDb()
    .update(memberProfile)
    .set({
      phone,
      homeAddressLine,
      homeAddressComplement,
      homePostalCode,
      homeCity,
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

/** Les numeros des parcelles actuelles de chaque fiche (s54, page publique). */
export const getCurrentParcelNumbersByProfileDao = async (
  memberProfileIds: string[]
): Promise<Record<string, string[]>> =>
  getCurrentParcelNumbersByProfile(memberProfileIds)

/** Une fiche reliee a un client Pennylane (s20, ADR 062 §2). */
export type PennylaneLinkedProfileRow = {
  id: string
  name: string
  pennylaneCustomerId: string
}

/** Les fiches de l'association qui portent un identifiant client Pennylane. */
export const listPennylaneLinkedProfilesDao = async (
  organizationId: string
): Promise<PennylaneLinkedProfileRow[]> => {
  const rows = await getDb()
    .select({
      id: memberProfile.id,
      name: memberProfile.name,
      pennylaneCustomerId: memberProfile.pennylaneCustomerId,
    })
    .from(memberProfile)
    .where(
      and(
        eq(memberProfile.organizationId, organizationId),
        isNotNull(memberProfile.pennylaneCustomerId)
      )
    )
  return rows.flatMap((row) =>
    row.pennylaneCustomerId === null
      ? []
      : [{...row, pennylaneCustomerId: row.pennylaneCustomerId}]
  )
}

/**
 * Ecrit l'identifiant client Pennylane d'une fiche (s20, critere 4), ou le
 * retire. Rend le nombre de lignes modifiees : 0 pour une fiche invisible
 * sous le tenant.
 */
export const updateMemberProfilePennylaneIdDao = async (
  memberProfileId: string,
  pennylaneCustomerId: string | null
): Promise<number> => {
  const rows = await getDb()
    .update(memberProfile)
    .set({pennylaneCustomerId, updatedAt: sql`now()`})
    .where(eq(memberProfile.id, memberProfileId))
    .returning({id: memberProfile.id})
  return rows.length
}

/** Les fiches de l'association sans identifiant client Pennylane (s20). */
export const listProfilesWithoutPennylaneIdDao = async (
  organizationId: string
): Promise<{id: string; name: string}[]> =>
  getDb()
    .select({id: memberProfile.id, name: memberProfile.name})
    .from(memberProfile)
    .where(
      and(
        eq(memberProfile.organizationId, organizationId),
        isNull(memberProfile.pennylaneCustomerId)
      )
    )
    .orderBy(asc(memberProfile.name))
