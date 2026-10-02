import * as parcelOwnershipServiceMethods from '../../parcel-ownership-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Les resultats nomment des proprietaires et, pour la lecture datee, portent
 * leurs coordonnees : ni arguments ni resultats dans les journaux.
 */
const parcelOwnershipServiceInterceptor = createServiceInterceptor(
  parcelOwnershipServiceMethods,
  'PARCEL-OWNERSHIP-SERVICE',
  {shouldLogDetails: () => false}
)

export default parcelOwnershipServiceInterceptor
