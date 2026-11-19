/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

import {Browser, expect, Page, Request, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Factures Pennylane — s20, ADR 062. **Jamais la vraie API** : la spec sert
 * elle-même un faux Pennylane local, à la base que l'application lit dans
 * `PENNYLANE_API_BASE_URL` (CI : `http://127.0.0.1:4010/api/external/v2`,
 * clé factice). Sans cette variable, la spec est sautée.
 *
 * Parcours : le SuperAdmin passe TechCorp à Pennylane ; la présidente règle
 * un libellé, relie une fiche à son client Pennylane et lance « Mettre à jour
 * maintenant » ; le membre lit ses factures avec libellé, PDF disponible ou
 * non, et ouvre le PDF ; une fiche sans identifiant voit le message et
 * figure dans la liste du bureau ; le bureau ne saisit plus. Isolation :
 * l'état de synchronisation et le PDF d'une association sont introuvables
 * depuis l'autre.
 *
 * `localhost` sert TechCorp Solutions, `127.0.0.1` Marketing Pro (seed).
 * Tout ce qui est changé est remis au seed en fin de spec.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
const TENANT_A = `http://localhost:${PORT}`
const TENANT_B = `http://127.0.0.1:${PORT}`
const SETTINGS_PAGE = '/bureau/reglages'
const SETTINGS_TITLE = "Réglages de l'association"
const SAVED =
  'Réglages enregistrés. Les prochains messages partiront vers ces adresses.'

const PASSWORD = 'Azerty123'
const SUPER_ADMIN = 'superadmin@gmail.com'
/** Présidente de TechCorp Solutions. */
const OWNER_A = 'user-owner@gmail.com'

/** Première fiche de Bernard Lefèvre : parcelle 61 depuis 1998. */
const LEFEVRE = {
  email: 'bernard.lefevre@example.test',
  profileId: 'a1200000-0000-4000-8000-000000000008',
  name: 'Bernard Lefèvre',
}
/** Fiche sans identifiant client Pennylane, avec un compte. */
const MOREAU = {
  email: 'lucie.moreau@example.test',
  profileId: 'a1200000-0000-4000-8000-000000000006',
}
/** Membre de Marketing Pro. */
const SCI_PINS_EMAIL = 'contact@sci-les-pins.test'

const API_BASE = process.env.PENNYLANE_API_BASE_URL
const API_KEY = process.env.PENNYLANE_API_KEY ?? 'pennylane_factice_ci'
const FAKE_ORIGIN = API_BASE ? new URL(API_BASE).origin : ''
const FAKE_PORT = API_BASE ? Number(new URL(API_BASE).port) : 0
const FAKE_API_PATH = API_BASE ? new URL(API_BASE).pathname : ''

/** L'« Identifiant Client » que porte la fiche : l'`external_reference`. */
const EXTERNAL_REF = '3f2a9c1e-e2e0-4000-8000-00000000f061'
const FAKE_PDF_PATH = '/public/invoice/pdf'
const STATUS_LABELS = 'late = En retard'

/** Les clients et factures du faux Pennylane, formes de l'API v2. */
const CUSTOMERS = [
  {
    id: 990061,
    name: 'LEFEVRE Bernard',
    reference: '61 - 0061',
    external_reference: EXTERNAL_REF,
    billing_iban: 'FR7600000000000000000000000',
    mandates: [{rum: 'RUM-E2E'}],
  },
  {
    id: 990099,
    name: 'FICTIF Client',
    reference: '99 - 0099',
    external_reference: '00000000-e2e0-4000-8000-000000000099',
  },
]
const invoice = (overrides: {id: number} & Record<string, unknown>) => ({
  invoice_number: null,
  status: 'paid',
  draft: false,
  date: '2026-03-15',
  deadline: '2026-04-15',
  amount: '250.00',
  currency: 'EUR',
  customer: {id: 990061},
  public_file_url: null,
  pdf_invoice_free_text: '',
  ...overrides,
})
const INVOICES = [
  invoice({
    id: 880001,
    invoice_number: 'F-E2E-0001',
    status: 'late',
    public_file_url: `${FAKE_ORIGIN}${FAKE_PDF_PATH}?e2e=1`,
    pdf_invoice_free_text: 'Numero parcelle : 61 - Compteur : 0061 - Index : 1',
  }),
  invoice({id: 880002, date: '2025-03-15', deadline: '2025-04-15'}),
  invoice({id: 880003, draft: true}),
  invoice({id: 880004, customer: {id: 990099}}),
]
const PENNYLANE_STATUSES = ['late', 'paid']

const fakePennylane = http.createServer((request, response) => {
  const url = new URL(request.url ?? '/', FAKE_ORIGIN)
  if (url.pathname === FAKE_PDF_PATH) {
    response.writeHead(200, {'content-type': 'application/pdf'})
    response.end('%PDF-1.4\n%e2e\n')
    return
  }
  if (
    request.method !== 'GET' ||
    request.headers.authorization !== `Bearer ${API_KEY}`
  ) {
    response.writeHead(401).end()
    return
  }
  const json = (body: unknown) => {
    response.writeHead(200, {'content-type': 'application/json'})
    response.end(JSON.stringify(body))
  }
  const resource = url.pathname.slice(FAKE_API_PATH.length)
  if (resource === '/customers') {
    json({items: CUSTOMERS, has_more: false, next_cursor: null})
  } else if (resource === '/customer_invoices') {
    json({items: INVOICES, has_more: false, next_cursor: null})
  } else if (resource.startsWith('/customer_invoices/')) {
    const found = INVOICES.find(
      (candidate) => `/customer_invoices/${candidate.id}` === resource
    )
    if (found) json(found)
    else response.writeHead(404).end()
  } else {
    response.writeHead(404).end()
  }
})

const databaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const testEnvPath = path.resolve(process.cwd(), '.env.test')
  const parsed = fs.existsSync(testEnvPath)
    ? dotenv.parse(fs.readFileSync(testEnvPath))
    : {}
  if (!parsed.DATABASE_URL) {
    throw new Error('DATABASE_URL introuvable pour les préparations SQL.')
  }
  return parsed.DATABASE_URL
}

