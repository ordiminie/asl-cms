/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {Browser, expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Factures des membres — s19, critères 1, 7, 8 et 9, et isolation entre
 * associations ; s21, le règlement d'une facture (critères 3 et 5).
 *
 * Ce que seuls un navigateur, deux domaines et une vraie base prouvent : le
 * membre lit les factures de **tous** ses terrains, triées, chacune avec sa
 * parcelle ; une parcelle vendue garde ses factures à la fiche facturée ; un
 * identifiant forgé ne sort rien d'une autre association ; le bureau saisit
 * une facture et le membre la voit ; une facture Pennylane se lit sans
 * formulaire, et son envoi direct est refusé par le serveur.
 *
 * `localhost` sert TechCorp Solutions, `127.0.0.1` Marketing Pro (seed). Les
 * factures du seed : `src/db/scripts/tenant-member-invoices-seed.ts`.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
/** TechCorp Solutions dans le seed. */
const TENANT_A = `http://localhost:${PORT}`
/** Marketing Pro dans le seed. */
const TENANT_B = `http://127.0.0.1:${PORT}`

const PASSWORD = 'Azerty123'
/** Présidente de TechCorp Solutions. */
const OWNER_A = 'user-owner@gmail.com'
/** Membre du bureau (rôle `board`) de Marketing Pro. */
const BOARD_B = 'user-admin@gmail.com'

/** Trois fiches, un seul compte (s53) : parcelles 61, 62 et 63. */
const LEFEVRE = {
  email: 'bernard.lefevre@example.test',
  firstProfileId: 'a1200000-0000-4000-8000-000000000008',
}
/** Vendeuse de la parcelle 9 le 01/10/2019. */
const MOREAU_EMAIL = 'lucie.moreau@example.test'
/** Acquéreur de la parcelle 9 : une fiche sans adresse, lue par le bureau. */
const LAURENT_PROFILE_ID = 'a1200000-0000-4000-8000-000000000004'
/** Fiche de Marketing Pro, avec un compte. */
const SCI_PINS = {
  email: 'contact@sci-les-pins.test',
  profileId: 'b1200000-0000-4000-8000-000000000001',
}

/** Factures du seed. */
const INVOICE_LEFEVRE_SITE = 'a1900000-0000-4000-8000-0000000000c1'
const INVOICE_LEFEVRE_PENNYLANE = 'a1900000-0000-4000-8000-0000000000c3'
const INVOICE_MARKETING = 'b1900000-0000-4000-8000-0000000000d1'

/** Une saisie propre à cet essai : l'année et le montant la désignent. */
const RUN_YEAR = 2099
const RUN_AMOUNT_CENTS = 77777
const RUN_AMOUNT = '777,77'

const LINK_SENT_TITLE = 'Consultez votre boîte mail'
/**
 * La page introuvable : `notFound()` levé derrière un `<Suspense>` part dans
 * un flux déjà commencé, le statut n'est pas le témoin — le contenu l'est.
 */
const NOT_FOUND_TITLE = 'Page non trouvée'

const VISITOR_RUN = Date.now().toString(16).slice(-4)
let visitorCount = 0
/** Adresse IPv6 de documentation, propre à cet essai et à ce navigateur. */
const nextVisitorIp = () =>
  `2001:db8:519:${VISITOR_RUN}::${(++visitorCount).toString(16)}`

type OutboxMessage = {to: string; text: string}

test.use({locale: 'fr-FR'})
test.describe.configure({mode: 'serial'})

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

const databaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const testEnvPath = path.resolve(process.cwd(), '.env.test')
  const parsed = fs.existsSync(testEnvPath)
    ? dotenv.parse(fs.readFileSync(testEnvPath))
    : {}
  if (!parsed.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL introuvable : les préparations SQL attaquent la base en direct.'
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

/**
 * Chaque essai retire les factures qu'il a écrites. Il ne signale rien : la
 * saisie porte un statut classé (« En attente »), et les statuts déjà signalés
 * viennent du seed (`TEST_INVOICE_STATUS_ALERTS`), qui n'est pas à défaire.
 */
const cleanUpRun = () =>
  asMaintenance(async (client) => {
    await client.query(
      `delete from member_invoice where year = $1 and amount_cents = $2`,
      [RUN_YEAR, RUN_AMOUNT_CENTS]
    )
  })

/** Les liens de connexion sont plafonnés par adresse et par jour. */
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

const newBoardSession = async (
  browser: Browser,
  base: string,
  email: string
) => {
  const context = await browser.newContext({locale: 'fr-FR'})
  await context.addCookies([{name: 'NEXT_LOCALE', value: 'fr', url: base}])
  const page = await context.newPage()
  await login(page, base, email)
  return page
}

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
  await expect(
    page.getByRole('heading', {level: 1, name: LINK_SENT_TITLE})
  ).toBeVisible({timeout: 15_000})
  await expect
    .poll(() => messagesTo(before, email).length, {timeout: 10_000})
    .toBe(1)
  const link = messagesTo(before, email)[0].text.match(
    /https?:\/\/\S+\/magic-link\/verify\?\S+/
  )?.[0]
  expect(link, 'la version texte porte l’URL en clair').toBeTruthy()
  await page.goto(link as string)
  await expect(page).toHaveURL(`${base}/dashboard`, {timeout: 15_000})
  return page
}

const myInvoices = (page: Page) =>
  page.getByRole('region', {name: 'Mes factures'})

/** Les lignes du tableau (la vue en cartes est masquée en desktop). */
const invoiceRows = (page: Page) =>
  myInvoices(page).getByRole('table').locator('tbody tr')

const boardInvoiceRows = (page: Page) =>
  page
    .getByRole('region', {name: 'Factures'})
    .getByRole('table')
    .locator('tbody tr')

const openProfile = async (page: Page, base: string, profileId: string) => {
  await page.goto(`${base}/bureau/proprietaires/${profileId}`, {
    waitUntil: 'load',
  })
  await expect(page.getByRole('region', {name: 'Factures'})).toBeVisible({
    timeout: 20_000,
  })
}

test.describe('Factures des membres (s19)', () => {
  test.beforeEach(async () => {
    await resetRateLimits()
  })

  test.afterAll(async () => {
    await cleanUpRun()
  })

  test('critère 1 — un propriétaire de trois terrains voit leurs factures au même endroit, triées, chacune avec sa parcelle', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const lefevre = await newMemberSession(browser, TENANT_A, LEFEVRE.email)
    try {
      await expect(myInvoices(lefevre)).toBeVisible({timeout: 20_000})
      const rows = invoiceRows(lefevre)
      await expect(rows).toHaveCount(3)
      await expect(rows.nth(0)).toContainText('20/03/2026')
      await expect(rows.nth(0)).toContainText('Parcelle 63')
      await expect(rows.nth(0)).toContainText('Partiellement payée')
      await expect(rows.nth(1)).toContainText('15/03/2026')
      await expect(rows.nth(1)).toContainText('Parcelle 61')
      await expect(rows.nth(1)).toContainText('Cotisation et eau 2026')
      await expect(rows.nth(1)).toContainText('412,50 €')
      await expect(rows.nth(2)).toContainText('15/03/2025')
      await expect(rows.nth(2)).toContainText('Parcelle 62')
      expect(await myInvoices(lefevre).innerHTML()).not.toContain(
        INVOICE_LEFEVRE_SITE
      )
    } finally {
      await lefevre.context().close()
    }
  })

  test('critère 8 — la parcelle vendue : la facture d’avant la vente reste à la vendeuse, celle d’après est à l’acquéreur', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const moreau = await newMemberSession(browser, TENANT_A, MOREAU_EMAIL)
    try {
      await expect(myInvoices(moreau)).toBeVisible({timeout: 20_000})
      await expect(invoiceRows(moreau)).toHaveCount(1)
      await expect(invoiceRows(moreau).first()).toContainText('15/03/2019')
      await expect(invoiceRows(moreau).first()).toContainText('Parcelle 9')
      await expect(myInvoices(moreau)).not.toContainText('16/03/2020')
    } finally {
      await moreau.context().close()
    }

    const owner = await newBoardSession(browser, TENANT_A, OWNER_A)
    try {
      await openProfile(owner, TENANT_A, LAURENT_PROFILE_ID)
      await expect(boardInvoiceRows(owner)).toHaveCount(1)
      await expect(boardInvoiceRows(owner).first()).toContainText('16/03/2020')
      await expect(boardInvoiceRows(owner).first()).toContainText('Parcelle 9')
    } finally {
      await owner.context().close()
    }
  })

  test('critère 7 — un membre de l’autre association ne voit que les siennes ; un identifiant forgé ne rend rien', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const sciPins = await newMemberSession(browser, TENANT_B, SCI_PINS.email)
    try {
      await expect(myInvoices(sciPins)).toBeVisible({timeout: 20_000})
      await expect(invoiceRows(sciPins)).toHaveCount(1)
      await expect(invoiceRows(sciPins).first()).toContainText('10/02/2026')
      await expect(myInvoices(sciPins)).not.toContainText('Parcelle 61')
    } finally {
      await sciPins.context().close()
    }

    const boardB = await newBoardSession(browser, TENANT_B, BOARD_B)
    try {
      await boardB.goto(
        `${TENANT_B}/bureau/proprietaires/${SCI_PINS.profileId}/factures/${INVOICE_LEFEVRE_SITE}`,
        {waitUntil: 'load'}
      )
      await expect(boardB.getByText(NOT_FOUND_TITLE)).toBeVisible({
        timeout: 20_000,
      })
      await expect(boardB.getByText('412,50 €')).toHaveCount(0)
    } finally {
      await boardB.context().close()
    }

    const owner = await newBoardSession(browser, TENANT_A, OWNER_A)
    try {
      await owner.goto(
        `${TENANT_A}/bureau/proprietaires/${LEFEVRE.firstProfileId}/factures/${INVOICE_MARKETING}`,
        {waitUntil: 'load'}
      )
      await expect(owner.getByText(NOT_FOUND_TITLE)).toBeVisible({
        timeout: 20_000,
      })
      await expect(owner.getByText('520,00 €')).toHaveCount(0)
    } finally {
      await owner.context().close()
    }
  })

  test('critère 9 — le bureau saisit une facture, le membre la voit dans son espace', async ({
    browser,
  }) => {
    test.setTimeout(180_000)
    const owner = await newBoardSession(browser, TENANT_A, OWNER_A)
    try {
      await openProfile(owner, TENANT_A, LEFEVRE.firstProfileId)
      await owner
        .getByRole('region', {name: 'Factures'})
        .getByRole('link', {name: 'Ajouter une facture'})
        .click()
      await expect(
        owner.getByRole('heading', {level: 1, name: 'Ajouter une facture'})
      ).toBeVisible({timeout: 20_000})
      await owner.waitForLoadState('networkidle')

      await owner.getByRole('combobox', {name: /Terrain facturé/}).click()
      await owner.getByRole('option', {name: 'Parcelle 61'}).click()
      const year = owner.getByRole('textbox', {name: 'Année'})
      await year.fill(String(RUN_YEAR))
      await owner.getByRole('textbox', {name: 'Montant'}).fill(RUN_AMOUNT)
      await owner
        .getByRole('textbox', {name: 'Échéance'})
        .fill(`31/12/${RUN_YEAR}`)
      await expect(owner.getByText(/Objet affiché au membre/)).toContainText(
        `Cotisation et eau ${RUN_YEAR}`
      )
      await owner.getByRole('combobox', {name: /Statut/}).click()
      await owner.getByRole('option', {name: 'En attente'}).click()
      await owner.getByRole('button', {name: 'Enregistrer la facture'}).click()

      await expect(owner).toHaveURL(
        `${TENANT_A}/bureau/proprietaires/${LEFEVRE.firstProfileId}?facture=enregistree`,
        {timeout: 15_000}
      )
      await expect(
        owner.getByRole('region', {name: 'Factures'}).getByRole('status')
      ).toContainText('Facture enregistrée.', {timeout: 15_000})
    } finally {
      await owner.context().close()
    }

    const lefevre = await newMemberSession(browser, TENANT_A, LEFEVRE.email)
    try {
      await expect(myInvoices(lefevre)).toBeVisible({timeout: 20_000})
      const added = invoiceRows(lefevre).filter({hasText: `${RUN_AMOUNT} €`})
      await expect(added).toHaveCount(1)
      await expect(added).toContainText(`Cotisation et eau ${RUN_YEAR}`)
      await expect(added).toContainText('Parcelle 61')
      await expect(added).toContainText('En attente')
    } finally {
      await lefevre.context().close()
    }
  })

  test('critère 9 — une facture Pennylane se lit sans formulaire, et son envoi direct est refusé par le serveur', async ({
    browser,
  }) => {
    test.setTimeout(180_000)
    const owner = await newBoardSession(browser, TENANT_A, OWNER_A)
    try {
      await owner.goto(
        `${TENANT_A}/bureau/proprietaires/a1200000-0000-4000-8000-00000000000a/factures/${INVOICE_LEFEVRE_PENNYLANE}`,
        {waitUntil: 'load'}
      )
      await expect(
        owner.getByText(
          'Cette facture vient de Pennylane. Elle se lit ici mais se corrige dans Pennylane.'
        )
      ).toBeVisible({timeout: 20_000})
      await expect(owner.getByRole('textbox')).toHaveCount(0)
      await expect(
        owner.getByRole('button', {name: 'Enregistrer la facture'})
      ).toHaveCount(0)

      // Une facture saisie pour cet essai, dont le formulaire est ouvert, puis
      // reclassée Pennylane : l'envoi qui suit est un envoi direct, refusé.
      const invoiceId = await asMaintenance(async (client) => {
        const {rows} = await client.query<{id: string}>(
          `insert into member_invoice
             (organization_id, member_profile_id, parcel_id, source, year, issued_on, due_on, amount_cents, status)
           select mi.organization_id, mi.member_profile_id, mi.parcel_id, 'site', $2, mi.issued_on, mi.due_on, $3, mi.status
             from member_invoice mi where mi.id = $1
           returning id`,
          [INVOICE_LEFEVRE_SITE, RUN_YEAR, RUN_AMOUNT_CENTS]
        )
        return rows[0].id
      })
      await owner.goto(
        `${TENANT_A}/bureau/proprietaires/${LEFEVRE.firstProfileId}/factures/${invoiceId}`,
        {waitUntil: 'load'}
      )
      const amount = owner.getByRole('textbox', {name: 'Montant'})
      await expect(amount).toHaveValue(RUN_AMOUNT, {timeout: 20_000})
      await owner.waitForLoadState('networkidle')
      await asMaintenance((client) =>
        client.query(
          `update member_invoice set source = 'pennylane', external_id = $2 where id = $1`,
          [invoiceId, `PL-E2E-${VISITOR_RUN}`]
        )
      )

      await amount.fill('1,00')
      await owner.getByRole('button', {name: 'Enregistrer la facture'}).click()

      await expect(
        owner.getByText(
          'La facture n’a pas été modifiée. Elle vient de Pennylane et ne se corrige que là-bas. Rien n’est perdu.'
        )
      ).toBeVisible({timeout: 15_000})
      const stored = await asMaintenance((client) =>
        client.query<{amount_cents: number}>(
          `select amount_cents from member_invoice where id = $1`,
          [invoiceId]
        )
      )
      expect(stored.rows[0].amount_cents).toBe(RUN_AMOUNT_CENTS)
    } finally {
      await owner.context().close()
    }
  })
})

