import {EmailMessage, EmailTransport} from './email-transport'

export type MemoryEmailTransport = EmailTransport & {
  readonly messages: EmailMessage[]
}

/** Transport des tests unitaires : garde les messages, n'envoie rien. */
export const createMemoryTransport = (): MemoryEmailTransport => {
  const messages: EmailMessage[] = []

  return {
    messages,
    send: async (message) => {
      messages.push(message)
    },
  }
}
