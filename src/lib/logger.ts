import winston from 'winston'

import {env} from '@/env'
const isConsole = env.NEXT_PUBLIC_NODE_ENV === 'development' ? false : false

// Logger Winston pour la production
const winstonLogger = winston.createLogger({
  level: env.LOG_LEVEL || 'info',
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.colorize(),
        winston.format.printf(({timestamp, level, message, ...metadata}) => {
          // Récupérer les arguments supplémentaires depuis Symbol(splat)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const splatArgs = (metadata as any)[Symbol.for('splat')] || []

          // Récupérer les autres métadonnées (hors symbols)
          const otherMetadata = Object.keys(metadata)
            .filter((key) => !key.startsWith('Symbol('))
            .reduce(
              (acc, key) => {
                acc[key] = metadata[key]
                return acc
              },
              {} as Record<string, unknown>
            )

          // Si on a des métadonnées structurées, on les privilégie
          // Sinon on utilise les arguments du splat
          let formattedData = ''

          if (Object.keys(otherMetadata).length > 0) {
            // On a des métadonnées structurées, on les affiche
            formattedData = ` | ${JSON.stringify(otherMetadata)}`
          } else if (Array.isArray(splatArgs) && splatArgs.length > 0) {
            // On a seulement des arguments dans splat, on les affiche
            formattedData = ` : ${splatArgs
              .map((arg: unknown) =>
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
              )
              .join(' ')}`
          }

          return ` ${timestamp} [${level}]: ${message}${formattedData}`
        })
      ),
    }),
    // new winston.transports.File({
    //   filename: logFile,
    //   level: 'info',
    //   format: createFileFormat(),
    // }),
    // new winston.transports.File({
    //   filename: logErrorFile,
    //   level: 'error',
    //   format: createFileFormat(),
    // }),

    // new winston.transports.File({
    //   filename: logDebugFile,
    //   level: 'debug',
    //   format: createFileFormat(),
    // }),
  ],
})

// Wrapper pour console.log en développement (meilleur formatage)
const consoleLogger = {
  error: (message: string, ...args: unknown[]) => {
    console.error('❌', message, ...args)
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn('⚠️', message, ...args)
  },
  info: (message: string, ...args: unknown[]) => {
    console.info('ℹ️', message, ...args)
  },
  debug: (message: string, ...args: unknown[]) => {
    console.debug('🐛', message, ...args)
  },
  log: (message: string, ...args: unknown[]) => {
    console.log('📝', message, ...args)
  },
}
/*
 * Pendant le prerender du build, Winston horodate chaque log via `new Date()`.
 * Sous Cache Components c'est un accès à l'heure courante interdit au prerender
 * (blocking-prerender-current-time), et comme l'intercepteur de services logge à
 * chaque appel, ça ferait échouer toutes les pages prerendues. Ces logs sont de
 * toute façon du bruit de build : on les neutralise.
 */
// eslint-disable-next-line no-restricted-properties
const isBuildPrerender = process.env.NEXT_PHASE === 'phase-production-build'

const noopLogger = {
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
  log: () => {},
}

// Exporter le logger approprié selon l'environnement
export const logger = isBuildPrerender
  ? noopLogger
  : isConsole
    ? consoleLogger
    : winstonLogger
