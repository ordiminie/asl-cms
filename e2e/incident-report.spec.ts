/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {Browser, expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Signalements publics — s10, critères 1 à 9 et isolation entre associations.
 *
 * Ce que seuls un navigateur, deux domaines et une vraie base prouvent : le
 * signalement écrit depuis `/signaler` arrive dans `incident_report` **et**
 * dans la boîte de sortie du transport `file` (`EMAIL_TRANSPORT=file`), vers
 * l'adresse de contact lue **à l'envoi** et vers l'adresse de sa catégorie ; le
 * bureau le fait avancer, chaque changement horodaté et attribué ; les
 * catégories se gèrent dans la limite de 10 ; le limiteur est **partagé** avec
 * `/contact` ; enfin la RLS isole les deux associations.
 *
 * `localhost` sert TechCorp Solutions, `127.0.0.1` Marketing Pro (seed). Chaque
 * soumission prend une adresse **neuve** (`x-forwarded-for`), sauf dans le cas
 * du critère 9, qui porte sur la même adresse. Les réglages changés sont remis
 * **par l'application** à leur valeur de départ : ils sont en cache côté
 * serveur.
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
/** Membre simple de TechCorp : ses coordonnées servent le critère 8. */
const MEMBER_A = {email: 'moderator-member@gmail.com', name: 'Julie'}

const REPORT_ROUTE = '/fr/signaler'
const REPORTS_ROUTE = '/fr/bureau/signalements'
const CATEGORIES_ROUTE = '/fr/bureau/signalements/categories'
const SETTINGS_ROUTE = '/fr/bureau/reglages'
const CONTACT_ROUTE = '/fr/contact'
const SETTINGS_SAVED =
  'Réglages enregistrés. Les prochains messages partiront vers ces adresses.'
const THRESHOLD_LABEL = /Nombre de messages par heure et par visiteur/

/** L'adresse que le seed porte sur « Fuite d'eau » (ADR 028). */
const FORAGE_ADDRESS = 'forage@techcorp-solutions.test'

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
const markerOf = (label: string) => `${label} s10-${RUN}`

const VISITOR_RUN = Date.now().toString(16).slice(-4)
let visitorCount = 0
/** Adresse IPv6 de documentation, propre à cet essai et à cet envoi. */
const nextVisitorIp = () =>
  `2001:db8:510:${VISITOR_RUN}::${(++visitorCount).toString(16)}`

type OutboxMessage = {
  from: string
  to: string
  subject: string
  html?: string
  text: string
}

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

/** Les emails déposés depuis `before` qui parlent de `marker`. */
const emailsAbout = (before: Set<string>, marker: string): OutboxMessage[] =>
  [...outboxFiles()]
    .filter((file) => !before.has(file))
    .map(
      (file) =>
        JSON.parse(
          fs.readFileSync(path.join(outboxDir(), file), 'utf8')
        ) as OutboxMessage
    )
    .filter((email) => email.text.includes(marker))

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

/** Préparation et nettoyage hors scope : le seul `bypass` de la spec. */
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

type StoredReport = {
  id: string
  category_id: string | null
  status: string
  member_id: string | null
  reporter_email: string | null
  created_at: Date
}

/** Le signalement de TechCorp dont le lieu porte `marker`, lu sous son scope. */
const storedReportOfTenantA = async (
  marker: string
): Promise<StoredReport | undefined> => {
  const {a} = await tenantIds()
  return inTenantScope(a, async (client) => {
    const result = await client.query<StoredReport>(
      `select id, category_id, status, member_id, reporter_email, created_at
         from incident_report where location like $1`,
      [`%${marker}%`]
    )
    return result.rows[0]
  })
}

const eventsOf = async (reportId: string) => {
  const {a} = await tenantIds()
  return inTenantScope(a, async (client) => {
    const result = await client.query<{
      status: string
      author_user_id: string | null
      author_name: string | null
      created_at: Date
    }>(
      `select status, author_user_id, author_name, created_at
         from incident_report_event where report_id = $1 order by created_at`,
      [reportId]
    )
    return result.rows
  })
}

/** Les catégories de TechCorp, actives ou non, lues sous son scope. */
const categoriesOfTenantA = async () => {
  const {a} = await tenantIds()
  return inTenantScope(a, async (client) => {
    const result = await client.query<{
      id: string
      name: string
      routing_email: string | null
      deleted_at: Date | null
    }>(
      `select id, name, routing_email, deleted_at from association_category
        where domain = 'report' order by created_at`
    )
    return result.rows
  })
}

const activeCategoryId = async (name: string) => {
  const found = (await categoriesOfTenantA()).find(
    (row) => row.name === name && row.deleted_at === null
  )
  expect(found, `la catégorie « ${name} » doit exister`).toBeTruthy()
  return (found as {id: string}).id
}

/** L'adresse de notification de TechCorp, telle qu'enregistrée. */
const storedContactOfTenantA = async (): Promise<string> => {
  const {a} = await tenantIds()
  return inTenantScope(a, async (client) => {
    const result = await client.query<{value: string}>(
      `select value from organization_setting where organization_id = $1 and key = 'contact.email'`,
      [a]
    )
    const value = result.rows[0]?.value
    expect(value, 'TechCorp doit avoir une adresse de contact').toBeTruthy()
    return value
  })
}

/** Chaque essai nettoie ce qu'il a écrit : une base locale se relit deux fois. */
const cleanUpRun = () =>
  asMaintenance(async (client) => {
    await client.query(`delete from incident_report where location like $1`, [
      `% s10-${RUN}%`,
    ])
    await client.query(`delete from association_category where name like $1`, [
      `%${RUN}%`,
    ])
    await client.query(`delete from contact_message where subject like $1`, [
      `% s10-${RUN}`,
    ])
  })

const login = async (page: Page, base: string, email: string) => {
  await page.goto(`${base}/fr/login/prestataire`)
  await expect(page.locator('form')).toBeVisible()
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.toString().includes('/login'), {
    timeout: 15_000,
  })
}

