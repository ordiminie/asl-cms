import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {getLetterCalibrationPdfService} from '@/services/facades/campaign-letter-service-facade'

import {
  emptyResponse,
  pdfAttachment,
  refusalResponseOf,
} from '../letter-pdf-response'

const CALIBRATION_FILE_NAME = 'page-de-calage.pdf'

/**
 * La page de calage du courrier (s28, ADR 067 §4), au decalage regle par
 * l'association du domaine appele. Toujours disponible, a part du lot.
 */
export async function GET(): Promise<Response> {
  const tenant = await getCurrentTenantDal()
  if (!tenant) return emptyResponse(404)

  try {
    const pdf = await getLetterCalibrationPdfService(tenant.id)
    return pdfAttachment(pdf, CALIBRATION_FILE_NAME)
  } catch (error) {
    return refusalResponseOf(error)
  }
}
