import * as emailServiceMethods from '../../email-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Ni le lien de connexion, ni le contenu d'un email rendu ou rejoue (s52,
 * critere 7) n'ont leur place dans les journaux.
 */
const METHODS_WITHOUT_DETAILS: ReadonlySet<string> = new Set([
  'sendMagicLinkEmailService',
  'sendEmailService',
  'transmitComposedEmail',
])

const emailServiceInterceptor = createServiceInterceptor(
  emailServiceMethods,
  'EMAIL-SERVICE',
  {
    shouldLogDetails: (methodName) => !METHODS_WITHOUT_DETAILS.has(methodName),
  }
)

export default emailServiceInterceptor
