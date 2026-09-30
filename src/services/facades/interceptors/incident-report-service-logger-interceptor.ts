import * as incidentReportServiceMethods from '../../incident-report-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * La description d'un signalement et les coordonnees de son auteur sont des
 * donnees personnelles : ni arguments ni resultats dans les journaux.
 */
const incidentReportServiceInterceptor = createServiceInterceptor(
  incidentReportServiceMethods,
  'INCIDENT-REPORT-SERVICE',
  {shouldLogDetails: () => false}
)

export default incidentReportServiceInterceptor
