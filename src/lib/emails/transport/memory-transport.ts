import {
  EmailMessage,
  EmailTransport,
  TagStatisticsQuery,
  TagStatisticsResult,
} from './email-transport'

export type MemoryEmailTransport = EmailTransport & {
  readonly messages: EmailMessage[]
  /** Les requetes de statistiques recues, dans l'ordre (s30). */
  readonly statisticsQueries: TagStatisticsQuery[]
  /** Amorce la reponse de `readTagStatistics` (s30, ADR 068). */
  setTagStatistics: (result: TagStatisticsResult) => void
}

/**
 * Transport des tests unitaires : garde les messages, n'envoie rien. Sans
 * amorce, il ne sait pas lire de statistiques.
 */
export const createMemoryTransport = (): MemoryEmailTransport => {
  const messages: EmailMessage[] = []
  const statisticsQueries: TagStatisticsQuery[] = []
  let statistics: TagStatisticsResult = {status: 'unsupported'}

  return {
    messages,
    statisticsQueries,
    send: async (message) => {
      messages.push(message)
    },
    setTagStatistics: (result) => {
      statistics = result
    },
    readTagStatistics: async (query) => {
      statisticsQueries.push(query)
      return statistics
    },
  }
}
