/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {Browser, expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Budget d'envoi quotidien par association — s52 (ADR 053).
 *
 * Ce que seuls un navigateur, deux domaines et une vraie base prouvent : la
 * limite et la réserve se règlent par le SuperAdmin et se lisent par le
 * bureau ; un email reportable qui dépasse attend le lendemain dans
 * `deferred_email` et paraît sur `/bureau/envois` ; un lien de connexion part
 * quand même (outbox du transport `file`) ; la RLS forcée isole le compteur
 * et les reportés de deux associations (critère 9). L'atomicité du compteur
 * conditionnel (critère 2) repose sur la même instruction SQL que la RLS
 * laisse passer ici.
 *
 * `localhost` sert TechCorp Solutions, `127.0.0.1` Marketing Pro (seed). La
 * spec remet en fin d'essai les réglages et le compteur du jour de TechCorp,
 * et efface ses messages, ses reportés et leurs tâches.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
/** TechCorp Solutions dans le seed. */
const TENANT_A = `http://localhost:${PORT}`
/** Marketing Pro dans le seed. */
const TENANT_B = `http://127.0.0.1:${PORT}`

const PASSWORD = 'Azerty123'
const SUPER_ADMIN = 'superadmin@gmail.com'
/** Présidente de TechCorp Solutions. */
const OWNER_A = 'user-owner@gmail.com'
/** Membre du bureau (rôle `board`) de Marketing Pro. */
const BOARD_B = 'user-admin@gmail.com'
/** Compte membre de TechCorp, destinataire du lien de connexion. */
const MEMBER_A_LOGIN = 'user@gmail.com'

const SETTINGS_ROUTE = '/bureau/reglages'
const SENDS_ROUTE = '/bureau/envois'
const CONTACT_ROUTE = '/contact'
const LIMIT_KEY = 'email.daily_send_limit'
const RESERVE_KEY = 'email.login_reserve'

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
const MARKER = `s52-${RUN}`

const VISITOR_RUN = Date.now().toString(16).slice(-4)
let visitorCount = 0
/** Adresse IPv6 de documentation, neuve à chaque envoi (limiteur de s08b). */
const nextVisitorHeaders = () => ({
  'x-forwarded-for': `2001:db8:552:${VISITOR_RUN}::${(++visitorCount).toString(16)}`,
})

const VISITOR = {name: 'Claire Meunier', email: 'claire.meunier@example.fr'}

/** Le jour du budget, en base : le jour de Paris (critère 10). */
const PARIS_DAY_SQL = `(now() at time zone 'Europe/Paris')::date`

test.use({locale: 'fr-FR'})
test.describe.configure({mode: 'serial'})

const databaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const testEnvPath = path.resolve(process.cwd(), '.env.test')
  const parsed = fs.existsSync(testEnvPath)
    ? dotenv.parse(fs.readFileSync(testEnvPath))
    : {}
  if (!parsed.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL introuvable : les preuves SQL attaquent la base en direct.'
    )
  }
  return parsed.DATABASE_URL
}

/** Une connexion sous le rôle applicatif, soumis à la RLS forcée. */
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

const inTransaction = async <T>(
  client: Client,
  setting: [string, string],
  callback: () => Promise<T>
): Promise<T> => {
  await client.query('begin')
  try {
    await client.query(`select set_config($1, $2, true)`, setting)
    const result = await callback()
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  }
}

/** Sous le scope d'une association, comme le produit. */
const inTenantScope = <T>(
  organizationId: string,
  callback: (client: Client) => Promise<T>
) =>
  withAppRoleClient((client) =>
    inTransaction(client, ['app.organization_id', organizationId], () =>
      callback(client)
    )
  )

/** Nettoyage hors scope : le seul `bypass` de la spec. */
const asMaintenance = <T>(callback: (client: Client) => Promise<T>) =>
  withAppRoleClient((client) =>
    inTransaction(client, ['app.bypass_rls', 'on'], () => callback(client))
  )

