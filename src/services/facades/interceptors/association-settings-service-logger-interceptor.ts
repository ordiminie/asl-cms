import * as associationSettingsServiceMethods from '../../association-settings-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Les arguments et les resultats portent des adresses email : ils n'ont pas
 * leur place dans les journaux.
 */
const associationSettingsServiceInterceptor = createServiceInterceptor(
  associationSettingsServiceMethods,
  'ASSOCIATION-SETTINGS-SERVICE',
  {shouldLogDetails: () => false}
)

export default associationSettingsServiceInterceptor