const withAppRoleClient = async <T>(
  callback: (client: Client) => Promise<T>
): Promise<T> => {
  const client = new Client({connectionString: databaseUrl()})
  await client.connect()
  try {
    return await callback(client)
  } finally {
    await client.end()
  }
}

/** Préparation et nettoyage hors scope : le seul `bypass` de la spec. */
const asMaintenance = <T>(callback: (client: Client) => Promise<T>) =>
  withAppRoleClient(async (client) => {
    await client.query('begin')
    try {
      await client.query(`select set_config('app.bypass_rls', 'on', true)`)
      const result = await callback(client)
      await client.query('commit')
      return result
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  })

/** Une lecture sous le tenant donné, soumise à la RLS forcée. */
const asTenant = <T>(
  organizationId: string,
  callback: (client: Client) => Promise<T>
) =>
  withAppRoleClient(async (client) => {
    await client.query('begin')
    try {
      await client.query(`select set_config('app.organization_id', $1, true)`, [
        organizationId,
      ])
      return await callback(client)
    } finally {
      await client.query('rollback')
    }
  })

const organizationIdOf = (slug: string) =>
  asMaintenance(async (client) => {
    const {rows} = await client.query<{id: string}>(
      'select id from organization where slug = $1',
      [slug]
    )
    return rows[0].id
  })

/** Les factures Pennylane du seed de TechCorp, remises telles quelles à la fin. */
let seededPennylaneInvoices = '[]'

const snapshotSeed = (organizationId: string) =>
  asMaintenance(async (client) => {
    const {rows} = await client.query<{rows: unknown}>(
      `select coalesce(json_agg(mi), '[]'::json) as rows
         from member_invoice mi
        where mi.organization_id = $1 and mi.source = 'pennylane'`,
      [organizationId]
    )
    seededPennylaneInvoices = JSON.stringify(rows[0].rows)
  })

/** Remet la base au seed : factures, état, tâches, signalements, fiche. */
const restoreSeedRows = (organizationId: string) =>
  asMaintenance(async (client) => {
    await client.query(
      `delete from member_invoice where organization_id = $1 and source = 'pennylane'`,
      [organizationId]
    )
    await client.query(
      `insert into member_invoice
         select * from json_populate_recordset(null::member_invoice, $1::json)`,
      [seededPennylaneInvoices]
    )
    await client.query(
      'delete from billing_sync_state where organization_id = $1',
      [organizationId]
    )
    await client.query(
      `delete from scheduled_job where organization_id = $1 and kind = 'billing.sync_pennylane'`,
      [organizationId]
    )
    await client.query(
      `delete from invoice_status_alert where organization_id = $1 and status = any($2)`,
      [organizationId, PENNYLANE_STATUSES]
    )
    await client.query(
      'update member_profile set pennylane_customer_id = null where id = $1',
      [LEFEVRE.profileId]
    )
  })

const resetRateLimits = () =>
  asMaintenance((client) =>
    client.query(
      `delete from rate_limit_event
        where organization_id in (select id from organization where slug = any($1))`,
      [['techcorp-solutions', 'marketing-pro']]
    )
  )

const login = async (page: Page, base: string, email: string) => {
  await page.goto(`${base}/login/prestataire`)
  await expect(page.locator('form')).toBeVisible()
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.toString().includes('/login'), {
    timeout: 15_000,
  })
}

