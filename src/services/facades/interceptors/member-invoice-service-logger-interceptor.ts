import * as memberInvoiceServiceMethods from '../../member-invoice-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Les factures nomment un montant, un statut et une fiche : ni arguments ni
 * resultats dans les journaux.
 */
const memberInvoiceServiceInterceptor = createServiceInterceptor(
  memberInvoiceServiceMethods,
  'MEMBER-INVOICE-SERVICE',
  {shouldLogDetails: () => false}
)

export default memberInvoiceServiceInterceptor