/** Session du bureau ; le cookie `NEXT_LOCALE` fait répondre les actions en français. */
const newSession = async (browser: Browser, base: string, email: string) => {
  const context = await browser.newContext({locale: 'fr-FR'})
  await context.addCookies([{name: 'NEXT_LOCALE', value: 'fr', url: base}])
  const page = await context.newPage()
  await login(page, base, email)
  return page
}

/** Un visiteur, reconnu par l'adresse que déclare le proxy. */
const newVisitor = async (browser: Browser, ip = nextVisitorIp()) => {
  const context = await browser.newContext({
    locale: 'fr-FR',
    extraHTTPHeaders: {'x-forwarded-for': ip},
  })
  return context.newPage()
}

const field = (page: Page, name: RegExp | string) =>
  page.getByRole('textbox', {name})

const categorySelect = (page: Page) =>
  page.getByRole('combobox', {name: 'De quoi s’agit-il ?'})

/** Ouvre `/signaler` une fois hydraté : sinon le formulaire partirait en GET. */
const openReportForm = async (page: Page, base = TENANT_A) => {
  await page.goto(`${base}${REPORT_ROUTE}`, {waitUntil: 'networkidle'})
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Signaler une fuite ou un incident',
    })
  ).toBeVisible({timeout: 15_000})
}

type ReportInput = {
  category?: string
  location: string
  description: string
  name?: string
  email?: string
  phone?: string
}

const fillAndSubmitReport = async (page: Page, input: ReportInput) => {
  await openReportForm(page)
  if (input.category) {
    await categorySelect(page).click()
    await page.getByRole('option', {name: input.category}).click()
  }
  await field(page, 'Où ?').fill(input.location)
  await field(page, 'Que se passe-t-il ?').fill(input.description)
  if (input.name) await field(page, /Votre nom/).fill(input.name)
  if (input.email) await field(page, /Votre adresse email/).fill(input.email)
  if (input.phone) await field(page, /Votre téléphone/).fill(input.phone)
  await page.getByRole('button', {name: 'Envoyer le signalement'}).click()
}

