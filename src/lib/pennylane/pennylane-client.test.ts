import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {
  createPennylaneClient,
  PENNYLANE_API_BASE_URL,
  PennylaneError,
} from './pennylane-client'
import {
  pennylaneCustomerSchema,
  pennylaneInvoiceSchema,
} from './pennylane-schemas'

/**
 * Client HTTP Pennylane (s20, ADR 062 §9). Aucun appel reseau : `fetch` est
 * double. Les reponses imitent la forme relevee sur l'API v2 (noms de champs
 * seulement, aucune donnee reelle).
 */

const BASE = 'https://pennylane.test/api/external/v2'
const PAYMENT_FIELD = /iban|mandate|card|bic|rum/i

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: {'content-type': 'application/json'},
    ...init,
  })

const rawCustomer = (overrides: Record<string, unknown> = {}) => ({
  id: 4211,
  name: 'LEFEVRE Bernard',
  reference: 'AH 6 - 0045821',
  external_reference: '3f2a9c1e-1111-4111-8111-111111111111',
  customer_type: 'individual',
  emails: ['membre@exemple.test'],
  billing_iban: 'FR7612345678901234567890123',
  billing_bic: 'ABCDFRPP',
  mandates: [{id: 1, rum: 'RUM-0001', status: 'active'}],
  pro_account_mandates: [{id: 2}],
  payment_conditions: '30_days',
  card: {last4: '4242'},
  ...overrides,
})

const rawInvoice = (overrides: Record<string, unknown> = {}) => ({
  id: 9001,
  invoice_number: 'F-2026-0412',
  status: 'late',
  paid: false,
  draft: false,
  date: '2026-03-15',
  deadline: '2026-04-15',
  amount: '412.50',
  currency: 'EUR',
  customer: {id: 4211, url: 'https://pennylane.test/customers/4211'},
  public_file_url: 'https://pennylane.test/public/invoice/pdf?token=secret',
  pdf_invoice_free_text:
    'Numero parcelle : AH 6 - Compteur : 0045821 - Index : 120',
  remaining_amount_with_tax: '412.50',
  credited_invoice: null,
  bank_account: {iban: 'FR7612345678901234567890123'},
  payment_mandate: {rum: 'RUM-0001'},
  ...overrides,
})

const page = (items: unknown[], nextCursor: string | null = null) =>
  json({items, has_more: nextCursor !== null, next_cursor: nextCursor})

