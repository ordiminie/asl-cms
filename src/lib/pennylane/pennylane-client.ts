import {z} from 'zod'

import {
  type PennylaneCustomer,
  pennylaneCustomerSchema,
  type PennylaneInvoice,
  pennylaneInvoiceSchema,
  pennylanePageSchema,
  toPennylaneCustomer,
  toPennylaneInvoice,
} from './pennylane-schemas'

/**
 * Client HTTP de l'API Pennylane v2 (s20, ADR 062 §9), fonctionnel, sans
 * SDK : `GET` seulement, jeton porteur, en-tete des changements 2026, delai
 * d'attente, pagination par `next_cursor`, 429 → attente `retry-after`
 * bornee puis echec. Chaque reponse est reduite par un schema a liste
 * blanche. Rien n'est journalise ici : ni le jeton, ni une adresse de PDF.
 */

export const PENNYLANE_API_BASE_URL =
  'https://app.pennylane.com/api/external/v2'

/** Elements par page : le maximum de l'API. */
const PAGE_SIZE = 100
/** Delai d'attente d'une requete. */
const REQUEST_TIMEOUT_MS = 15_000
/** Reprises apres un 429 sur une meme requete. */
const MAX_RATE_LIMIT_RETRIES = 3
/** Attente maximale demandee par `retry-after`. */
const MAX_RETRY_AFTER_MS = 10_000
const MS_PER_SECOND = 1000

export const PENNYLANE_ERROR_CODES = [
  'missing_key',
  'unauthorized',
  'unavailable',
  'rate_limited',
] as const

export type PennylaneErrorCode = (typeof PENNYLANE_ERROR_CODES)[number]

/** Echec type d'un appel ; le message ne porte jamais le jeton. */
export class PennylaneError extends Error {
  readonly code: PennylaneErrorCode

  constructor(code: PennylaneErrorCode, options?: {cause?: unknown}) {
    super(`Pennylane : ${code}`, options)
    this.name = 'PennylaneError'
    this.code = code
  }
}

export type PennylaneClientOptions = {
  apiKey: string | undefined
  baseUrl?: string
  /** Attente injectable : les tests ne dorment pas. */
  sleep?: (ms: number) => Promise<void>
}

export type PennylaneClient = {
  listCustomers: () => Promise<PennylaneCustomer[]>
  listCustomerInvoices: () => Promise<PennylaneInvoice[]>
  /** L'adresse du PDF, relue a la demande ; rien si absente. Jamais gardee. */
  getCustomerInvoiceFileUrl: (invoiceId: string) => Promise<string | null>
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

const retryAfterMsOf = (response: Response): number => {
  const seconds = Number(response.headers.get('retry-after'))
  const ms =
    Number.isFinite(seconds) && seconds > 0
      ? seconds * MS_PER_SECOND
      : MS_PER_SECOND
  return Math.min(ms, MAX_RETRY_AFTER_MS)
}

const isUnauthorized = (status: number) => status === 401 || status === 403
const NOT_FOUND = 404
const TOO_MANY_REQUESTS = 429

export const createPennylaneClient = ({
  apiKey,
  baseUrl = PENNYLANE_API_BASE_URL,
  sleep = defaultSleep,
}: PennylaneClientOptions): PennylaneClient => {
  const requireKey = (): string => {
    if (!apiKey) throw new PennylaneError('missing_key')
    return apiKey
  }

  const send = async (url: string, key: string): Promise<Response> => {
    try {
      return await fetch(url, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${key}`,
          accept: 'application/json',
          'X-Use-2026-API-Changes': 'true',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch (error) {
      throw new PennylaneError('unavailable', {cause: error})
    }
  }

  /** Une requete, reprise apres un 429 ; `undefined` sur un 404. */
  const getJson = async (path: string): Promise<unknown> => {
    const key = requireKey()
    const url = `${baseUrl}${path}`
    for (let attempt = 0; ; attempt += 1) {
      const response = await send(url, key)
      if (response.status === TOO_MANY_REQUESTS) {
        if (attempt >= MAX_RATE_LIMIT_RETRIES) {
          throw new PennylaneError('rate_limited')
        }
        await sleep(retryAfterMsOf(response))
        continue
      }
      if (isUnauthorized(response.status)) {
        throw new PennylaneError('unauthorized')
      }
      if (response.status === NOT_FOUND) return undefined
      if (!response.ok) throw new PennylaneError('unavailable')
      try {
        return await response.json()
      } catch (error) {
        throw new PennylaneError('unavailable', {cause: error})
      }
    }
  }

  const parseOrUnavailable = <T>(schema: z.ZodType<T>, value: unknown): T => {
    const parsed = schema.safeParse(value)
    if (!parsed.success) {
      throw new PennylaneError('unavailable', {cause: parsed.error})
    }
    return parsed.data
  }

  const listAll = async <Raw, Item>(
    resource: string,
    itemSchema: z.ZodType<Raw>,
    toItem: (raw: Raw) => Item
  ): Promise<Item[]> => {
    const items: Item[] = []
    let cursor: string | null | undefined = null
    do {
      const query = new URLSearchParams({limit: String(PAGE_SIZE)})
      if (cursor) query.set('cursor', cursor)
      const body = await getJson(`/${resource}?${query.toString()}`)
      const pageOf = parseOrUnavailable(pennylanePageSchema, body)
      for (const raw of pageOf.items) {
        items.push(toItem(parseOrUnavailable(itemSchema, raw)))
      }
      cursor = pageOf.next_cursor
    } while (cursor)
    return items
  }

  return {
    listCustomers: () =>
      listAll('customers', pennylaneCustomerSchema, toPennylaneCustomer),
    listCustomerInvoices: () =>
      listAll('customer_invoices', pennylaneInvoiceSchema, toPennylaneInvoice),
    getCustomerInvoiceFileUrl: async (invoiceId) => {
      const body = await getJson(
        `/customer_invoices/${encodeURIComponent(invoiceId)}`
      )
      if (body === undefined) return null
      const file = parseOrUnavailable(
        pennylaneInvoiceSchema.pick({public_file_url: true}),
        body
      )
      return file.public_file_url
    },
  }
}

export type {PennylaneCustomer, PennylaneInvoice}