const expectSent = async (page: Page) =>
  expect(
    page.getByRole('status').filter({hasText: 'Signalement envoyé.'})
  ).toBeVisible({timeout: 15_000})

/** Un visiteur neuf envoie un signalement ; rend les emails qu'il a déclenchés. */
const reportAndReadEmails = async (
  browser: Browser,
  input: ReportInput,
  expectedEmails: number
): Promise<OutboxMessage[]> => {
  const before = outboxFiles()
  const visitor = await newVisitor(browser)
  try {
    await fillAndSubmitReport(visitor, input)
    await expectSent(visitor)
  } finally {
    await visitor.context().close()
  }

  await expect
    .poll(() => emailsAbout(before, input.location).length, {timeout: 10_000})
    .toBe(expectedEmails)
  return emailsAbout(before, input.location)
}

const openReportsList = async (page: Page, base = TENANT_A) => {
  await page.goto(`${base}${REPORTS_ROUTE}`, {waitUntil: 'load'})
  await expect(
    page.getByRole('heading', {level: 1, name: 'Signalements'})
  ).toBeVisible({timeout: 20_000})
}

/** Les lignes du tableau (la vue en cartes est masquée en desktop). */
const tableRows = (page: Page) => page.getByRole('table').locator('tbody tr')

const rowOf = (page: Page, text: string) =>
  tableRows(page).filter({hasText: text})

const openCategories = async (page: Page, base = TENANT_A) => {
  await page.goto(`${base}${CATEGORIES_ROUTE}`, {waitUntil: 'load'})
  await expect(
    page.getByRole('heading', {level: 1, name: 'Catégories de signalement'})
  ).toBeVisible({timeout: 20_000})
}

const addCategoryThroughDialog = async (
  page: Page,
  name: string,
  routingEmail = ''
) => {
  await page.getByRole('button', {name: 'Ajouter une catégorie'}).click()
  const dialog = page.getByRole('dialog', {name: 'Ajouter une catégorie'})
  await dialog.getByRole('textbox', {name: 'Nom de la catégorie'}).fill(name)
  await dialog
    .getByRole('textbox', {name: /Adresse de routage/})
    .fill(routingEmail)
  await dialog.getByRole('button', {name: 'Enregistrer la catégorie'}).click()
}

const changeSettingOfTenantA = async (
  page: Page,
  label: RegExp | string,
  value: string
) => {
  await page.goto(`${TENANT_A}${SETTINGS_ROUTE}`, {waitUntil: 'load'})
  await expect(
    page.getByRole('heading', {level: 1, name: "Réglages de l'association"})
  ).toBeVisible({timeout: 15_000})
  await page
    .getByLabel(label, typeof label === 'string' ? {exact: true} : undefined)
    .fill(value)
  await page.getByRole('button', {name: 'Enregistrer les réglages'}).click()
  await expect(page.getByText(SETTINGS_SAVED)).toBeVisible({timeout: 15_000})
}

/**
 * La fenêtre du limiteur est l'heure pleine : un cas qui enjambe un changement
 * d'heure verrait son compteur repartir à zéro.
 */
const awayFromHourBoundary = async (page: Page) => {
  const now = new Date()
  const untilNextHour =
    (60 - now.getUTCMinutes()) * 60_000 - now.getUTCSeconds() * 1000
  if (untilNextHour < 90_000) await page.waitForTimeout(untilNextHour + 2000)
}

