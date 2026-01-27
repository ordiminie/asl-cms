import {
  getAllAppSettingsDao,
  getAppSettingByKeyDao,
  getAppSettingsByCategoryDao,
  SettingCategory,
  updateAppSettingValueDao,
  upsertAppSettingDao,
} from '@/db/repositories/app-settings-repository'

import {
  canReadAppSettings,
  canUpdateAppSettings,
} from './authorization/app-settings-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationError} from './errors/validation-error'
import {
  AppSetting,
  AppSettingsGroupedByCategory,
  CreateAppSetting,
  ParsedSettingValue,
  SettingType,
  UpdateAppSetting,
} from './types/domain/app-settings-types'
import {
  bulkUpdateAppSettingsServiceSchema,
  createAppSettingServiceSchema,
  settingKeySchema,
  updateAppSettingServiceSchema,
} from './validation/app-settings-validation'

function parseSettingValue<T extends SettingType>(
  value: string,
  type: T
): ParsedSettingValue<T> {
  switch (type) {
    case 'boolean':
      return (value === 'true') as ParsedSettingValue<T>
    case 'number':
      return Number(value) as ParsedSettingValue<T>
    case 'json':
      try {
        return JSON.parse(value) as ParsedSettingValue<T>
      } catch {
        return {} as ParsedSettingValue<T>
      }
    default:
      return value as ParsedSettingValue<T>
  }
}

export const getAllAppSettingsService = async (): Promise<AppSetting[]> => {
  const granted = await canReadAppSettings()
  if (!granted) {
    throw new AuthorizationError()
  }

  return await getAllAppSettingsDao()
}

export const getAppSettingsGroupedByCategoryService =
  async (): Promise<AppSettingsGroupedByCategory> => {
    const granted = await canReadAppSettings()
    if (!granted) {
      throw new AuthorizationError()
    }

    const settings = await getAllAppSettingsDao()
    const grouped: AppSettingsGroupedByCategory = {
      email: [],
      general: [],
    }

    for (const setting of settings) {
      if (setting.category in grouped) {
        grouped[setting.category as SettingCategory].push(setting)
      }
    }

    grouped.email.sort((a, b) => a.key.localeCompare(b.key))
    grouped.general.sort((a, b) => a.key.localeCompare(b.key))

    return grouped
  }

export const getAppSettingsByCategoryService = async (
  category: SettingCategory
): Promise<AppSetting[]> => {
  const granted = await canReadAppSettings()
  if (!granted) {
    throw new AuthorizationError()
  }

  return await getAppSettingsByCategoryDao(category)
}

export const getAppSettingByKeyService = async (
  key: string
): Promise<AppSetting | undefined> => {
  const parsed = settingKeySchema.safeParse(key)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const granted = await canReadAppSettings()
  if (!granted) {
    throw new AuthorizationError()
  }

  return await getAppSettingByKeyDao(key)
}

export const getSettingValueService = async <T extends SettingType>(
  key: string
): Promise<ParsedSettingValue<T> | undefined> => {
  const setting = await getAppSettingByKeyDao(key)
  if (!setting) return undefined

  return parseSettingValue<T>(setting.value, setting.type as T)
}

export const getBooleanSettingService = async (
  key: string
): Promise<boolean> => {
  const setting = await getAppSettingByKeyDao(key)
  if (!setting) return false
  return setting.value === 'true'
}

export const getStringSettingService = async (
  key: string
): Promise<string | undefined> => {
  const setting = await getAppSettingByKeyDao(key)
  if (!setting) return undefined
  return setting.value
}

export const getNumberSettingService = async (
  key: string
): Promise<number | undefined> => {
  const setting = await getAppSettingByKeyDao(key)
  if (!setting) return undefined
  return Number(setting.value)
}

export const createAppSettingService = async (
  data: CreateAppSetting
): Promise<AppSetting> => {
  const parsed = createAppSettingServiceSchema.safeParse(data)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const granted = await canUpdateAppSettings()
  if (!granted) {
    throw new AuthorizationError()
  }

  return await upsertAppSettingDao(parsed.data)
}

export const updateAppSettingService = async (
  data: UpdateAppSetting
): Promise<AppSetting | undefined> => {
  const parsed = updateAppSettingServiceSchema.safeParse(data)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const granted = await canUpdateAppSettings()
  if (!granted) {
    throw new AuthorizationError()
  }

  return await updateAppSettingValueDao(
    parsed.data.key,
    parsed.data.value,
    parsed.data.updatedBy
  )
}

export const bulkUpdateAppSettingsService = async (
  settings: Array<{key: string; value: string}>,
  updatedBy?: string
): Promise<void> => {
  const parsed = bulkUpdateAppSettingsServiceSchema.safeParse(settings)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const granted = await canUpdateAppSettings()
  if (!granted) {
    throw new AuthorizationError()
  }

  await Promise.all(
    parsed.data.map((setting) =>
      updateAppSettingValueDao(setting.key, setting.value, updatedBy)
    )
  )
}
