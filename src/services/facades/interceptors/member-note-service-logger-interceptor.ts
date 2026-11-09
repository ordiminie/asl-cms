import * as memberNoteServiceMethods from '../../member-note-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Le texte d'une note parle d'une personne physique (ADR 050) : ni arguments
 * ni resultats dans les journaux.
 */
const memberNoteServiceInterceptor = createServiceInterceptor(
  memberNoteServiceMethods,
  'MEMBER-NOTE-SERVICE',
  {shouldLogDetails: () => false}
)

export default memberNoteServiceInterceptor
