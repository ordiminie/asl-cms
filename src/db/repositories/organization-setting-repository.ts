import {and, eq, inArray, sql} from 'drizzle-orm'

import {
  AddOrganizationSettingModel,
  organizationSetting,
  OrganizationSettingModel,
} from '@/db/models/organization-setting-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Lignes de parametres d'une association. Sous RLS forcee : hors
 * `withTenant(organizationId, ...)`, rien ne sort.
 */
export const getOrganizationSettingsDao = async (
  organizationId: string
): Promise<OrganizationSettingModel[]> =>
  getDb()
    .select()
    .from(organizationSetting)
    .where(eq(organizationSetting.organizationId, organizationId))

export const upsertOrganizationSettingsDao = async (
  rows: AddOrganizationSettingModel[]
): Promise<void> => {
  if (rows.length === 0) return

  await getDb()
    .insert(organizationSetting)
    .values(rows)
    .onConflictDoUpdate({
      target: [organizationSetting.organizationId, organizationSetting.key],
      set: {
        value: sql`excluded.value`,
        updatedBy: sql`excluded.updated_by`,
        updatedAt: sql`now()`,
      },
    })
}

export const deleteOrganizationSettingsDao = async (
  organizationId: string,
  keys: string[]
): Promise<void> => {
  if (keys.length === 0) return

  await getDb()
    .delete(organizationSetting)
    .where(
      and(
        eq(organizationSetting.organizationId, organizationId),
        inArray(organizationSetting.key, keys)
      )
    )
}

export type SaveOrganizationSettings = {
  organizationId: string
  upserts: {key: string; value: string}[]
  deletions: string[]
  updatedBy: string | null
}

/**
 * Enregistre un lot de parametres en une transaction : les valeurs
 * renseignees, et la suppression des parametres vides (retour au defaut).
 * A appeler dans `withTenant(organizationId, ...)`.
 */
export const saveOrganizationSettingsTxnDao = async ({
  organizationId,
  upserts,
  deletions,
  updatedBy,
}: SaveOrganizationSettings): Promise<void> => {
  await getDb().transaction(async (tx) => {
    if (upserts.length > 0) {
      await tx
        .insert(organizationSetting)
        .values(
          upserts.map(({key, value}) => ({
            organizationId,
            key,
            value,
            updatedBy,
          }))
        )
        .onConflictDoUpdate({
          target: [organizationSetting.organizationId, organizationSetting.key],
          set: {
            value: sql`excluded.value`,
            updatedBy: sql`excluded.updated_by`,
            updatedAt: sql`now()`,
          },
        })
    }

    if (deletions.length > 0) {
      await tx
        .delete(organizationSetting)
        .where(
          and(
            eq(organizationSetting.organizationId, organizationId),
            inArray(organizationSetting.key, deletions)
          )
        )
    }
  })
}
