import {logger} from '@/lib/logger'
import {AuthorizationError} from '@/services/errors/authorization-error'

type ServiceInterceptorOptions = {
  shouldLogDetails?: (methodName: string, args: unknown[]) => boolean
}

/**
 * Crée un interceptor de service sans utiliser de Proxy (compatible Turbopack Next.js 16)
 * Cette fonction enveloppe chaque méthode avec du logging et gestion d'erreurs
 */
export function createServiceInterceptor<T extends Record<string, unknown>>(
  serviceMethods: T,
  serviceName: string,
  options?: ServiceInterceptorOptions
): T {
  const wrapped: Record<string, unknown> = {}

  for (const [key, method] of Object.entries(serviceMethods)) {
    if (typeof method === 'function') {
      wrapped[key] = async (...args: unknown[]) => {
        const shouldLogDetails = options?.shouldLogDetails?.(key, args) ?? true

        logger.info(`[${serviceName}] Appel de la méthode ${key}`)
        if (shouldLogDetails) {
          logger.debug(
            `[${serviceName}] Appel de la méthode ${key} avec les arguments`,
            {args}
          )
        }

        try {
          const result = await (
            method as (...args: unknown[]) => Promise<unknown>
          )(...args)

          logger.info(`[${serviceName}] Retour de la méthode ${key}`)
          if (shouldLogDetails) {
            logger.debug(
              `[${serviceName}] Résultat de la méthode ${key}`,
              result
            )
          }

          return result
        } catch (error) {
          if (!shouldLogDetails) {
            logger.error(`[${serviceName}] Erreur dans la méthode ${key}`)
          } else if (error instanceof AuthorizationError) {
            logger.error(
              `[${serviceName}] Autorisation Erreur dans la méthode ${key}:`,
              (error as Error).message
            )
          } else {
            logger.error(
              `[${serviceName}] Erreur dans la méthode ${key}:`,
              error
            )
            logger.debug(
              `[${serviceName}] Erreur dans la méthode ${key}: ${(error as Error).message}`,
              error
            )
          }

          throw error
        }
      }
    } else {
      wrapped[key] = method
    }
  }

  return wrapped as T
}
