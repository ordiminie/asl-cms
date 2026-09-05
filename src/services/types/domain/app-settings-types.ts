import {
  AddAppSettingModel,
  AppSettingModel,
} from '@/db/models/app-settings-model'

export type SettingType = 'boolean' | 'string' | 'number' | 'json'
export type SettingCategory = 'email' | 'general'

export type AppSetting = AppSettingModel
export type AddAppSetting = AddAppSettingModel
export type CreateAppSetting = Omit<AddAppSetting, 'updatedAt' | 'updatedBy'>
export type UpdateAppSetting = {
  key: string
  value: string
  updatedBy?: string
}

export type ParsedSettingValue<T extends SettingType> = T extends 'boolean'
  ? boolean
  : T extends 'number'
    ? number
    : T extends 'json'
      ? Record<string, unknown>
      : string

export type AppSettingDTO = {
  key: string
  value: string
  type: SettingType
  category: SettingCategory
  label?: string | null
  description?: string | null
}

export type AppSettingsGroupedByCategory = Record<SettingCategory, AppSetting[]>

export const AppSettingKeys = {
  EMAIL_ENABLED: 'email.enabled',
  EMAIL_ENABLED_FOR_ADMINS: 'email.enabled_for_admins',
  EMAIL_ENABLED_FOR_CLIENTS: 'email.enabled_for_clients',
  EMAIL_COMMUNICATION_EMAIL: 'email.communication_email',
  GENERAL_MAINTENANCE_MODE: 'general.maintenance_mode',
  GENERAL_MAINTENANCE_MESSAGE: 'general.maintenance_message',
} as const

export type AppSettingKey = (typeof AppSettingKeys)[keyof typeof AppSettingKeys]
