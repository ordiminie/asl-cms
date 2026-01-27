import {z} from 'zod'

import {
  CreateAppSetting,
  UpdateAppSetting,
} from '../types/domain/app-settings-types'

export const settingTypeSchema = z.enum(['boolean', 'string', 'number', 'json'])
export const settingCategorySchema = z.enum(['email', 'general'])

export const createAppSettingServiceSchema = z.object({
  key: z
    .string()
    .min(1, {message: 'La clé est requise.'})
    .max(100, {message: 'La clé ne doit pas dépasser 100 caractères.'})
    .regex(/^[\w.-]+$/, {
      message:
        'La clé ne peut contenir que des lettres, chiffres, points, tirets et underscores.',
    }),
  value: z.string(),
  type: settingTypeSchema,
  category: settingCategorySchema,
  label: z
    .string()
    .max(255, {message: 'Le label ne doit pas dépasser 255 caractères.'})
    .optional(),
  description: z
    .string()
    .max(500, {message: 'La description ne doit pas dépasser 500 caractères.'})
    .optional(),
}) satisfies z.Schema<CreateAppSetting>

export const updateAppSettingServiceSchema = z.object({
  key: z.string().min(1, {message: 'La clé est requise.'}),
  value: z.string(),
  updatedBy: z.string().uuid().optional(),
}) satisfies z.Schema<UpdateAppSetting>

export const bulkUpdateAppSettingsServiceSchema = z.array(
  z.object({
    key: z.string().min(1),
    value: z.string(),
  })
)

export const settingKeySchema = z
  .string()
  .min(1, {message: 'La clé est requise.'})