test.describe('Signalements — envoi, notification, suivi, catégories', () => {
  test.afterAll(async () => {
    await cleanUpRun()
  })

  test('critères 1 et 2 — enregistré, confirmé, notifié au contact et à la catégorie, en tête de file avec « Signalé »', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const contact = await storedContactOfTenantA()
    const leak = markerOf('Chemin des Pins, parcelle 47')

    const emails = await reportAndReadEmails(
      browser,
      {
        category: "Fuite d'eau",
        location: leak,
        description: 'L’eau sort de la chaussée.\nÇa coule fort.',
      },
      2
    )
    expect(emails.map((email) => email.to).sort()).toEqual(
      [contact, FORAGE_ADDRESS].sort()
    )
    const stored = await storedReportOfTenantA(leak)
    expect(stored, 'le signalement est écrit en base').toBeTruthy()
    expect(stored?.status).toBe('reported')
    for (const email of emails) {
      expect(email.subject).toContain('TechCorp Solutions')
      expect(email.subject).toContain("Fuite d'eau")
      expect(email.subject.replace(/^\[DEV\] /, '').length).toBeLessThanOrEqual(
        60
      )
      expect(email.text).toContain(`/bureau/signalements/${stored?.id}`)
    }

    const road = markerOf('Allée des Chênes')
    const roadEmails = await reportAndReadEmails(
      browser,
      {
        category: 'Voirie et chemins',
        location: road,
        description: 'Un nid-de-poule.',
      },
      1
    )
    expect(roadEmails[0].to).toBe(contact)

    const board = await newSession(browser, TENANT_A, OWNER_A)
    try {
      await openReportsList(board)
      await expect(tableRows(board).first()).toContainText(road)
      await expect(rowOf(board, leak)).toContainText("Fuite d'eau")
      await expect(rowOf(board, leak)).toContainText('Signalé')
      await expect(rowOf(board, leak)).toContainText('Anonyme')
    } finally {
      await board.context().close()
    }
  })

  test('critère 3 — signalé → en cours → résolu, chaque changement horodaté et attribué', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const location = markerOf('Lampadaire de l’entrée nord')
    await reportAndReadEmails(
      browser,
      {category: 'Éclairage', location, description: 'Éteint.'},
      1
    )
    const stored = await storedReportOfTenantA(location)

    const board = await newSession(browser, TENANT_A, OWNER_A)
    try {
      await openReportsList(board)
      await rowOf(board, location)
        .getByRole('link', {name: 'Ouvrir le signalement'})
        .click()
      await expect(
        board.getByRole('heading', {level: 1, name: 'Éclairage'})
      ).toBeVisible({timeout: 15_000})

      await board.getByRole('button', {name: 'Passer en cours'}).click()
      await expect(
        board
          .getByRole('status')
          .filter({hasText: 'Signalement passé en cours.'})
      ).toBeVisible({timeout: 15_000})
      await board.getByRole('button', {name: 'Marquer comme résolu'}).click()
      await expect(board.getByText('Signalement résolu.')).toBeVisible({
        timeout: 15_000,
      })
      await expect(board.getByRole('button')).toHaveCount(0)

      const history = board
        .getByRole('list', {name: 'Historique du signalement'})
        .getByRole('listitem')
      await expect(history).toHaveCount(3)
      await expect(history.nth(0)).toContainText('Signalé depuis le site')
      await expect(history.nth(1)).toContainText('Passé en cours par Julien')
      await expect(history.nth(2)).toContainText(
        'Marqué comme résolu par Julien'
      )
    } finally {
      await board.context().close()
    }

    const ownerId = await withAppRoleClient(async (client) => {
      const result = await client.query<{id: string}>(
        `select id from "user" where email = $1`,
        [OWNER_A]
      )
      return result.rows[0].id
    })
    const events = await eventsOf(stored?.id as string)
    expect(events.map((event) => event.status)).toEqual([
      'reported',
      'in_progress',
      'resolved',
    ])
    expect(events[0]).toMatchObject({author_user_id: null, author_name: null})
    for (const event of events.slice(1)) {
      expect(event).toMatchObject({
        author_user_id: ownerId,
        author_name: 'Julien',
      })
    }
    const times = events.map((event) => event.created_at.getTime())
    expect(times).toEqual([...times].sort((x, y) => x - y))
    expect((await storedReportOfTenantA(location))?.status).toBe('resolved')
  })

  test('critères 4 et 6 — catégories administrées ; l’adresse relue inchangée, vide lue comme absente ; la 11ᵉ refusée', async ({
    browser,
  }) => {
    test.setTimeout(150_000)
    const routed = `Routée ${RUN}`
    const routedAddress = `routage-${RUN}@techcorp-solutions.test`
    const unrouted = `Sans adresse ${RUN}`

    const board = await newSession(browser, TENANT_A, OWNER_A)
    try {
      await openCategories(board)
      await addCategoryThroughDialog(board, routed, routedAddress)
      await expect(
        board.getByRole('status').filter({hasText: `« ${routed} » enregistrée`})
      ).toBeVisible({timeout: 15_000})
      await expect(rowOf(board, routed)).toContainText(routedAddress)

      await addCategoryThroughDialog(board, unrouted, '   ')
      await expect(
        board
          .getByRole('status')
          .filter({hasText: `« ${unrouted} » enregistrée`})
      ).toBeVisible({timeout: 15_000})
      await expect(rowOf(board, unrouted).locator('td').nth(1)).toHaveText(
        'Aucune'
      )

      const stored = await categoriesOfTenantA()
      expect(stored.find((row) => row.name === routed)?.routing_email).toBe(
        routedAddress
      )
      expect(
        stored.find((row) => row.name === unrouted)?.routing_email
      ).toBeNull()

      await rowOf(board, routed).getByRole('button', {name: 'Modifier'}).click()
      const dialog = board.getByRole('dialog', {name: 'Modifier la catégorie'})
      await expect(
        dialog.getByRole('textbox', {name: /Adresse de routage/})
      ).toHaveValue(routedAddress)
      await dialog.getByRole('button', {name: 'Annuler'}).click()

      // Au plafond, le bouton reste actif et le refus s'écrit sous le titre.
      const {a} = await tenantIds()
      const active = stored.filter((row) => row.deleted_at === null).length
      await asMaintenance(async (client) => {
        for (let index = active; index < 10; index++) {
          await client.query(
            `insert into association_category (organization_id, domain, name)
             values ($1, 'report', $2)`,
            [a, `Remplissage ${index} ${RUN}`]
          )
        }
      })
      await openCategories(board)
      await expect(
        board.getByText('10 catégories sur 10 possibles.')
      ).toBeVisible()
      const add = board.getByRole('button', {name: 'Ajouter une catégorie'})
      await expect(add).toBeEnabled()
      await add.click()
      await expect(
        board
          .getByRole('alert')
          .filter({hasText: 'Vous avez déjà 10 catégories, le maximum.'})
      ).toBeVisible({timeout: 15_000})
    } finally {
      await asMaintenance((client) =>
        client.query(`delete from association_category where name like $1`, [
          `%${RUN}%`,
        ])
      )
      await board.context().close()
    }
  })

  test('critère 4 — la 11ᵉ est refusée par le serveur même quand l’écran ne la voyait pas venir', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const {a} = await tenantIds()
    const board = await newSession(browser, TENANT_A, OWNER_A)
    try {
      const active = (await categoriesOfTenantA()).filter(
        (row) => row.deleted_at === null
      ).length
      await asMaintenance(async (client) => {
        for (let index = active; index < 9; index++) {
          await client.query(
            `insert into association_category (organization_id, domain, name)
             values ($1, 'report', $2)`,
            [a, `Avant ${index} ${RUN}`]
          )
        }
      })
      await openCategories(board)
      await expect(
        board.getByText('9 catégories sur 10 possibles.')
      ).toBeVisible()
      await asMaintenance((client) =>
        client.query(
          `insert into association_category (organization_id, domain, name)
           values ($1, 'report', $2)`,
          [a, `Dixième ${RUN}`]
        )
      )

      await addCategoryThroughDialog(board, `Onzième ${RUN}`)
      await expect(
        board
          .getByRole('alert')
          .filter({hasText: 'Vous avez déjà 10 catégories, le maximum.'})
      ).toBeVisible({timeout: 15_000})
      expect(
        (await categoriesOfTenantA()).some(
          (row) => row.name === `Onzième ${RUN}`
        )
      ).toBe(false)
    } finally {
      await asMaintenance((client) =>
        client.query(`delete from association_category where name like $1`, [
          `%${RUN}%`,
        ])
      )
      await board.context().close()
    }
  })

  test('critère 5 — supprimer une catégorie garde ses signalements, avec son nom, et la retire du formulaire', async ({
    browser,
  }) => {
    test.setTimeout(150_000)
    const {a} = await tenantIds()
    const doomed = `Portail ${RUN}`
    await asMaintenance((client) =>
      client.query(
        `insert into association_category (organization_id, domain, name)
         values ($1, 'report', $2)`,
        [a, doomed]
      )
    )
    const location = markerOf('Portail sud bloqué')
    await reportAndReadEmails(
      browser,
      {category: doomed, location, description: 'Bloqué ouvert.'},
      1
    )

    const board = await newSession(browser, TENANT_A, OWNER_A)
    try {
      await openCategories(board)
      await rowOf(board, doomed).getByRole('button', {name: 'Modifier'}).click()
      await board
        .getByRole('dialog', {name: 'Modifier la catégorie'})
        .getByRole('button', {name: 'Supprimer la catégorie'})
        .click()
      const confirm = board.getByRole('alertdialog')
      await expect(confirm).toContainText(
        'Le signalement déjà reçu dans cette catégorie est conservé.'
      )
      await confirm
        .getByRole('button', {name: 'Supprimer la catégorie'})
        .click()
      await expect(
        board.getByRole('status').filter({hasText: `« ${doomed} » supprimée`})
      ).toBeVisible({timeout: 15_000})

      const stored = await storedReportOfTenantA(location)
      expect(stored, 'le signalement est conservé').toBeTruthy()
      expect(
        (await categoriesOfTenantA()).find((row) => row.name === doomed)
          ?.deleted_at
      ).not.toBeNull()

      await openReportsList(board)
      await expect(rowOf(board, location)).toContainText(doomed)
      await expect(rowOf(board, location)).toContainText('catégorie supprimée')
    } finally {
      await board.context().close()
    }

    const visitor = await newVisitor(browser)
    try {
      await openReportForm(visitor)
      await categorySelect(visitor).click()
      await expect(
        visitor.getByRole('option', {name: "Fuite d'eau"})
      ).toBeVisible()
      await expect(visitor.getByRole('option', {name: doomed})).toHaveCount(0)
    } finally {
      await visitor.context().close()
    }
  })

  test('critère 7 — l’adresse changée dans les Réglages reçoit le signalement suivant', async ({
    browser,
  }) => {
    test.setTimeout(150_000)
    const previous = await storedContactOfTenantA()
    const changed = `bureau-s10-${RUN}@techcorp-solutions.test`

    const beforeChange = await reportAndReadEmails(
      browser,
      {
        category: 'Nuisance',
        location: markerOf('Avant le changement'),
        description: 'Premier.',
      },
      1
    )
    expect(beforeChange[0].to).toBe(previous)

    const owner = await newSession(browser, TENANT_A, OWNER_A)
    try {
      await changeSettingOfTenantA(owner, 'Adresse de contact', changed)

      const afterChange = await reportAndReadEmails(
        browser,
        {
          category: 'Nuisance',
          location: markerOf('Après le changement'),
          description: 'Suivant.',
        },
        1
      )
      expect(afterChange[0].to).toBe(changed)
    } finally {
      await changeSettingOfTenantA(owner, 'Adresse de contact', previous)
      await owner.context().close()
    }
  })

  test('critère 8 — les coordonnées exactes d’un membre ne rattachent pas le signalement à ce membre', async ({
    browser,
  }) => {
    const location = markerOf('Clôture abîmée')
    await reportAndReadEmails(
      browser,
      {
        category: 'Voirie et chemins',
        location,
        description: 'Clôture couchée.',
        name: MEMBER_A.name,
        email: MEMBER_A.email,
      },
      1
    )

    const stored = await storedReportOfTenantA(location)
    expect(stored?.reporter_email).toBe(MEMBER_A.email)
    expect(stored?.member_id).toBeNull()
  })
})