const newSession = async (browser: Browser, base: string, email: string) => {
  const context = await browser.newContext({locale: 'fr-FR'})
  await context.addCookies([{name: 'NEXT_LOCALE', value: 'fr', url: base}])
  const page = await context.newPage()
  await login(page, base, email)
  return page
}

type OutboxMessage = {to: string; text: string}

const outboxDir = () =>
  process.env.EMAIL_OUTBOX_DIR ?? path.join(os.tmpdir(), 'asl-cms-email-outbox')

const outboxFiles = (): Set<string> => {
  const dir = outboxDir()
  return new Set(
    fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((file) => file.endsWith('.json'))
      : []
  )
}

const messagesTo = (before: Set<string>, to: string): OutboxMessage[] =>
  [...outboxFiles()]
    .filter((file) => !before.has(file))
    .map(
      (file) =>
        JSON.parse(
          fs.readFileSync(path.join(outboxDir(), file), 'utf8')
        ) as OutboxMessage
    )
    .filter((message) => message.to === to)

const VISITOR_RUN = Date.now().toString(16).slice(-4)
let visitorCount = 0
const nextVisitorIp = () =>
  `2001:db8:520:${VISITOR_RUN}::${(++visitorCount).toString(16)}`

/** Un membre, connecté par le lien reçu, arrivé sur son espace. */
const newMemberSession = async (
  browser: Browser,
  base: string,
  email: string
) => {
  const context = await browser.newContext({
    locale: 'fr-FR',
    extraHTTPHeaders: {'x-forwarded-for': nextVisitorIp()},
  })
  await context.addCookies([{name: 'NEXT_LOCALE', value: 'fr', url: base}])
  const page = await context.newPage()
  const before = outboxFiles()
  await page.goto(`${base}/login`, {waitUntil: 'networkidle'})
  const address = page.getByLabel('Adresse email')
  await address.fill(email)
  await expect(address).toHaveValue(email)
  await page
    .getByRole('button', {name: 'Recevoir mon lien de connexion'})
    .click()
  await expect
    .poll(() => messagesTo(before, email).length, {timeout: 15_000})
    .toBe(1)
  const link = messagesTo(before, email)[0].text.match(
    /https?:\/\/\S+\/magic-link\/verify\?\S+/
  )?.[0]
  expect(link).toBeTruthy()
  await page.goto(link as string)
  await expect(page).toHaveURL(`${base}/dashboard`, {timeout: 15_000})
  return page
}

const openSettings = async (page: Page, base: string) => {
  await page.goto(`${base}${SETTINGS_PAGE}`, {waitUntil: 'load'})
  await expect(
    page.getByRole('heading', {level: 1, name: SETTINGS_TITLE})
  ).toBeVisible({timeout: 15_000})
}

const saveSettings = async (page: Page) => {
  await page.getByRole('button', {name: 'Enregistrer les réglages'}).click()
  await expect(page.getByText(SAVED)).toBeVisible({timeout: 15_000})
}

/** Le fournisseur des factures, changé par l'application (cache invalidé). */
const chooseProvider = async (browser: Browser, label: string) => {
  const page = await newSession(browser, TENANT_A, SUPER_ADMIN)
  try {
    await openSettings(page, TENANT_A)
    await page
      .getByRole('radiogroup', {name: /Source des factures/})
      .getByRole('radio', {name: label, exact: true})
      .click()
    await saveSettings(page)
  } finally {
    await page.context().close()
  }
}

const setStatusLabels = async (browser: Browser, value: string) => {
  const page = await newSession(browser, TENANT_A, OWNER_A)
  try {
    await openSettings(page, TENANT_A)
    await page.getByLabel(/Libellés des statuts/).fill(value)
    await saveSettings(page)
  } finally {
    await page.context().close()
  }
}

const syncCard = (page: Page) =>
  page
    .getByRole('heading', {level: 3, name: 'Synchronisation Pennylane'})
    .locator('xpath=ancestor::*[@data-slot="card"][1]')

const myInvoices = (page: Page) =>
  page.getByRole('region', {name: 'Mes factures'})

const invoiceRows = (page: Page) =>
  myInvoices(page).getByRole('table').locator('tbody tr')

