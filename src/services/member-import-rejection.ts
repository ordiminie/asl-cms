import {ValidationParsedZodError} from './errors/validation-error'
import {
  ImportRejection,
  ImportRejectionConst,
} from './types/domain/member-import-types'

/**
 * Motifs de rejet d'une ligne d'import, tires de la validation des services
 * appeles (s13, partage par la mise a jour annuelle de s56).
 */
const FIELD_REJECTIONS: Record<string, ImportRejection> = {
  email: ImportRejectionConst.INVALID_EMAIL,
  homePostalCode: ImportRejectionConst.INVALID_POSTAL_CODE,
  landPostalCode: ImportRejectionConst.INVALID_POSTAL_CODE,
  phone: ImportRejectionConst.INVALID_PHONE,
}

/** Le premier champ refuse par la validation des services, en motif. */
export const rejectionOfValidation = (
  error: ValidationParsedZodError
): ImportRejection => {
  const field = error.zodErrorFields?.issues[0]?.path[0]
  return (
    (typeof field === 'string' ? FIELD_REJECTIONS[field] : undefined) ??
    ImportRejectionConst.INVALID_FIELD
  )
}