test.describe('Signalements — limitation de débit (critère 9)', () => {
  test.afterAll(async () => {
    await cleanUpRun()
  })

  test('au-delà du seuil, la même adresse est refusée, saisie conservée ; une autre passe ; le compteur est partagé avec /contact', async ({
    browser,
  }) => {
    test.setTimeout(240_000)
    const owner = await newSession(browser, TENANT_A, OWNER_A)
    const sameIp = nextVisitorIp()
    const first = await newVisitor(browser, sameIp)
    const other = await newVisitor(browser)
    const sharedIp = nextVisitorIp()
    const shared = await newVisitor(browser, sharedIp)
    try {
      await awayFromHourBoundary(first)
      await changeSettingOfTenantA(owner, THRESHOLD_LABEL, '1')

      await fillAndSubmitReport(first, {
        category: 'Nuisance',
        location: markerOf('Premier signalement'),
        description: 'Premier.',
      })
      await expectSent(first)

      const kept = {
        location: markerOf('Signalement de trop'),
        description: 'Ce texte doit rester à l’écran.',
      }
      await fillAndSubmitReport(first, {category: 'Nuisance', ...kept})
      const refusal = first
        .getByRole('alert')
        .filter({hasText: 'coup sur coup'})
      await expect(refusal).toBeVisible({timeout: 15_000})
      await expect(refusal).toContainText(
        'Ce formulaire en accepte 1 par heure.'
      )
      await expect(refusal).toContainText('Votre texte est conservé.')
      await expect(field(first, 'Où ?')).toHaveValue(kept.location)
      await expect(field(first, 'Que se passe-t-il ?')).toHaveValue(
        kept.description
      )
      expect(await storedReportOfTenantA(kept.location)).toBeUndefined()

      await fillAndSubmitReport(other, {
        category: 'Nuisance',
        location: markerOf('Autre visiteur'),
        description: 'Un autre visiteur.',
      })
      await expectSent(other)

      // Même adresse : un message de contact, puis un signalement.
      await shared.goto(`${TENANT_A}${CONTACT_ROUTE}`, {
        waitUntil: 'networkidle',
      })
      await field(shared, 'Votre adresse email').fill('claire@example.fr')
      await field(shared, 'Objet').fill(markerOf('Message partagé'))
      await field(shared, 'Votre message').fill('Bonjour.')
      await shared.getByRole('button', {name: 'Envoyer le message'}).click()
      await expect(
        shared.getByRole('status').filter({hasText: 'Message envoyé.'})
      ).toBeVisible({timeout: 15_000})

      const afterContact = markerOf('Après un message')
      await fillAndSubmitReport(shared, {
        category: 'Nuisance',
        location: afterContact,
        description: 'Le compteur est partagé.',
      })
      await expect(
        shared.getByRole('alert').filter({hasText: 'coup sur coup'})
      ).toBeVisible({timeout: 15_000})
      expect(await storedReportOfTenantA(afterContact)).toBeUndefined()
    } finally {
      await changeSettingOfTenantA(owner, THRESHOLD_LABEL, '')
      await Promise.all([
        owner.context().close(),
        first.context().close(),
        other.context().close(),
        shared.context().close(),
      ])
    }
  })
})

