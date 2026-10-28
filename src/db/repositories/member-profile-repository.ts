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
 * (s12d, ADR 037) ; il n'ecrit ici que le lien `user_id`.
 */

const EMAIL_INDEX = 'member_profile_organization_email_idx'

/** `null` quand la coordonnee est absente : jamais une chaine vide. */
export type MemberProfileContactWrite = {
  email: string | null
  phone: string | null
  addressLine: string | null
  addressComplement: string | null
  postalCode: string | null
  city: string | null
}

export type CreateMemberProfileResult =
  {status: 'created'; row: MemberProfileModel} | {status: 'email_taken'}

export type UpdateMemberProfileContactResult =
  | {status: 'updated'; row: MemberProfileModel}
  | {status: 'not_found'}
  | {status: 'email_taken'}

export type MemberProfileListRow = MemberProfileModel & {
  currentParcelNumbers: string[]
}

export type MemberProfilePageRows = {
  rows: MemberProfileListRow[]
  total: number
}

/**
 * Violation de l'index unique des emails d'une association. Drizzle enveloppe
 * l'erreur du pilote : le code Postgres est sur l'erreur ou sur sa cause.
 */
const isEmailTakenViolation = (error: unknown): boolean => {
  const candidates = [error, (error as {cause?: unknown})?.cause]
  return candidates.some((candidate) => {
    const pgError = candidate as {code?: string; constraint?: string}
    return pgError?.code === '23505' && pgError.constraint === EMAIL_INDEX
  })
}

/** Neutralise les jokers de `LIKE` dans un texte saisi. */
const escapeLike = (value: string): string =>
  value.replace(/[\\%_]/g, (char) => `\\${char}`)

/**
 * Cree une fiche. L'identifiant est genere par la base. L'insertion vit dans
 * un point de sauvegarde : un email deja pris est rendu comme un resultat,
 * sans condamner la transaction du scope de tenant.
 */
export const createMemberProfileTxnDao = async (
  input: MemberProfileContactWrite & {organizationId: string; name: string}
): Promise<CreateMemberProfileResult> => {
  try {
    return await getDb().transaction(async (tx) => {
      const [row] = await tx.insert(memberProfile).values(input).returning()
      return {status: 'created', row} as const
    })
  } catch (error) {
    if (isEmailTakenViolation(error)) return {status: 'email_taken'}
    throw error
  }
}

/** Met a jour les coordonnees d'une fiche, et elles seules. */
export const updateMemberProfileContactTxnDao = async (
  memberProfileId: string,
  contact: MemberProfileContactWrite
): Promise<UpdateMemberProfileContactResult> => {
  try {
    return await getDb().transaction(async (tx) => {
      const [row] = await tx
        .update(memberProfile)
        .set({...contact, updatedAt: sql`now()`})
        .where(eq(memberProfile.id, memberProfileId))
        .returning()
      return row
        ? ({status: 'updated', row} as const)
        : ({status: 'not_found'} as const)
    })
  } catch (error) {
    if (isEmailTakenViolation(error)) return {status: 'email_taken'}
    throw error
  }
}

export const getMemberProfileByIdDao = async (
  memberProfileId: string
): Promise<MemberProfileModel | undefined> => {
  const [row] = await getDb()
    .select()
    .from(memberProfile)
    .where(eq(memberProfile.id, memberProfileId))
  return row
}

/** La fiche de l'association qui porte cet email, sans tenir compte de la casse. */
export const getMemberProfileByEmailDao = async (
  organizationId: string,
  email: string
): Promise<MemberProfileModel | undefined> => {
  const [row] = await getDb()
    .select()
    .from(memberProfile)
    .where(
      and(
        eq(memberProfile.organizationId, organizationId),
        sql`lower(${memberProfile.email}) = lower(${email})`
      )
    )
  return row
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
    .select()
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
    profiles.map((profile) => profile.id)
  )

  return {
    rows: profiles.map((profile) => ({
      ...profile,
      currentParcelNumbers: numbers[profile.id] ?? [],
    })),
    total,
  }
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

/** Ecrit ou vide le compte lie a une fiche (s12d, ADR 037). */
export const setMemberProfileUserIdDao = async (
  memberProfileId: string,
  userId: string | null
): Promise<void> => {
  await getDb()
    .update(memberProfile)
    .set({userId, updatedAt: sql`now()`})
    .where(eq(memberProfile.id, memberProfileId))
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
    .where(
      and(
        eq(memberProfile.organizationId, organizationId),
        isNotNull(memberProfile.email),
        isNull(memberProfile.userId)
      )
    )
    .orderBy(asc(memberProfile.id))
  return rows.flatMap((row) =>
    row.email === null ? [] : [{id: row.id, name: row.name, email: row.email}]
  )
}

/**
 * La fiche de l'association liee a ce compte (s12d, ADR 037) : « ma fiche »,
 * resolue depuis la session, jamais depuis un identifiant venu du navigateur.
 */
export const getMemberProfileByUserIdDao = async (
  organizationId: string,
  userId: string
): Promise<MemberProfileModel | undefined> => {
  const [row] = await getDb()
    .select()
    .from(memberProfile)
    .where(
      and(
        eq(memberProfile.organizationId, organizationId),
        eq(memberProfile.userId, userId)
      )
    )
  return row
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
 * Met a jour le telephone et l'adresse postale de « ma fiche », designee par
 * `(organization_id, user_id)`, jamais par un identifiant venu du navigateur.
 * Aucun index unique n'est concerne : pas de point de sauvegarde.
 */
export const updateMyMemberProfileContactDao = async (
  organizationId: string,
  userId: string,
  contact: MemberPostalContactWrite
): Promise<MemberProfileModel | undefined> => {
  const {phone, addressLine, addressComplement, postalCode, city} = contact
  const [row] = await getDb()
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
        eq(memberProfile.userId, userId)
      )
    )
    .returning()
  return row
}
