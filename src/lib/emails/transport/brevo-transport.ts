import {
  EmailMessage,
  EmailTransport,
  EmailTransportError,
  parseEmailAddress,
} from './email-transport'

export const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email'

type BrevoTransportOptions = {apiKey: string}

const toBrevoBody = (message: EmailMessage) => ({
  sender: parseEmailAddress(message.from),
  to: [{email: message.to}],
  subject: message.subject,
  ...(message.html ? {htmlContent: message.html} : {}),
  textContent: message.text,
})

/**
 * Transport de production (ADR 005) : l'API transactionnelle de Brevo, par
 * `fetch`, sans SDK. La cle n'est jamais journalisee ni reprise dans l'erreur.
 */
export const createBrevoTransport = ({
  apiKey,
}: BrevoTransportOptions): EmailTransport => ({
  send: async (message) => {
    let response: Response
    try {
      response = await fetch(BREVO_SEND_URL, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(toBrevoBody(message)),
      })
    } catch (error) {
      throw new EmailTransportError('brevo', 'Brevo injoignable', {
        cause: error,
      })
    }

    if (!response.ok) {
      throw new EmailTransportError(
        'brevo',
        `Brevo a refuse l'envoi (HTTP ${response.status})`
      )
    }
  },
})
