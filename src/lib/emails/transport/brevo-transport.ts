import {
  EmailMessage,
  EmailTransport,
  EmailTransportError,
  parseEmailAddress,
  TagStatisticsQuery,
  TagStatisticsResult,
} from './email-transport'

export const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email'
export const BREVO_AGGREGATED_REPORT_URL =
  'https://api.brevo.com/v3/smtp/statistics/aggregatedReport'
/** Delai maximal d'une lecture de statistiques : la carte ne reste pas suspendue. */
export const BREVO_STATISTICS_TIMEOUT_MS = 8000

type BrevoTransportOptions = {apiKey: string}

const toBrevoBody = (message: EmailMessage) => ({
  sender: parseEmailAddress(message.from),
  to: [{email: message.to}],
  subject: message.subject,
  ...(message.html ? {htmlContent: message.html} : {}),
  textContent: message.text,
  ...(message.headers ? {headers: message.headers} : {}),
  ...(message.replyTo ? {replyTo: {email: message.replyTo}} : {}),
  ...(message.tags && message.tags.length > 0 ? {tags: message.tags} : {}),
})

const aggregatedReportUrlOf = (query: TagStatisticsQuery): string =>
  `${BREVO_AGGREGATED_REPORT_URL}?${new URLSearchParams({
    tag: query.tag,
    startDate: query.startDate,
    endDate: query.endDate,
  }).toString()}`

/** Un compteur de l'agregat ; un champ absent (tous sont optionnels) vaut 0. */
const counterOf = (report: Record<string, unknown>, field: string): number => {
  const value = report[field]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * L'agregat d'un tag (ADR 068 §2) : `GET aggregatedReport`, delai borne. Ni
 * la cle ni la reponse brute ne passent dans une erreur.
 */
const readBrevoTagStatistics = async (
  apiKey: string,
  query: TagStatisticsQuery
): Promise<TagStatisticsResult> => {
  let response: Response
  try {
    response = await fetch(aggregatedReportUrlOf(query), {
      method: 'GET',
      headers: {'api-key': apiKey, accept: 'application/json'},
      signal: AbortSignal.timeout(BREVO_STATISTICS_TIMEOUT_MS),
    })
  } catch (error) {
    throw new EmailTransportError('brevo', 'Brevo injoignable', {
      cause: error,
    })
  }

  if (!response.ok) {
    throw new EmailTransportError(
      'brevo',
      `Brevo a refuse la lecture des statistiques (HTTP ${response.status})`,
      {refused: true}
    )
  }

  let report: Record<string, unknown>
  try {
    report = (await response.json()) as Record<string, unknown>
  } catch (error) {
    throw new EmailTransportError('brevo', 'Statistiques Brevo illisibles', {
      cause: error,
    })
  }
  return {
    status: 'found',
    requests: counterOf(report, 'requests'),
    delivered: counterOf(report, 'delivered'),
    uniqueOpens: counterOf(report, 'uniqueOpens'),
    uniqueClicks: counterOf(report, 'uniqueClicks'),
  }
}

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
        `Brevo a refuse l'envoi (HTTP ${response.status})`,
        {refused: true}
      )
    }
  },
  readTagStatistics: (query) => readBrevoTagStatistics(apiKey, query),
})