describe('createPennylaneClient — client HTTP en lecture seule (s20, ADR 062 §9)', () => {
  const fetchMock = vi.fn()
  const sleep = vi.fn(async (ms: number) => {
    expect(ms).toBeGreaterThan(0)
  })
  const client = (apiKey: string | undefined = 'jeton-test') =>
    createPennylaneClient({apiKey, baseUrl: BASE, sleep})

  beforeEach(() => {
    fetchMock.mockReset()
    sleep.mockClear()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('vise l’API v2 de Pennylane par défaut', () => {
    expect(PENNYLANE_API_BASE_URL).toBe(
      'https://app.pennylane.com/api/external/v2'
    )
  })

  it('lit les clients en GET, porteur du jeton et de l’en-tête 2026, avec un délai d’attente', async () => {
    fetchMock.mockResolvedValue(page([rawCustomer()]))

    await client().listCustomers()

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${BASE}/customers?limit=100`)
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
    expect(init.headers).toEqual({
      authorization: 'Bearer jeton-test',
      accept: 'application/json',
      'X-Use-2026-API-Changes': 'true',
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('suit `next_cursor` jusqu’à la dernière page', async () => {
    fetchMock
      .mockResolvedValueOnce(page([rawCustomer({id: 1})], 'curseur-2'))
      .mockResolvedValueOnce(page([rawCustomer({id: 2})], 'curseur-3'))
      .mockResolvedValueOnce(page([rawCustomer({id: 3})]))

    const customers = await client().listCustomers()

    expect(customers.map((customer) => customer.id)).toEqual(['1', '2', '3'])
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${BASE}/customers?limit=100`,
      `${BASE}/customers?limit=100&cursor=curseur-2`,
      `${BASE}/customers?limit=100&cursor=curseur-3`,
    ])
  })

  it('réduit un client à la liste blanche : identifiant, référence externe, nom, référence', async () => {
    fetchMock.mockResolvedValue(page([rawCustomer()]))

    const [customer] = await client().listCustomers()

    expect(customer).toEqual({
      id: '4211',
      externalReference: '3f2a9c1e-1111-4111-8111-111111111111',
      name: 'LEFEVRE Bernard',
      reference: 'AH 6 - 0045821',
    })
  })

  it('un client sans référence externe ni référence : nuls, jamais une chaîne vide', async () => {
    fetchMock.mockResolvedValue(
      page([rawCustomer({external_reference: '', reference: null})])
    )

    const [customer] = await client().listCustomers()

    expect(customer.externalReference).toBeNull()
    expect(customer.reference).toBeNull()
  })

  it('lit les factures, réduites à la liste blanche', async () => {
    fetchMock.mockResolvedValue(page([rawInvoice()]))

    const [invoice] = await client().listCustomerInvoices()

    expect(fetchMock.mock.calls[0][0]).toBe(
      `${BASE}/customer_invoices?limit=100`
    )
    expect(invoice).toEqual({
      id: '9001',
      invoiceNumber: 'F-2026-0412',
      status: 'late',
      draft: false,
      date: '2026-03-15',
      deadline: '2026-04-15',
      amount: '412.50',
      currency: 'EUR',
      customerId: '4211',
      hasPdf: true,
      freeText: 'Numero parcelle : AH 6 - Compteur : 0045821 - Index : 120',
    })
  })

  it('une facture sans client, sans date, sans PDF ni texte libre : nuls, jamais devinés', async () => {
    fetchMock.mockResolvedValue(
      page([
        rawInvoice({
          customer: null,
          date: null,
          deadline: null,
          public_file_url: null,
          pdf_invoice_free_text: '',
        }),
      ])
    )

    const [invoice] = await client().listCustomerInvoices()

    expect(invoice).toMatchObject({
      customerId: null,
      date: null,
      deadline: null,
      hasPdf: false,
      freeText: null,
    })
  })

  it('relit l’adresse du PDF d’une facture à la demande, sans la garder', async () => {
    fetchMock.mockResolvedValue(json(rawInvoice()))

    const url = await client().getCustomerInvoiceFileUrl('9001')

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/customer_invoices/9001`)
    expect(fetchMock.mock.calls[0][1].method).toBe('GET')
    expect(url).toBe('https://pennylane.test/public/invoice/pdf?token=secret')
  })

  it('PDF absent ou facture disparue : rien, jamais un lien mort', async () => {
    fetchMock.mockResolvedValueOnce(json(rawInvoice({public_file_url: null})))
    fetchMock.mockResolvedValueOnce(json({error: 'not found'}, {status: 404}))

    expect(await client().getCustomerInvoiceFileUrl('9001')).toBeNull()
    expect(await client().getCustomerInvoiceFileUrl('9002')).toBeNull()
  })

  describe('adresse du PDF : https seulement (revue m4)', () => {
    const NOT_HTTPS = [
      ['http', 'http://pennylane.test/public/invoice/pdf?token=secret'],
      ['javascript', 'javascript:alert(1)'],
      ['data', 'data:application/pdf;base64,JVBERi0='],
      ['relative', '/public/invoice/pdf'],
      ['illisible', 'pas une adresse'],
    ]

    it.each(NOT_HTTPS)(
      'le schéma réduit une adresse %s à « aucun PDF »',
      (_label, url) => {
        const parsed = pennylaneInvoiceSchema.parse(
          rawInvoice({public_file_url: url})
        )
        expect(parsed.public_file_url).toBeNull()
      }
    )

    it('le schéma garde une adresse https', () => {
      const parsed = pennylaneInvoiceSchema.parse(rawInvoice())
      expect(parsed.public_file_url).toBe(
        'https://pennylane.test/public/invoice/pdf?token=secret'
      )
    })

    it.each(NOT_HTTPS)(
      'une facture listée avec une adresse %s : sans PDF, la relecture n’échoue pas',
      async (_label, url) => {
        fetchMock.mockResolvedValue(
          page([rawInvoice({public_file_url: url}), rawInvoice({id: 9002})])
        )

        const invoices = await client().listCustomerInvoices()

        expect(invoices.map((invoice) => invoice.hasPdf)).toEqual([false, true])
      }
    )

    it.each(NOT_HTTPS)(
      'relue au clic, une adresse %s : rien, jamais levée ni ouverte',
      async (_label, url) => {
        fetchMock.mockResolvedValue(json(rawInvoice({public_file_url: url})))

        expect(await client().getCustomerInvoiceFileUrl('9001')).toBeNull()
      }
    )
  })

  it('encode l’identifiant d’une facture dans le chemin', async () => {
    fetchMock.mockResolvedValue(json(rawInvoice()))

    await client().getCustomerInvoiceFileUrl('9001/../me')

    expect(fetchMock.mock.calls[0][0]).toBe(
      `${BASE}/customer_invoices/9001%2F..%2Fme`
    )
  })

  describe('échecs typés', () => {
    const codeOf = async (promise: Promise<unknown>) => {
      try {
        await promise
      } catch (error) {
        expect(error).toBeInstanceOf(PennylaneError)
        return (error as PennylaneError).code
      }
      throw new Error('aucun échec')
    }

    it('clé absente : `missing_key`, aucun appel', async () => {
      const withoutKey = (apiKey: string | undefined) =>
        createPennylaneClient({apiKey, baseUrl: BASE, sleep})

      expect(await codeOf(withoutKey(undefined).listCustomers())).toBe(
        'missing_key'
      )
      expect(await codeOf(withoutKey('').listCustomerInvoices())).toBe(
        'missing_key'
      )
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('401 et 403 : `unauthorized`', async () => {
      fetchMock.mockResolvedValueOnce(json({}, {status: 401}))
      fetchMock.mockResolvedValueOnce(json({}, {status: 403}))

      expect(await codeOf(client().listCustomers())).toBe('unauthorized')
      expect(await codeOf(client().listCustomers())).toBe('unauthorized')
    })

    it('429 : attend `retry-after` puis reprend la même page', async () => {
      fetchMock
        .mockResolvedValueOnce(
          json({}, {status: 429, headers: {'retry-after': '2'}})
        )
        .mockResolvedValueOnce(page([rawCustomer()]))

      const customers = await client().listCustomers()

      expect(customers).toHaveLength(1)
      expect(sleep).toHaveBeenCalledWith(2000)
      expect(fetchMock.mock.calls[1][0]).toBe(`${BASE}/customers?limit=100`)
    })

    it('429 : l’attente est bornée', async () => {
      fetchMock
        .mockResolvedValueOnce(
          json({}, {status: 429, headers: {'retry-after': '3600'}})
        )
        .mockResolvedValueOnce(page([]))

      await client().listCustomers()

      expect(sleep).toHaveBeenCalledWith(10_000)
    })

    it('429 répété : `rate_limited` après les reprises permises', async () => {
      fetchMock.mockResolvedValue(
        json({}, {status: 429, headers: {'retry-after': '1'}})
      )

      expect(await codeOf(client().listCustomers())).toBe('rate_limited')
      expect(fetchMock).toHaveBeenCalledTimes(4)
    })

    it('réseau coupé, délai dépassé, erreur serveur, réponse illisible : `unavailable`', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
      fetchMock.mockRejectedValueOnce(
        new DOMException('The operation timed out.', 'TimeoutError')
      )
      fetchMock.mockResolvedValueOnce(json({}, {status: 503}))
      fetchMock.mockResolvedValueOnce(new Response('<html>', {status: 200}))
      fetchMock.mockResolvedValueOnce(
        json({items: [{name: 'sans identifiant'}]})
      )

      for (let attempt = 0; attempt < 5; attempt += 1) {
        expect(await codeOf(client().listCustomers())).toBe('unavailable')
      }
    })

    it('l’erreur ne porte jamais le jeton', async () => {
      fetchMock.mockResolvedValue(json({}, {status: 401}))

      const error = await client()
        .listCustomers()
        .catch((caught: unknown) => caught as Error)

      expect(String(error)).not.toContain('jeton-test')
      expect(JSON.stringify(error)).not.toContain('jeton-test')
    })
  })

  it('n’envoie que des GET, quel que soit l’appel', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/customer_invoices/')
        ? json(rawInvoice())
        : page(url.includes('customers') ? [rawCustomer()] : [rawInvoice()])
    )

    await client().listCustomers()
    await client().listCustomerInvoices()
    await client().getCustomerInvoiceFileUrl('9001')

    expect(
      fetchMock.mock.calls.map(([, init]) => (init as RequestInit).method)
    ).toEqual(['GET', 'GET', 'GET'])
  })
})

describe('forme des données échangées — aucun moyen de paiement (critère 10)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const keysOf = (value: unknown): string[] =>
    value && typeof value === 'object'
      ? Object.entries(value).flatMap(([key, child]) => [key, ...keysOf(child)])
      : []

  it('les schémas ne lisent aucun champ de carte, d’IBAN, de BIC, de mandat ni de RUM', () => {
    const fields = [
      ...Object.keys(pennylaneCustomerSchema.shape),
      ...Object.keys(pennylaneInvoiceSchema.shape),
      ...Object.keys(
        pennylaneInvoiceSchema.shape.customer.unwrap().unwrap().shape
      ),
    ]

    expect(fields.filter((field) => PAYMENT_FIELD.test(field))).toEqual([])
  })

  it('les sorties du module n’en portent ni le nom, ni la valeur', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      page(url.includes('/customers') ? [rawCustomer()] : [rawInvoice()])
    )

    const client = createPennylaneClient({apiKey: 'jeton', baseUrl: BASE})
    const outputs = [
      ...(await client.listCustomers()),
      ...(await client.listCustomerInvoices()),
    ]

    expect(keysOf(outputs).filter((key) => PAYMENT_FIELD.test(key))).toEqual([])
    const serialized = JSON.stringify(outputs)
    expect(serialized).not.toContain('FR7612345678901234567890123')
    expect(serialized).not.toContain('ABCDFRPP')
    expect(serialized).not.toContain('RUM-0001')
    expect(serialized).not.toContain('4242')
    expect(serialized).not.toContain('public/invoice/pdf')
  })
})
