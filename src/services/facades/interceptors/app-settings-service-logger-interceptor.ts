import * as appSettingsServiceMethods from '../../app-settings-service'
import {createServiceInterceptor} from './create-service-interceptor'

const appSettingsServiceInterceptor = createServiceInterceptor(
  appSettingsServiceMethods,
  'APP-SETTINGS-SERVICE'
)

export default appSettingsServiceInterceptor
