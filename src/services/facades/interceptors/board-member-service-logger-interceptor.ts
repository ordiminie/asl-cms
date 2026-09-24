import * as boardMemberServiceMethods from '../../board-member-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Une fiche du bureau porte des donnees personnelles — nom, biographie, photo.
 * Elles n'ont pas leur place dans les journaux, meme en mode debug.
 */
const boardMemberServiceInterceptor = createServiceInterceptor(
  boardMemberServiceMethods,
  'BOARD-MEMBER-SERVICE',
  {shouldLogDetails: () => false}
)

export default boardMemberServiceInterceptor
