import {eq} from 'drizzle-orm'

import db from '@/db/models/db'

import {
  AddAppSettingModel,
  AppSettingModel,
  appSettings,
  settingCategoryEnum,
} from '../models/app-settings-model'

export type SettingCategory = (typeof settingCategoryEnum.enumValues)[number]

export const getAllAppSettingsDao = async (): Promise<AppSettingModel[]> => {
  return await db.select().from(appSettings)
}

export const getAppSettingsByCategoryDao = async (
  category: SettingCategory
): Promise<AppSettingModel[]> => {
  return await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.category, category))
}

export const getAppSettingByKeyDao = async (
  key: string
): Promise<AppSettingModel | undefined> => {
  const rows = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, key))
  return rows[0]
}

export const upsertAppSettingDao = async (
  setting: AddAppSettingModel
): Promise<AppSettingModel> => {
  const rows = await db
    .insert(appSettings)
    .values(setting)
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: setting.value,
        type: setting.type,
        category: setting.category,
        label: setting.label,
        description: setting.description,
        updatedAt: new Date(),
        updatedBy: setting.updatedBy,
      },
    })
    .returning()
  return rows[0]
}

export const updateAppSettingValueDao = async (
  key: string,
  value: string,
  updatedBy?: string
): Promise<AppSettingModel | undefined> => {
  const rows = await db
    .update(appSettings)
    .set({
      value,
      updatedAt: new Date(),
      updatedBy,
    })
    .where(eq(appSettings.key, key))
    .returning()
  return rows[0]
}

export const deleteAppSettingDao = async (key: string): Promise<boolean> => {
  const result = await db.delete(appSettings).where(eq(appSettings.key, key))
  return (result.rowCount || 0) > 0
}