test.describe('Signalements — isolation entre associations', () => {
  test.afterAll(async () => {
    await cleanUpRun()
  })

  test('le signalement et les catégories de TechCorp sont absents chez Marketing Pro', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const location = markerOf('Réservé à TechCorp')
    await reportAndReadEmails(
      browser,
      {category: "Fuite d'eau", location, description: 'Isolation.'},
      2
    )

    const boardB = await newSession(browser, TENANT_B, BOARD_B)
    try {
      await openReportsList(boardB, TENANT_B)
      await expect(boardB.getByText(location)).toHaveCount(0)

      await openCategories(boardB, TENANT_B)
      await expect(rowOf(boardB, 'Portail et clôtures')).toBeVisible()
      await expect(boardB.getByText("Fuite d'eau")).toHaveCount(0)
    } finally {
      await boardB.context().close()
    }

    const visitorB = await newVisitor(browser)
    try {
      await openReportForm(visitorB, TENANT_B)
      await categorySelect(visitorB).click()
      await expect(
        visitorB.getByRole('option', {name: 'Portail et clôtures'})
      ).toBeVisible()
      await expect(
        visitorB.getByRole('option', {name: "Fuite d'eau"})
      ).toHaveCount(0)
    } finally {
      await visitorB.context().close()
    }
  })

  test('la RLS refuse de lire un signalement, son historique et une catégorie depuis le scope de l’autre association', async () => {
    const ids = await tenantIds()
    const location = markerOf('Isolation RLS')

    const inserted = await inTenantScope(ids.a, async (client) => {
      const report = await client.query<{id: string}>(
        `insert into incident_report (organization_id, location, description)
         values ($1, $2, 'Isolation RLS') returning id`,
        [ids.a, location]
      )
      await client.query(
        `insert into incident_report_event (organization_id, report_id, status)
         values ($1, $2, 'reported')`,
        [ids.a, report.rows[0].id]
      )
      return report.rows[0].id
    })
    const leakCategoryId = await activeCategoryId("Fuite d'eau")

    const seenFromB = await inTenantScope(ids.b, async (client) => ({
      report: await client.query(
        `select id from incident_report where id = $1`,
        [inserted]
      ),
      events: await client.query(
        `select id from incident_report_event where report_id = $1`,
        [inserted]
      ),
      category: await client.query(
        `select id from association_category where id = $1`,
        [leakCategoryId]
      ),
    }))
    expect(seenFromB.report.rowCount, 'un oubli de scope ne fuite pas').toBe(0)
    expect(seenFromB.events.rowCount).toBe(0)
    expect(seenFromB.category.rowCount).toBe(0)

    const withoutScope = await withAppRoleClient((client) =>
      client.query(`select id from incident_report where id = $1`, [inserted])
    )
    expect(withoutScope.rowCount).toBe(0)
  })

  test('une catégorie de Marketing Pro soumise sur TechCorp est refusée, rien n’est écrit', async ({
    browser,
  }) => {
    test.setTimeout(90_000)
    const ids = await tenantIds()
    const categoryOfB = await inTenantScope(ids.b, async (client) => {
      const result = await client.query<{id: string}>(
        `select id from association_category where name = 'Portail et clôtures'`
      )
      return result.rows[0].id
    })
    const categoryOfA = await activeCategoryId("Fuite d'eau")
    const location = markerOf('Catégorie forgée')

    const visitor = await newVisitor(browser)
    try {
      // La requête de l'action part avec l'identifiant de TechCorp ; on le
      // remplace, en vol, par celui de Marketing Pro.
      await visitor.route(`${TENANT_A}${REPORT_ROUTE}`, async (route) => {
        const request = route.request()
        const body = request.postData()
        if (request.method() === 'POST' && body?.includes(categoryOfA)) {
          await route.continue({
            postData: body.replaceAll(categoryOfA, categoryOfB),
          })
          return
        }
        await route.continue()
      })

      await fillAndSubmitReport(visitor, {
        category: "Fuite d'eau",
        location,
        description: 'Identifiant forgé.',
      })
      await expect(
        visitor.getByText('Choisissez ce que vous signalez.')
      ).toBeVisible({timeout: 15_000})
    } finally {
      await visitor.context().close()
    }

    expect(await storedReportOfTenantA(location)).toBeUndefined()
  })
})
