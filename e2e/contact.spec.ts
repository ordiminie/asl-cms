/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {Browser, expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Formulaire de contact et messages reçus — s08, critères 1 à 4.
 *
 * Ce que seuls un navigateur, deux domaines et une vraie base prouvent : le
 * message écrit depuis `/contact` arrive dans `contact_message` **et** dans la
 * boîte de sortie du transport `file` (`EMAIL_TRANSPORT=file`, ADR 005), à
 * l'adresse lue **à l'envoi** dans les paramètres de l'association ; un envoi
 * invalide n'écrit rien et n'envoie rien ; le bureau lit la liste et le détail,
 * et le témoin lu / non lu suit ; enfin la RLS isole les deux associations.
 *
 * `localhost` sert TechCorp Solutions, `127.0.0.1` Marketing Pro (seed).
 * L'adresse de contact changée au critère 4 est remise **par l'application**
 * à sa valeur de départ : les réglages sont en cache côté serveur.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
/** TechCorp Solutions dans le seed. */
const TENANT_A = `http://localhost:${PORT}`
/** Marketing Pro dans le seed. */
const TENANT_B = `http://127.0.0.1:${PORT}`
const TENANT_A_SLUG = 'techcorp-solutions'

const PASSWORD = 'Azerty123'
/** Présidente de TechCorp Solutions. */
const OWNER_A = 'user-owner@gmail.com'
/** Membre du bureau (rôle `board`) de Marketing Pro. */
const BOARD_B = 'user-admin@gmail.com'

const CONTACT_ROUTE = '/fr/contact'
const MESSAGES_ROUTE = '/fr/bureau/messages'
const SETTINGS_ROUTE = '/fr/bureau/reglages'
const SETTINGS_SAVED =
  'Réglages enregistrés. Les prochains messages partiront vers ces adresses.'

/**
 * Tous les envois de cette spec sortent par la même adresse, déclarée : le
 * limiteur de s08b lira cet en-tête, et sans lui tous les envois partageraient
 * `127.0.0.1` — la spec se couperait elle-même au-delà du seuil.
 */
const VISITOR_HEADERS = {'x-forwarded-for': '203.0.113.7'}

const VISITOR = {
  name: 'Claire Meunier',
  email: 'claire.meunier@example.fr',
}

type OutboxMessage = {
  from: string
  to: string
  subject: string
  html?: string
  text: string
}

test.use({locale: 'fr-FR', extraHTTPHeaders: VISITOR_HEADERS})
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

/** Les messages écrits dans la boîte de sortie depuis `before`. */
const newMessagesSince = (before: Set<string>): OutboxMessage[] =>
  [...outboxFiles()]
    .filter((file) => !before.has(file))
    .map(
      (file) =>
        JSON.parse(
          fs.readFileSync(path.join(outboxDir(), file), 'utf8')
        ) as OutboxMessage
    )

const databaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const testEnvPath = path.resolve(process.cwd(), '.env.test')
  const parsed = fs.existsSync(testEnvPath)
    ? dotenv.parse(fs.readFileSync(testEnvPath))
    : {}
  if (!parsed.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL introuvable : la preuve RLS attaque la base en direct.'
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

const tenantIds = async (client: Client) => {
  const result = await client.query<{slug: string; id: string}>(
    `select slug, id from organization where slug in ('techcorp-solutions', 'marketing-pro')`
  )
  const bySlug = new Map(result.rows.map((row) => [row.slug, row.id]))
  const a = bySlug.get('techcorp-solutions')
  const b = bySlug.get('marketing-pro')
  expect(a, 'le seed doit porter les deux associations').toBeTruthy()
  expect(b, 'le seed doit porter les deux associations').toBeTruthy()
  return {a: a as string, b: b as string}
}

const inTenantScope = async <T>(
  client: Client,
  organizationId: string,
  callback: () => Promise<T>
): Promise<T> => {
  await client.query('begin')
  try {
    await client.query(`select set_config('app.organization_id', $1, true)`, [
      organizationId,
    ])
    const result = await callback()
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  }
}

/** Les messages de TechCorp, sous le scope de TechCorp, comme le produit. */
const storedMessagesOfTenantA = async () =>
  withAppRoleClient(async (client) => {
    const {a} = await tenantIds(client)
    return inTenantScope(client, a, async () => {
      const result = await client.query<{
        id: string
        subject: string
        read: boolean
      }>(`select id, subject, read from contact_message order by created_at`)
      return result.rows
    })
  })

const storedMessage = async (subject: string) =>
  (await storedMessagesOfTenantA()).find((row) => row.subject === subject)

/** L'adresse de notification de TechCorp, telle qu'enregistrée. */
const storedContactOfTenantA = async (): Promise<string> =>
  withAppRoleClient(async (client) => {
    const {a} = await tenantIds(client)
    return inTenantScope(client, a, async () => {
      const result = await client.query<{value: string}>(
        `select value from organization_setting where organization_id = $1 and key = 'contact.email'`,
        [a]
      )
      const value = result.rows[0]?.value
      expect(
        value,
        `${TENANT_A_SLUG} doit avoir une adresse de contact`
      ).toBeTruthy()
      return value
    })
  })

/** Chaque essai nettoie ses messages : une base locale se relit deux fois. */
const deleteMessagesLike = async (pattern: string) =>
  withAppRoleClient(async (client) => {
    await client.query('begin')
    await client.query(`select set_config('app.bypass_rls', 'on', true)`)
    await client.query(`delete from contact_message where subject like $1`, [
      pattern,
    ])
    await client.query('commit')
  })

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
const subjectOf = (label: string) => `${label} s08-${RUN}`

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

/**
 * Session du bureau. L'action des réglages (s02) lit la locale implicite de
 * next-intl, que seul le cookie `NEXT_LOCALE` lui donne ; or next-intl ne
 * l'écrit pas pour un navigateur déjà en `fr-FR` (la locale de cette spec), et
 * l'action répondrait en anglais. Le cookie est donc posé ici.
 */
const newSession = async (browser: Browser, base: string, email: string) => {
  const context = await browser.newContext()
  await context.addCookies([{name: 'NEXT_LOCALE', value: 'fr', url: base}])
  const page = await context.newPage()
  await login(page, base, email)
  return page
}

const field = (page: Page, name: RegExp | string) =>
  page.getByRole('textbox', {name})

/** Ouvre `/contact` une fois hydraté : sinon le formulaire partirait en GET. */
const openContactForm = async (page: Page, base: string) => {
  await page.goto(`${base}${CONTACT_ROUTE}`, {waitUntil: 'networkidle'})
  await expect(
    page.getByRole('heading', {level: 1, name: 'Contacter le bureau'})
  ).toBeVisible({timeout: 15_000})
}

const sendMessage = async (
  page: Page,
  base: string,
  {subject, body}: {subject: string; body: string}
) => {
  await openContactForm(page, base)
  await field(page, /Votre nom/).fill(VISITOR.name)
  await field(page, 'Votre adresse email').fill(VISITOR.email)
  await field(page, 'Objet').fill(subject)
  await field(page, 'Votre message').fill(body)
  await page.getByRole('button', {name: 'Envoyer le message'}).click()

  const success = page.getByRole('status').filter({hasText: 'Message envoyé.'})
  await expect(success).toBeVisible({timeout: 15_000})
  await expect(success).toContainText(VISITOR.email)
}

/** Envoie un message et rend l'email déposé pour lui dans la boîte de sortie. */
const sendMessageAndReadEmail = async (
  page: Page,
  message: {subject: string; body: string}
): Promise<OutboxMessage> => {
  const before = outboxFiles()
  await sendMessage(page, TENANT_A, message)

  const forThisMessage = () =>
    newMessagesSince(before).filter((email) =>
      email.text.includes(message.subject)
    )
  await expect.poll(() => forThisMessage().length, {timeout: 10_000}).toBe(1)
  return forThisMessage()[0]
}

const openMessagesList = async (page: Page, base: string) => {
  await page.goto(`${base}${MESSAGES_ROUTE}`, {waitUntil: 'load'})
  await expect(
    page.getByRole('heading', {level: 1, name: 'Messages reçus'})
  ).toBeVisible({timeout: 20_000})
}

/** Les lignes du tableau (la vue en cartes est masquée en desktop). */
const tableRows = (page: Page) => page.getByRole('table').locator('tbody tr')

const rowOf = (page: Page, subject: string) =>
  tableRows(page).filter({hasText: subject})

const changeContactOfTenantA = async (page: Page, address: string) => {
  await page.goto(`${TENANT_A}${SETTINGS_ROUTE}`, {waitUntil: 'load'})
  await expect(
    page.getByRole('heading', {level: 1, name: "Réglages de l'association"})
  ).toBeVisible({timeout: 15_000})
  await page.getByLabel('Adresse de contact', {exact: true}).fill(address)
  await page.getByRole('button', {name: 'Enregistrer les réglages'}).click()
  await expect(page.getByText(SETTINGS_SAVED)).toBeVisible({timeout: 15_000})
}

test.describe('Contact — envoi, notification, messages reçus', () => {
  test.afterAll(async () => {
    await deleteMessagesLike(`% s08-${RUN}`)
  })

  test('critères 1 et 3 — le message est enregistré, notifié, listé en tête puis ouvert', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000)
    const contact = await storedContactOfTenantA()
    const older = subjectOf('Branche cassée')
    const newer = subjectOf('Analyse d’eau du forage')
    const body = 'Bonjour,\nQuand paraît la prochaine analyse ?\nMerci.'

    const firstEmail = await sendMessageAndReadEmail(page, {
      subject: older,
      body: 'Une branche est tombée rue des Pins.',
    })
    expect(firstEmail.to).toBe(contact)

    const email = await sendMessageAndReadEmail(page, {subject: newer, body})
    expect(email.to).toBe(contact)
    expect(email.subject).toContain('TechCorp Solutions')
    expect(email.text).toContain(VISITOR.email)
    expect(email.html).toContain(`mailto:${VISITOR.email}`)
    const stored = await storedMessage(newer)
    expect(stored, 'le message est écrit en base').toBeTruthy()
    expect(email.text).toContain(`/bureau/messages/${stored?.id}`)

    const board = await newSession(browser, TENANT_A, OWNER_A)
    await openMessagesList(board, TENANT_A)

    const subjects = await tableRows(board)
      .locator('td:first-child')
      .allTextContents()
    expect(subjects.indexOf(newer)).toBeGreaterThanOrEqual(0)
    expect(subjects.indexOf(newer)).toBeLessThan(subjects.indexOf(older))
    await expect(rowOf(board, newer)).toContainText('Non lu')

    await rowOf(board, newer)
      .getByRole('link', {name: 'Ouvrir le message'})
      .click()
    await expect(
      board.getByRole('heading', {level: 1, name: newer})
    ).toBeVisible({timeout: 15_000})
    await expect(board.getByTestId('contact-message-body')).toHaveText(body)
    await expect(
      board.getByRole('link', {name: VISITOR.email})
    ).toHaveAttribute('href', `mailto:${VISITOR.email}`)

    // Critère 3 : lu à l'ouverture, non lu par le bouton.
    await expect.poll(async () => (await storedMessage(newer))?.read).toBe(true)
    await openMessagesList(board, TENANT_A)
    await expect(rowOf(board, newer)).toContainText('Lu')
    await expect(rowOf(board, newer)).not.toContainText('Non lu')

    await rowOf(board, newer)
      .getByRole('link', {name: 'Ouvrir le message'})
      .click()
    await expect(
      board.getByRole('heading', {level: 1, name: newer})
    ).toBeVisible({
      timeout: 15_000,
    })
    await expect.poll(async () => (await storedMessage(newer))?.read).toBe(true)
    await board.getByRole('button', {name: 'Marquer comme non lu'}).click()
    await expect(board.getByText('Marqué comme non lu.')).toBeVisible({
      timeout: 15_000,
    })
    await expect
      .poll(async () => (await storedMessage(newer))?.read)
      .toBe(false)

    await openMessagesList(board, TENANT_A)
    await expect(rowOf(board, newer)).toContainText('Non lu')

    await board.context().close()
  })

  test('critère 4 — l’adresse changée dans Réglages reçoit le message suivant', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000)
    const previous = await storedContactOfTenantA()
    const changed = `bureau-s08-${RUN}@techcorp-solutions.test`

    const beforeChange = await sendMessageAndReadEmail(page, {
      subject: subjectOf('Avant le changement'),
      body: 'Premier message.',
    })
    expect(beforeChange.to).toBe(previous)

    const owner = await newSession(browser, TENANT_A, OWNER_A)
    try {
      await changeContactOfTenantA(owner, changed)

      const afterChange = await sendMessageAndReadEmail(page, {
        subject: subjectOf('Après le changement'),
        body: 'Message suivant.',
      })
      expect(afterChange.to).toBe(changed)
    } finally {
      await changeContactOfTenantA(owner, previous)
      await owner.context().close()
    }
  })

  test('critère 2 — un envoi invalide affiche les erreurs par champ, n’écrit rien et n’envoie rien', async ({
    page,
  }) => {
    const subject = subjectOf('Envoi invalide')
    const storedBefore = (await storedMessagesOfTenantA()).length
    const before = outboxFiles()

    await openContactForm(page, TENANT_A)
    await field(page, 'Votre adresse email').fill('claire.meunier')
    await field(page, 'Objet').fill(subject)
    await page.getByRole('button', {name: 'Envoyer le message'}).click()

    const summary = page
      .getByRole('alert')
      .filter({hasText: 'Le message n’a pas été envoyé.'})
    await expect(summary).toBeVisible()
    await expect(summary).toBeFocused()
    await expect(
      summary.getByRole('link', {name: 'Votre adresse email'})
    ).toBeVisible()
    await expect(
      summary.getByRole('link', {name: 'Votre message'})
    ).toBeVisible()
    await expect(
      page.getByText(
        'Cette adresse email n’est pas valide. Vérifiez qu’elle contient un @ et un nom de domaine.'
      )
    ).toBeVisible()
    await expect(
      page.getByText('Écrivez votre message avant de l’envoyer.')
    ).toBeVisible()
    await expect(field(page, 'Objet')).toHaveValue(subject)

    expect((await storedMessagesOfTenantA()).length).toBe(storedBefore)
    // Filtré sur la notification de s08 : en local, les specs tournent en
    // parallèle et d'autres déposent leurs emails dans la même boîte.
    expect(
      newMessagesSince(before).filter((email) =>
        email.subject.includes('Nouveau message depuis le site')
      )
    ).toHaveLength(0)
  })
})

