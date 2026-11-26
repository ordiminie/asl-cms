import * as memberAnnualImportServiceMethods from '../../member-annual-import-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Le fichier importe et le rapport portent noms, adresses et emails : ni
 * arguments ni resultats dans les journaux (ADR 047).
 */
const memberAnnualImportServiceInterceptor = createServiceInterceptor(
  memberAnnualImportServiceMethods,
  'MEMBER-ANNUAL-IMPORT-SERVICE',
  {shouldLogDetails: () => false}
)

export default memberAnnualImportServiceInterceptor