const tenantIds = () =>
  withAppRoleClient(async (client) => {
    const result = await client.query<{slug: string; id: string}>(
      `select slug, id from organization where slug in ('techcorp-solutions', 'marketing-pro')`
    )
    const bySlug = new Map(result.rows.map((row) => [row.slug, row.id]))
    const a = bySlug.get('techcorp-solutions')
    const b = bySlug.get('marketing-pro')
    expect(a, 'le seed doit porter les deux associations').toBeTruthy()
    expect(b, 'le seed doit porter les deux associations').toBeTruthy()
    return {a: a as string, b: b as string}
  })

type Budget = {reportable: number; login: number}

/** Le compteur du jour d'une association, lu sous son propre scope. */
const budgetOf = (organizationId: string): Promise<Budget> =>
  inTenantScope(organizationId, async (client) => {
    const result = await client.query<{
      reportable_count: number
      login_count: number
    }>(
      `select reportable_count, login_count from email_send_budget
        where organization_id = $1 and day = ${PARIS_DAY_SQL}`,
      [organizationId]
    )
    const [row] = result.rows
    return {
      reportable: row?.reportable_count ?? 0,
      login: row?.login_count ?? 0,
    }
  })

/**
 * Pose les deux compteurs du jour. Le compteur de connexion compte aussi : la
 * bannière « réserve épuisée » prime sur « limite atteinte » dès que les
 * envois du jour atteignent la limite, et d'autres specs envoient des liens
 * de connexion à TechCorp avant celle-ci.
 */
const setBudget = (organizationId: string, budget: Budget) =>
  inTenantScope(organizationId, (client) =>
    client.query(
      `insert into email_send_budget
         (organization_id, day, reportable_count, login_count)
       values ($1, ${PARIS_DAY_SQL}, $2, $3)
       on conflict (organization_id, day)
       do update set reportable_count = excluded.reportable_count,
                     login_count = excluded.login_count`,
      [organizationId, budget.reportable, budget.login]
    )
  )

/**
 * Les reportés de l'essai, repérés par le message de contact qu'ils
 * désignent : l'objet de la notification est celui de l'association, il ne
 * porte pas l'objet du message.
 */
const DEFERRED_OF_RUN_SQL = `deferred_email.reference_type = 'contact_message'
  and deferred_email.reference_id in (
    select contact_message.id from contact_message
     where contact_message.subject like $1
  )`

const deferredOfRun = (organizationId: string) =>
  inTenantScope(organizationId, async (client) => {
    const result = await client.query<{
      id: string
      nature: string
      send_on: string
      status: string
    }>(
      `select id, nature, send_on::text, status from deferred_email
        where ${DEFERRED_OF_RUN_SQL}`,
      [`%${MARKER}%`]
    )
    return result.rows
  })

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

const newContext = async (browser: Browser, base: string) => {
  const context = await browser.newContext({locale: 'fr-FR'})
  await context.addCookies([{name: 'NEXT_LOCALE', value: 'fr', url: base}])
  return context
}

const newSession = async (browser: Browser, base: string, email: string) => {
  const page = await (await newContext(browser, base)).newPage()
  await login(page, base, email)
  return page
}

type OutboxMessage = {to: string; subject: string; text: string}

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

const messagesSince = (before: Set<string>): OutboxMessage[] =>
  [...outboxFiles()]
    .filter((file) => !before.has(file))
    .map(
      (file) =>
        JSON.parse(
          fs.readFileSync(path.join(outboxDir(), file), 'utf8')
        ) as OutboxMessage
    )

const field = (page: Page, name: RegExp | string) =>
  page.getByRole('textbox', {name})

/** Un message depuis `/contact` : la notification au bureau est reportable. */
const sendContactMessage = async (
  page: Page,
  base: string,
  subject: string
) => {
  await page.setExtraHTTPHeaders(nextVisitorHeaders())
  await page.goto(`${base}${CONTACT_ROUTE}`, {waitUntil: 'networkidle'})
  await expect(
    page.getByRole('heading', {level: 1, name: 'Contacter le bureau'})
  ).toBeVisible({timeout: 15_000})
  await field(page, /Votre nom/).fill(VISITOR.name)
  await field(page, 'Votre adresse email').fill(VISITOR.email)
  await field(page, 'Objet').fill(subject)
  await field(page, 'Votre message').fill(`Bonjour, essai ${MARKER}.`)
  await page.getByRole('button', {name: 'Envoyer le message'}).click()
  await expect(
    page.getByRole('status').filter({hasText: 'Message envoyé.'})
  ).toBeVisible({timeout: 15_000})
}

