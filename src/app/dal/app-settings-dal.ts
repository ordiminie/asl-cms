import {cache} from 'react'

import {
  getAllAppSettingsService,
  getAppSettingsGroupedByCategoryService,
} from '@/services/facades/app-settings-service-facade'

export const getAppSettingsDal = cache(async () => {
  return await getAllAppSettingsService()
})

export const getAppSettingsGroupedDal = cache(async () => {
  return await getAppSettingsGroupedByCategoryService()
})