/**
 * s21 — payer sa facture. Aucun fournisseur ne donne de lien aujourd'hui
 * (ADR 063) : le bouton « Payer » n'est prouvé qu'en unitaire ; ici, la
 * mention de virement sur une impayée du seed, et rien sur une réglée.
 */
test.describe('Payer sa facture (s21)', () => {
  test.beforeEach(async () => {
    await resetRateLimits()
  })

  test('critères 3 et 5 — l’impayée se règle par virement et renvoie au bureau ; la réglée n’a rien', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const lefevre = await newMemberSession(browser, TENANT_A, LEFEVRE.email)
    try {
      await expect(myInvoices(lefevre)).toBeVisible({timeout: 20_000})
      await expect(
        myInvoices(lefevre).getByRole('columnheader', {name: 'Règlement'})
      ).toBeVisible()

      const unpaid = invoiceRows(lefevre).filter({hasText: '412,50 €'})
      await expect(unpaid).toHaveCount(1)
      await expect(unpaid).toContainText('En attente')
      await expect(unpaid).toContainText('Par virement')
      await expect(unpaid.getByRole('link')).toHaveCount(0)

      const settled = invoiceRows(lefevre).filter({hasText: '398,00 €'})
      await expect(settled).toHaveCount(1)
      await expect(settled).toContainText('Payée')
      await expect(settled).not.toContainText('virement')
      await expect(settled.getByRole('link')).toHaveCount(0)

      const notice = myInvoices(lefevre).getByRole('note')
      await expect(notice).toHaveCount(1)
      await expect(notice).toContainText(
        'Les factures à régler se paient par virement.'
      )
      await expect(
        notice.getByRole('link', {name: 'page Contact'})
      ).toHaveAttribute('href', '/contact')
      await expect(
        myInvoices(lefevre).getByRole('link', {name: /^Payer/})
      ).toHaveCount(0)
    } finally {
      await lefevre.context().close()
    }
  })
})