/** Demande un lien de connexion, une fois la page hydratée. */
const requestLoginLink = async (page: Page, address: string, base: string) => {
  await page.goto(`${base}/login`)
  await page.waitForLoadState('networkidle')
  const input = page.getByLabel('Adresse email')
  await input.fill(address)
  await expect(input).toHaveValue(address)
  await page
    .getByRole('button', {name: 'Recevoir mon lien de connexion'})
    .click()
  await expect(
    page.getByRole('heading', {level: 1, name: 'Consultez votre boîte mail'})
  ).toBeVisible({timeout: 15_000})
}

test.describe('Budget d’envoi quotidien — report, rejeu en attente, isolation (s52)', () => {
  let budgetBeforeRun: Budget = {reportable: 0, login: 0}

  test.beforeAll(async () => {
    const {a} = await tenantIds()
    budgetBeforeRun = await budgetOf(a)
  })

  test.afterAll(async () => {
    const {a, b} = await tenantIds()
    await inTenantScope(a, (client) =>
      client.query(
        `delete from organization_setting
          where organization_id = $1 and key in ($2, $3)`,
        [a, LIMIT_KEY, RESERVE_KEY]
      )
    )
    await setBudget(a, budgetBeforeRun)
    await asMaintenance(async (client) => {
      const deferred = await client.query<{id: string}>(
        `delete from deferred_email where ${DEFERRED_OF_RUN_SQL} returning id`,
        [`%${MARKER}%`]
      )
      await client.query(
        `delete from scheduled_job
          where kind = 'email.deliver_deferred' and idempotency_key = any($1)`,
        [deferred.rows.map((row) => row.id)]
      )
      await client.query(
        `delete from contact_message
          where organization_id = any($1) and subject like $2`,
        [[a, b], `%${MARKER}%`]
      )
    })
  })

  test('critères 1, 3 et 4 — limite réduite par le SuperAdmin : la notification attend demain, le bureau la voit ; le lien de connexion part', async ({
    browser,
  }) => {
    test.setTimeout(180_000)
    const {a} = await tenantIds()

    const admin = await newSession(browser, TENANT_A, SUPER_ADMIN)
    try {
      await admin.goto(`${TENANT_A}${SETTINGS_ROUTE}`, {
        waitUntil: 'networkidle',
      })
      await admin.getByLabel(/Limite d’envoi quotidienne/).fill('2')
      await admin.getByLabel(/Envois gardés pour la connexion/).fill('1')
      await admin
        .getByRole('button', {name: 'Enregistrer les réglages'})
        .click()
      await expect(
        admin.getByRole('status').filter({hasText: 'Réglages enregistrés.'})
      ).toBeVisible({timeout: 15_000})
    } finally {
      await admin.context().close()
    }

    const bureau = await newSession(browser, TENANT_A, OWNER_A)
    try {
      await bureau.goto(`${TENANT_A}${SETTINGS_ROUTE}`, {
        waitUntil: 'networkidle',
      })
      const limit = bureau.getByLabel(/Limite d’envoi quotidienne/)
      await expect(limit).toHaveValue('2')
      await expect(limit).toHaveAttribute('readonly', '')
      await expect(
        bureau.getByLabel(/Envois gardés pour la connexion/)
      ).toHaveAttribute('readonly', '')

      await setBudget(a, {reportable: 1, login: 0})
      const subject = `Budget épuisé ${MARKER}`
      const before = outboxFiles()
      const visitor = await (await newContext(browser, TENANT_A)).newPage()
      try {
        await sendContactMessage(visitor, TENANT_A, subject)
      } finally {
        await visitor.context().close()
      }

      await expect
        .poll(async () => (await deferredOfRun(a)).length, {timeout: 15_000})
        .toBe(1)
      const [deferred] = await deferredOfRun(a)
      expect(deferred).toMatchObject({
        nature: 'board_notification',
        status: 'pending',
      })
      expect(
        messagesSince(before).filter((message) =>
          message.text.includes(subject)
        )
      ).toHaveLength(0)

      await bureau.goto(`${TENANT_A}${SENDS_ROUTE}`, {waitUntil: 'networkidle'})
      await expect(
        bureau.getByRole('heading', {level: 1, name: 'Envois d’emails'})
      ).toBeVisible()
      await expect(
        bureau.getByText('La limite d’envoi du jour est atteinte.')
      ).toBeVisible()
      const row = bureau
        .getByRole('row')
        .filter({hasText: 'Message reçu depuis le formulaire de contact'})
        .first()
      await expect(row).toBeVisible()
      await expect(row).toContainText(/Programmée pour le \d{2}\/\d{2}/)
      await expect(bureau.getByText(VISITOR.email)).toHaveCount(0)
      await expect(bureau.getByText(subject)).toHaveCount(0)

      const loginBefore = (await budgetOf(a)).login
      const loginOutbox = outboxFiles()
      const member = await (await newContext(browser, TENANT_A)).newPage()
      try {
        await requestLoginLink(member, MEMBER_A_LOGIN, TENANT_A)
      } finally {
        await member.context().close()
      }
      await expect
        .poll(
          () =>
            messagesSince(loginOutbox).filter(
              (message) => message.to === MEMBER_A_LOGIN
            ).length,
          {timeout: 15_000}
        )
        .toBe(1)
      expect((await budgetOf(a)).login).toBe(loginBefore + 1)
    } finally {
      await bureau.context().close()
    }
  })

  test('critère 9 — accès croisé : B ne lit ni ne consomme le budget de A, et ne voit pas ses envois en attente', async ({
    browser,
  }) => {
    test.setTimeout(180_000)
    const {a, b} = await tenantIds()
    const [deferredOfA] = await deferredOfRun(a)
    expect(deferredOfA, 'le test précédent a reporté un envoi').toBeTruthy()

    const seenFromB = await inTenantScope(b, async (client) => ({
      budgets: await client.query(
        `select id from email_send_budget where organization_id = $1`,
        [a]
      ),
      deferred: await client.query(
        `select id from deferred_email where organization_id = $1 or id = $2`,
        [a, deferredOfA.id]
      ),
      allBudgets: await client.query<{organization_id: string}>(
        `select organization_id from email_send_budget`
      ),
    }))
    expect(seenFromB.budgets.rowCount).toBe(0)
    expect(seenFromB.deferred.rowCount).toBe(0)
    expect(
      seenFromB.allBudgets.rows.every((row) => row.organization_id === b)
    ).toBe(true)

    await expect(
      inTenantScope(b, (client) =>
        client.query(
          `insert into email_send_budget (organization_id, day, reportable_count)
           values ($1, ${PARIS_DAY_SQL} + 1, 0)`,
          [a]
        )
      )
    ).rejects.toThrow(/row-level security/)
    const consumedFromB = await inTenantScope(b, (client) =>
      client.query(
        `update email_send_budget set reportable_count = reportable_count + 1
          where organization_id = $1`,
        [a]
      )
    )
    expect(consumedFromB.rowCount).toBe(0)

    const budgetOfA = await budgetOf(a)
    const budgetOfB = await budgetOf(b)
    const visitor = await (await newContext(browser, TENANT_B)).newPage()
    try {
      await sendContactMessage(visitor, TENANT_B, `Isolation ${MARKER}`)
    } finally {
      await visitor.context().close()
    }
    await expect
      .poll(async () => (await budgetOf(b)).reportable, {timeout: 15_000})
      .toBe(budgetOfB.reportable + 1)
    expect(await budgetOf(a)).toEqual(budgetOfA)

    const boardB = await newSession(browser, TENANT_B, BOARD_B)
    try {
      await boardB.goto(`${TENANT_B}${SENDS_ROUTE}`, {waitUntil: 'networkidle'})
      await expect(
        boardB.getByRole('heading', {level: 1, name: 'Envois d’emails'})
      ).toBeVisible()
      await expect(
        boardB.getByText('La limite d’envoi du jour est atteinte.')
      ).toHaveCount(0)
      await expect(
        boardB
          .getByRole('row')
          .filter({hasText: 'Message reçu depuis le formulaire de contact'})
      ).toHaveCount(0)
    } finally {
      await boardB.context().close()
    }
  })
})
