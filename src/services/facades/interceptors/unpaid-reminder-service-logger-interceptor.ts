import * as unpaidReminderServiceMethods from '../../unpaid-reminder-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Factures et destinataires des relances sont des donnees personnelles
 * (s29, ADR 070) : ni arguments ni resultats dans les journaux.
 */
const unpaidReminderServiceInterceptor = createServiceInterceptor(
  unpaidReminderServiceMethods,
  'UNPAID-REMINDER-SERVICE',
  {shouldLogDetails: () => false}
)

export default unpaidReminderServiceInterceptor
