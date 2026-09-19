import os from 'node:os'
import path from 'node:path'

import {env} from '@/env'

import {createBrevoTransport} from './brevo-transport'
import {EmailTransport, EmailTransportName} from './email-transport'
import {createFileTransport} from './file-transport'
import {createMemoryTransport} from './memory-transport'
import {createResendTransport} from './resend-transport'

export type EmailTransportConfig = {
  EMAIL_TRANSPORT?: EmailTransportName
  BREVO_API_KEY?: string
  RESEND_API_KEY?: string
  EMAIL_OUTBOX_DIR?: string
  NEXT_PUBLIC_NODE_ENV: 'development' | 'test' | 'production'
}

export const DEFAULT_EMAIL_OUTBOX_DIR = path.join(
  os.tmpdir(),
  'asl-cms-email-outbox'
)

const requireKey = (
  value: string | undefined,
  variable: string,
  transport: EmailTransportName
): string => {
  if (!value) {
    throw new Error(`${variable} est requise quand EMAIL_TRANSPORT=${transport}`)
  }
  return value
}

const transportNameOf = (config: EmailTransportConfig): EmailTransportName => {
  if (config.EMAIL_TRANSPORT) return config.EMAIL_TRANSPORT
  if (config.NEXT_PUBLIC_NODE_ENV === 'production') {
    throw new Error(
      'EMAIL_TRANSPORT doit etre declaree en production (brevo attendu)'
    )
  }
  return 'file'
}

/**
 * Le transport choisi par la configuration (ADR 005, ADR 017). La cle d'un
 * fournisseur n'est exigee que pour son propre transport.
 */
export const resolveEmailTransport = (
  config: EmailTransportConfig
): EmailTransport => {
  const name = transportNameOf(config)

  switch (name) {
    case 'brevo':
      return createBrevoTransport({
        apiKey: requireKey(config.BREVO_API_KEY, 'BREVO_API_KEY', name),
      })
    case 'resend':
      return createResendTransport({
        apiKey: requireKey(config.RESEND_API_KEY, 'RESEND_API_KEY', name),
      })
    case 'memory':
      return createMemoryTransport()
    case 'file':
      return createFileTransport(
        config.EMAIL_OUTBOX_DIR ?? DEFAULT_EMAIL_OUTBOX_DIR
      )
  }
}

let currentTransport: EmailTransport | undefined

/** Le transport de l'application, resolu une fois depuis `@/env`. */
export const getEmailTransport = (): EmailTransport => {
  currentTransport ??= resolveEmailTransport(env)
  return currentTransport
}