test.describe('Contact — isolation entre associations', () => {
  test.afterAll(async () => {
    await deleteMessagesLike(`% s08-${RUN}`)
  })

  test('le message de TechCorp est absent des messages de Marketing Pro', async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000)
    const subject = subjectOf('Réservé à TechCorp')
    await sendMessage(page, TENANT_A, {subject, body: 'Isolation.'})

    const boardB = await newSession(browser, TENANT_B, BOARD_B)
    await openMessagesList(boardB, TENANT_B)
    await expect(boardB.getByText(subject)).toHaveCount(0)
    await boardB.context().close()
  })

  test('la RLS refuse de lire un message depuis le scope de l’autre association', async () => {
    await withAppRoleClient(async (client) => {
      const ids = await tenantIds(client)

      const inserted = await inTenantScope(client, ids.a, async () => {
        const result = await client.query<{id: string}>(
          `insert into contact_message (organization_id, sender_email, subject, body)
           values ($1, 'isolation@example.test', $2, 'Isolation RLS') returning id`,
          [ids.a, subjectOf('Isolation RLS')]
        )
        return result.rows[0].id
      })

      const fromOtherTenant = await inTenantScope(client, ids.b, () =>
        client.query(`select id from contact_message where id = $1`, [inserted])
      )
      expect(
        fromOtherTenant.rowCount,
        'un oubli de scope ne fuite pas : il ne retourne rien'
      ).toBe(0)

      const withoutScope = await client.query(
        `select id from contact_message where id = $1`,
        [inserted]
      )
      expect(withoutScope.rowCount).toBe(0)

      await inTenantScope(client, ids.a, () =>
        client.query(`delete from contact_message where id = $1`, [inserted])
      )
    })
  })
})
