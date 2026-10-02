import {and, asc, eq, gt, isNotNull, isNull, lte, or} from 'drizzle-orm'
import {alias} from 'drizzle-orm/pg-core'

import {
  memberProfile,
  MemberProfileModel,
} from '@/db/models/member-profile-model'
import {parcel, ParcelModel, parcelOwnership} from '@/db/models/parcel-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Parcelles et periodes de propriete d'une association (s12, ADR 029). Sous
 * RLS forcee : hors `withTenant(organizationId, ...)`, rien ne sort et rien ne
 * s'ecrit.
 *
 * Les fonctions `…TxnDao` s'executent **dans la transaction du scope de
 * tenant** (`getDb()`), jamais dans une transaction ouverte depuis le pool :
 * elle sortirait du scope, donc de la RLS, et le verrou de la parcelle ne
 * couvrirait plus l'ecriture.
 *
 * **Une periode close est immuable** (ADR 029 §4) : la seule mise a jour
 * exposee pose `ends_on` sur une periode ouverte. Aucune fonction ne modifie
 * ni ne supprime une periode close, et aucune ne doit etre ajoutee.
 */

export type ParcelPeriodRow = {
  id: string
  memberProfileId: string
  memberName: string
  startsOn: string
  endsOn: string | null
}

export type CurrentParcelRow = {
  parcelId: string
  number: string
  startsOn: string
}

export type FormerParcelRow = {
  parcelId: string
  number: string
  startsOn: string
  endsOn: string
  buyerId: string | null
  buyerName: string | null
}

/**
 * La parcelle de ce numero, creee si elle n'existe pas (design `4d`).
 * `ON CONFLICT DO NOTHING` puis lecture : deux rattachements simultanes de la
 * meme parcelle inconnue n'en creent qu'une.
 */
export const findOrCreateParcelTxnDao = async (
  organizationId: string,
  number: string
): Promise<{row: ParcelModel; created: boolean}> => {
  const [created] = await getDb()
    .insert(parcel)
    .values({organizationId, number})
    .onConflictDoNothing({target: [parcel.organizationId, parcel.number]})
    .returning()
  if (created) return {row: created, created: true}

  const [existing] = await getDb()
    .select()
    .from(parcel)
    .where(
      and(eq(parcel.organizationId, organizationId), eq(parcel.number, number))
    )
  return {row: existing, created: false}
}

/** Une parcelle par son identifiant, sans verrou : pour la lecture seule. */
export const getParcelByIdDao = async (
  parcelId: string
): Promise<ParcelModel | undefined> => {
  const [row] = await getDb()
    .select()
    .from(parcel)
    .where(eq(parcel.id, parcelId))
  return row
}

/**
 * Verrouille la ligne de la parcelle jusqu'a la fin de la transaction du scope
 * de tenant (ADR 029 §3) : deux rattachements ou deux ventes simultanes sur la
 * meme parcelle sont serialises, le second lit les periodes ecrites par le
 * premier.
 */
export const lockParcelTxnDao = async (
  parcelId: string
): Promise<ParcelModel | undefined> => {
  const [row] = await getDb()
    .select()
    .from(parcel)
    .where(eq(parcel.id, parcelId))
    .for('update')
  return row
}

/** Les periodes d'une parcelle, de la plus ancienne a la plus recente. */
export const getParcelPeriodsDao = async (
  parcelId: string
): Promise<ParcelPeriodRow[]> =>
  getDb()
    .select({
      id: parcelOwnership.id,
      memberProfileId: parcelOwnership.memberProfileId,
      memberName: memberProfile.name,
      startsOn: parcelOwnership.startsOn,
      endsOn: parcelOwnership.endsOn,
    })
    .from(parcelOwnership)
    .innerJoin(
      memberProfile,
      eq(memberProfile.id, parcelOwnership.memberProfileId)
    )
    .where(eq(parcelOwnership.parcelId, parcelId))
    .orderBy(asc(parcelOwnership.startsOn), asc(parcelOwnership.id))

