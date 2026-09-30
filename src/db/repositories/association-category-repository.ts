import {and, asc, count, eq, isNull, sql} from 'drizzle-orm'

import {
  associationCategory,
  AssociationCategoryModel,
} from '@/db/models/association-category-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Categories administrables d'une association (s10, ADR 028). Sous RLS
 * forcee : hors `withTenant(organizationId, ...)`, rien ne sort et rien ne
 * s'ecrit.
 */

const ACTIVE_NAME_INDEX = 'association_category_active_name_idx'

export type CategoryWriteInput = {
  name: string
  /** `null` quand l'adresse est absente : jamais une chaine vide. */
  routingEmail: string | null
}

export type CreateCategoryResult =
  | {status: 'created'; row: AssociationCategoryModel}
  | {status: 'limit_reached'}
  | {status: 'duplicate_name'}

export type UpdateCategoryResult =
  | {status: 'updated'; row: AssociationCategoryModel}
  | {status: 'not_found'}
  | {status: 'duplicate_name'}

/**
 * Violation de l'index unique des noms actifs. Drizzle enveloppe l'erreur du
 * pilote : le code Postgres est sur l'erreur ou sur sa cause.
 */
const isDuplicateNameViolation = (error: unknown): boolean => {
  const candidates = [error, (error as {cause?: unknown})?.cause]
  return candidates.some((candidate) => {
    const pgError = candidate as {code?: string; constraint?: string}
    return pgError?.code === '23505' && pgError.constraint === ACTIVE_NAME_INDEX
  })
}

const activeInDomain = (domain: string) =>
  and(
    eq(associationCategory.domain, domain),
    isNull(associationCategory.deletedAt)
  )

/** Les categories actives d'un domaine, par nom. */
export const listActiveCategoriesDao = async (
  organizationId: string,
  domain: string
): Promise<AssociationCategoryModel[]> =>
  getDb()
    .select()
    .from(associationCategory)
    .where(
      and(
        eq(associationCategory.organizationId, organizationId),
        activeInDomain(domain)
      )
    )
    .orderBy(asc(associationCategory.name), asc(associationCategory.id))

/** Une categorie par son identifiant, active **ou supprimee**. */
export const getCategoryByIdDao = async (
  categoryId: string
): Promise<AssociationCategoryModel | undefined> => {
  const [row] = await getDb()
    .select()
    .from(associationCategory)
    .where(eq(associationCategory.id, categoryId))
  return row
}

/**
 * Cree une categorie **dans la limite** du plafond (ADR 028 §3) : verrou
 * transactionnel sur la cle (association, domaine), compte des actives, puis
 * insertion. Deux ajouts simultanes sont serialises : le second compte la
 * premiere. Le verrou tient jusqu'a la fin de la transaction du scope de
 * tenant.
 */
export const createCategoryWithinLimitTxnDao = async (
  input: CategoryWriteInput & {organizationId: string; domain: string},
  max: number
): Promise<CreateCategoryResult> => {
  try {
    return await getDb().transaction(async (tx) => {
      const lockKey = `association_category:${input.organizationId}:${input.domain}`
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`
      )

      const [{total}] = await tx
        .select({total: count()})
        .from(associationCategory)
        .where(
          and(
            eq(associationCategory.organizationId, input.organizationId),
            activeInDomain(input.domain)
          )
        )
      if (total >= max) {
        return {status: 'limit_reached'} as const
      }

      const [row] = await tx
        .insert(associationCategory)
        .values({
          organizationId: input.organizationId,
          domain: input.domain,
          name: input.name,
          routingEmail: input.routingEmail,
        })
        .returning()
      return {status: 'created', row} as const
    })
  } catch (error) {
    if (isDuplicateNameViolation(error)) return {status: 'duplicate_name'}
    throw error
  }
}

/** Renomme une categorie active, ou change son adresse de routage. */
export const updateCategoryTxnDao = async (
  categoryId: string,
  domain: string,
  input: CategoryWriteInput
): Promise<UpdateCategoryResult> => {
  try {
    return await getDb().transaction(async (tx) => {
      const [row] = await tx
        .update(associationCategory)
        .set({name: input.name, routingEmail: input.routingEmail})
        .where(
          and(eq(associationCategory.id, categoryId), activeInDomain(domain))
        )
        .returning()
      return row
        ? ({status: 'updated', row} as const)
        : ({status: 'not_found'} as const)
    })
  } catch (error) {
    if (isDuplicateNameViolation(error)) return {status: 'duplicate_name'}
    throw error
  }
}

/**
 * Suppression **logique** (critere 5, ADR 028 §2) : pose `deleted_at`. Les
 * signalements qui la referencent continuent de lire son nom. Jamais de
 * `delete`.
 */
export const softDeleteCategoryDao = async (
  categoryId: string,
  domain: string
): Promise<AssociationCategoryModel | undefined> => {
  const [row] = await getDb()
    .update(associationCategory)
    .set({deletedAt: sql`now()`})
    .where(and(eq(associationCategory.id, categoryId), activeInDomain(domain)))
    .returning()
  return row
}