let techcorpId = ''
let marketingId = ''
/** L'envoi de l'action « PDF » du membre de TechCorp, rejoué depuis B. */
let capturedPdfAction: {
  nextAction: string
  contentType: string
  body: string
} | null = null

test.use({locale: 'fr-FR'})
test.describe.configure({mode: 'serial'})

test.describe('Factures Pennylane (s20)', () => {
  test.skip(
    !API_BASE,
    'PENNYLANE_API_BASE_URL absente : aucun faux Pennylane à servir'
  )

  test.beforeAll(async ({browser}) => {
    test.setTimeout(240_000)
    await new Promise<void>((resolve) =>
      fakePennylane.listen(FAKE_PORT, '127.0.0.1', resolve)
    )
    techcorpId = await organizationIdOf('techcorp-solutions')
    marketingId = await organizationIdOf('marketing-pro')
    await snapshotSeed(techcorpId)
    await resetRateLimits()
    await chooseProvider(browser, 'Pennylane')
    await setStatusLabels(browser, STATUS_LABELS)
  })

  test.afterAll(async ({browser}) => {
    test.setTimeout(240_000)
    try {
      await setStatusLabels(browser, '')
      await chooseProvider(browser, 'Saisie par le bureau')
    } finally {
      await restoreSeedRows(techcorpId)
      await new Promise<void>((resolve) => fakePennylane.close(() => resolve()))
    }
  })

  test('passer à Pennylane programme la synchronisation horaire', async () => {
    const jobs = await asMaintenance((client) =>
      client.query(
        `select idempotency_key from scheduled_job
          where organization_id = $1 and kind = 'billing.sync_pennylane'`,
        [techcorpId]
      )
    )
    expect(jobs.rowCount).toBeGreaterThanOrEqual(1)
  })

  test('critère 4 — le bureau relie une fiche à son client Pennylane ; la saisie est remplacée (critères 1 et 6)', async ({
    browser,
  }) => {
    const page = await newSession(browser, TENANT_A, OWNER_A)
    try {
      await page.goto(`${TENANT_A}/bureau/proprietaires/${LEFEVRE.profileId}`, {
        waitUntil: 'load',
      })
      const billing = page.getByRole('region', {name: 'Facturation'})
      await expect(
        billing.getByText(
          'Cette fiche n’est reliée à aucun client Pennylane. Ses factures ne remontent pas.'
        )
      ).toBeVisible({timeout: 20_000})
      await billing
        .getByRole('button', {name: 'Modifier l’identifiant'})
        .click()
      await billing
        .getByLabel(/Identifiant client Pennylane/)
        .fill(EXTERNAL_REF)
      await billing.getByRole('button', {name: 'Enregistrer'}).click()
      await expect(
        billing.getByText('Identifiant client enregistré.')
      ).toBeVisible({timeout: 15_000})

      const invoices = page.getByRole('region', {name: 'Factures'})
      await expect(
        invoices.getByText(/Les factures viennent de Pennylane/)
      ).toBeVisible()
      await expect(
        invoices.getByRole('link', {name: 'Ajouter une facture'})
      ).toHaveCount(0)
      await expect(invoices.getByRole('link', {name: /Modifier/})).toHaveCount(
        0
      )
    } finally {
      await page.context().close()
    }
  })

  test('critère 3 — « Mettre à jour maintenant » : comptes, clients sans fiche, fiches sans identifiant', async ({
    browser,
  }) => {
    const page = await newSession(browser, TENANT_A, OWNER_A)
    try {
      await openSettings(page, TENANT_A)
      const card = syncCard(page)
      await expect(
        card.getByText(
          'Pas encore de mise à jour. La première a lieu dans l’heure.'
        )
      ).toBeVisible({timeout: 15_000})

      await card.getByRole('button', {name: 'Mettre à jour maintenant'}).click()
      await expect(card.getByText('Factures mises à jour.')).toBeVisible({
        timeout: 30_000,
      })
      await page.reload({waitUntil: 'load'})

      const refreshed = syncCard(page)
      await expect(refreshed.getByText(/Factures mises à jour le/)).toBeVisible(
        {
          timeout: 15_000,
        }
      )
      const counts = refreshed.getByRole('list', {name: 'Comptes'})
      await expect(
        counts.getByRole('listitem').filter({hasText: 'Factures remontées'})
      ).toContainText('2')
      await expect(
        counts.getByRole('listitem').filter({hasText: 'Brouillons écartés'})
      ).toContainText('1')
      await expect(
        refreshed.getByRole('list', {name: 'Clients Pennylane sans fiche'})
      ).toContainText('FICTIF Client')
      await expect(
        refreshed.getByRole('link', {name: /Lucie Moreau/})
      ).toHaveAttribute('href', `/bureau/proprietaires/${MOREAU.profileId}`)
    } finally {
      await page.context().close()
    }

    const stored = await asMaintenance((client) =>
      client.query<{external_id: string; status: string; has_pdf: boolean}>(
        `select external_id, status, has_pdf from member_invoice
          where organization_id = $1 and source = 'pennylane'
          order by external_id`,
        [techcorpId]
      )
    )
    expect(stored.rows).toEqual([
      {external_id: '880001', status: 'late', has_pdf: true},
      {external_id: '880002', status: 'paid', has_pdf: false},
    ])
    const columns = await asMaintenance((client) =>
      client.query<{column_name: string}>(
        `select column_name from information_schema.columns
          where table_name = 'member_invoice'`
      )
    )
    expect(
      columns.rows
        .map((row) => row.column_name)
        .filter((name) => /url/.test(name))
    ).toEqual([])
  })

  test('critères 2, 7 et 8 — le membre lit libellés et PDF, et ouvre le PDF relu à la demande', async ({
    browser,
  }) => {
    await resetRateLimits()
    const page = await newMemberSession(browser, TENANT_A, LEFEVRE.email)
    try {
      await expect(myInvoices(page)).toBeVisible({timeout: 20_000})
      const late = invoiceRows(page).filter({hasText: '15/03/2026'}).filter({
        hasText: 'En retard',
      })
      await expect(late).toHaveCount(1)
      await expect(late).toContainText('Parcelle 61')
      const paid = invoiceRows(page).filter({hasText: '15/03/2025'}).filter({
        hasText: 'PDF non disponible',
      })
      await expect(paid).toHaveCount(1)
      await expect(paid.getByRole('button')).toHaveCount(0)
      await expect(
        myInvoices(page).getByText(/Factures mises à jour le/)
      ).toBeVisible()
      expect(await myInvoices(page).innerHTML()).not.toContain(FAKE_PDF_PATH)

      const actionRequest = page.waitForRequest(
        (request) =>
          request.method() === 'POST' &&
          Boolean(request.headers()['next-action'])
      )
      const pdfRequest = page.waitForRequest((request: Request) =>
        request.url().startsWith(`${FAKE_ORIGIN}${FAKE_PDF_PATH}`)
      )
      await late.getByRole('button', {name: /PDF de la facture 2026/}).click()
      const sent = await actionRequest
      capturedPdfAction = {
        nextAction: sent.headers()['next-action'],
        contentType: sent.headers()['content-type'] ?? 'text/plain',
        body: sent.postData() ?? '',
      }
      await pdfRequest
    } finally {
      await page.context().close()
    }
  })

  test('critère 3 — une fiche sans identifiant : le membre lit que ses factures ne sont pas encore reliées', async ({
    browser,
  }) => {
    await resetRateLimits()
    const page = await newMemberSession(browser, TENANT_A, MOREAU.email)
    try {
      await expect(
        myInvoices(page).getByText(
          'Vos factures ne sont pas encore reliées à votre espace. Le bureau en est informé et s’en occupe.'
        )
      ).toBeVisible({timeout: 20_000})
    } finally {
      await page.context().close()
    }
  })

  test('isolation — l’état de synchronisation et le PDF de TechCorp sont introuvables depuis Marketing Pro', async ({
    browser,
  }) => {
    const underA = await asTenant(techcorpId, (client) =>
      client.query('select organization_id from billing_sync_state')
    )
    expect(underA.rowCount).toBe(1)
    const underB = await asTenant(marketingId, (client) =>
      client.query(
        'select organization_id from billing_sync_state where organization_id = $1',
        [techcorpId]
      )
    )
    expect(underB.rowCount).toBe(0)

    expect(capturedPdfAction?.nextAction).toBeTruthy()
    await resetRateLimits()
    const page = await newMemberSession(browser, TENANT_B, SCI_PINS_EMAIL)
    try {
      const replay = await page.request.post(`${TENANT_B}/dashboard`, {
        headers: {
          'next-action': capturedPdfAction?.nextAction ?? '',
          'content-type': capturedPdfAction?.contentType ?? 'text/plain',
          accept: 'text/x-component',
          origin: TENANT_B,
        },
        data: capturedPdfAction?.body ?? '',
      })
      expect(replay.status()).toBeLessThan(500)
      const text = await replay.text()
      expect(text).not.toContain(FAKE_PDF_PATH)
      expect(text).toContain('unavailable')
    } finally {
      await page.context().close()
    }
  })
})
