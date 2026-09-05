import {ZodError} from 'zod'

export const PARSED_ERROR_MESSAGE = 'Erreur de validation'

export class ValidationError extends Error {
  constructor(message?: string) {
    super(`${PARSED_ERROR_MESSAGE} : ${message}`)
    this.name = 'ParsedError'
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, ValidationError)
    }
  }
}

export class ValidationParsedZodError extends Error {
  zodErrorFields: ZodError | undefined

  constructor(err?: ZodError) {
    const errorDetails = err?.issues
      .map(
        (issue) => `Path: ${issue.path.join('.')} | Message: ${issue.message}`
      )
      .join('\n')
    super()
    this.name = 'ParsedError'
    this.message = errorDetails ?? PARSED_ERROR_MESSAGE
    this.zodErrorFields = err

    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, ValidationError)
    }
    return this
  }
}

/**
 * Helper pour vérifier si une erreur est de type ValidationParsedZodError
 */
export function isValidationParsedZodError(
  error: unknown
): error is ValidationParsedZodError {
  return (
    error instanceof ValidationParsedZodError &&
    error.name === 'ParsedError' &&
    error.zodErrorFields !== undefined
  )
}
