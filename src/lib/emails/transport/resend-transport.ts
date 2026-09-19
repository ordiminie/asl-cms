import {Resend} from 'resend'

import {EmailTransport, EmailTransportError} from './email-transport'

type ResendTransportOptions = {apiKey: string}

/**
 * Transport de secours (ADR 017). **Seul fichier du produit a importer le SDK
 * `resend`** : aucun code metier n'appelle un fournisseur directement.
 */
export const createResendTransport = ({
  apiKey,
}: ResendTransportOptions): EmailTransport => {
  const resend = new Resend(apiKey)

  return {
    send: async (message) => {
      let result: Awaited<ReturnType<typeof resend.emails.send>>
      try {
        result = await resend.emails.send({
          from: message.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
        } as Parameters<typeof resend.emails.send>[0])
      } catch (error) {
        throw new EmailTransportError('resend', 'Resend injoignable', {
          cause: error,
        })
      }

      if (result.error) {
        throw new EmailTransportError(
          'resend',
          `Resend a refuse l'envoi (${result.error.name})`
        )
      }
    },
  }
}
