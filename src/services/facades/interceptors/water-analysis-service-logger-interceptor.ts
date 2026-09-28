import * as waterAnalysisServiceMethods from '../../water-analysis-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Une publication transporte deux fichiers (affiche et PDF) : leur contenu n'a
 * pas sa place dans les journaux.
 */
const waterAnalysisServiceInterceptor = createServiceInterceptor(
  waterAnalysisServiceMethods,
  'WATER-ANALYSIS-SERVICE',
  {shouldLogDetails: () => false}
)

export default waterAnalysisServiceInterceptor