/**
 * Pose la date de fin d'une periode **ouverte**, et d'elle seule : le
 * `WHERE ends_on IS NULL` rend une periode close intouchable. Rend `false` si
 * la periode n'existe pas ou n'est plus ouverte.
 */
export const closeOpenPeriodTxnDao = async (
  periodId: string,
  endsOn: string
): Promise<boolean> => {
  const closed = await getDb()
    .update(parcelOwnership)
    .set({endsOn})
    .where(
      and(eq(parcelOwnership.id, periodId), isNull(parcelOwnership.endsOn))
    )
    .returning({id: parcelOwnership.id})
  return closed.length === 1
}

/** Ouvre une periode de propriete, sans date de fin. */
export const openPeriodTxnDao = async (input: {
  organizationId: string
  parcelId: string
  memberProfileId: string
  startsOn: string
}): Promise<void> => {
  await getDb().insert(parcelOwnership).values(input)
}

/** Les parcelles actuelles d'une fiche : ses periodes ouvertes. */
export const getCurrentParcelsByMemberDao = async (
  memberProfileId: string
): Promise<CurrentParcelRow[]> =>
  getDb()
    .select({
      parcelId: parcel.id,
      number: parcel.number,
      startsOn: parcelOwnership.startsOn,
    })
    .from(parcelOwnership)
    .innerJoin(parcel, eq(parcel.id, parcelOwnership.parcelId))
    .where(
      and(
        eq(parcelOwnership.memberProfileId, memberProfileId),
        isNull(parcelOwnership.endsOn)
      )
    )

/**
 * Les anciennes parcelles d'une fiche : ses periodes closes, avec l'acquereur
 * — la fiche dont la periode commence le jour ou celle-ci finit.
 */
export const getFormerParcelsByMemberDao = async (
  memberProfileId: string
): Promise<FormerParcelRow[]> => {
  const nextOwnership = alias(parcelOwnership, 'next_ownership')
  const buyer = alias(memberProfile, 'buyer')

  const rows = await getDb()
    .select({
      parcelId: parcel.id,
      number: parcel.number,
      startsOn: parcelOwnership.startsOn,
      endsOn: parcelOwnership.endsOn,
      buyerId: buyer.id,
      buyerName: buyer.name,
    })
    .from(parcelOwnership)
    .innerJoin(parcel, eq(parcel.id, parcelOwnership.parcelId))
    .leftJoin(
      nextOwnership,
      and(
        eq(nextOwnership.parcelId, parcelOwnership.parcelId),
        eq(nextOwnership.startsOn, parcelOwnership.endsOn)
      )
    )
    .leftJoin(buyer, eq(buyer.id, nextOwnership.memberProfileId))
    .where(
      and(
        eq(parcelOwnership.memberProfileId, memberProfileId),
        isNotNull(parcelOwnership.endsOn)
      )
    )

  return rows.flatMap((row) =>
    row.endsOn === null ? [] : [{...row, endsOn: row.endsOn}]
  )
}

/**
 * Le proprietaire d'une parcelle a une date (ADR 029 §2) : la fiche dont la
 * periode demi-ouverte `[starts_on, ends_on)` couvre ce jour. Le jour de la
 * vente appartient a l'acquereur.
 */
export const getParcelOwnerAtDao = async (
  parcelId: string,
  date: string
): Promise<MemberProfileModel | undefined> => {
  const [row] = await getDb()
    .select({profile: memberProfile})
    .from(parcelOwnership)
    .innerJoin(
      memberProfile,
      eq(memberProfile.id, parcelOwnership.memberProfileId)
    )
    .where(
      and(
        eq(parcelOwnership.parcelId, parcelId),
        lte(parcelOwnership.startsOn, date),
        or(isNull(parcelOwnership.endsOn), gt(parcelOwnership.endsOn, date))
      )
    )
  return row?.profile
}
