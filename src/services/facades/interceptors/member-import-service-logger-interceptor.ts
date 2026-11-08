import * as memberImportServiceMethods from '../../member-import-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Le fichier importe et le rapport portent noms, adresses et emails : ni
 * arguments ni resultats dans les journaux (ADR 047).
 */
const memberImportServiceInterceptor = createServiceInterceptor(
  memberImportServiceMethods,
  'MEMBER-IMPORT-SERVICE',
  {shouldLogDetails: () => false}
)

export default memberImportServiceInterceptor
