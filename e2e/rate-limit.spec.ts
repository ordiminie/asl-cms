/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import {execFileSync} from 'node:child_process'
import {randomBytes} from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import {Browser, expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Limitation de débit des formulaires publics — s08b, critères 1 à 3.
 *
 * Spec **propre au limiteur** : elle pilote le formulaire de `/contact` parce
 * que c'est aujourd'hui son seul appelant, mais s10 l'étendra sans toucher à
 * la spec des messages. Ce que seuls une vraie base et un vrai serveur
 * prouvent : le seuil lu à chaque soumission, aucune IP en clair en base, et
 * surtout une purge **réellement efficace** sous RLS forcée, sur deux
 * associations — un test unitaire à repositories mockés reste vert sur une
 * purge qui n'efface rien.
 *
 * Chaque cas déclare sa propre adresse (`x-forwarded-for`, IPv6 de
 * documentation, propre à l'essai) : sans quoi les cas se polluent entre eux.
 *
 * `localhost` sert TechCorp Solutions, `127.0.0.1` Marketing Pro (seed).
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
/** TechCorp Solutions dans le seed. */
const TENANT_A = `http://localhost:${PORT}`

const PASSWORD = 'Azerty123'
/** Présidente de TechCorp Solutions. */
const OWNER_A = 'user-owner@gmail.com'

const CONTACT_ROUTE = '/fr/contact'
const SETTINGS_ROUTE = '/fr/bureau/reglages'
const SETTINGS_SAVED =
  'Réglages enregistrés. Les prochains messages partiront vers ces adresses.'
const THRESHOLD_LABEL = /Nombre de messages par heure et par visiteur/

const PURGE_SCRIPT = 'src/db/scripts/purge-rate-limit-fingerprints.ts'

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
const RUN_GROUP = randomBytes(2).toString('hex')
/** Adresse IPv6 de documentation, propre à cet essai et à ce cas. */
const visitorIp = (label: number) => `2001:db8:58b:${RUN_GROUP}::${label}`
const subjectOf = (label: string) => `${label} s08b-${RUN}`

const VISITOR = {
  name: 'Claire Meunier',
  email: 'claire.meunier@example.fr',
}

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
      'DATABASE_URL introuvable : la preuve de la purge attaque la base en direct.'
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

/** Lecture ou écriture de contrôle, hors scope : le seul `bypass` de la spec. */
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

/** Une empreinte factice, au format réel : 64 caractères hexadécimaux. */
const fakeFingerprint = () => randomBytes(32).toString('hex')

/** Insère une empreinte dont la fenêtre a commencé il y a `hoursAgo` heures. */
const insertFingerprint = (organizationId: string, hoursAgo: number) => {
  const fingerprint = fakeFingerprint()
  return asMaintenance(async (client) => {
    await client.query(
      `insert into rate_limit_event (organization_id, fingerprint, window_start)
       values ($1, $2, now() - make_interval(hours => $3))`,
      [organizationId, fingerprint, hoursAgo]
    )
    return fingerprint
  })
}

const remainingOf = (fingerprints: string[]) =>
  asMaintenance(async (client) => {
    const result = await client.query<{fingerprint: string}>(
      `select fingerprint from rate_limit_event where fingerprint = any($1)`,
      [fingerprints]
    )
    return result.rows.map((row) => row.fingerprint).sort()
  })

const deleteFingerprints = (fingerprints: string[]) =>
  asMaintenance((client) =>
    client.query(`delete from rate_limit_event where fingerprint = any($1)`, [
      fingerprints,
    ])
  )

const deleteMessagesOfRun = () =>
  asMaintenance((client) =>
    client.query(`delete from contact_message where subject like $1`, [
      `% s08b-${RUN}`,
    ])
  )

/**
 * La fenêtre est l'heure pleine : un cas qui enjambe un changement d'heure
 * verrait son compteur repartir à zéro. À moins d'une minute et demie de la
 * fin de l'heure, on attend la suivante.
 */
const awayFromHourBoundary = async (page: Page) => {
  const now = new Date()
  const untilNextHour =
    (60 - now.getUTCMinutes()) * 60_000 - now.getUTCSeconds() * 1000
  if (untilNextHour < 90_000) await page.waitForTimeout(untilNextHour + 2000)
}

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

/** Session du bureau ; le cookie `NEXT_LOCALE` fait répondre l'action en français. */
const newSession = async (browser: Browser, base: string, email: string) => {
  const context = await browser.newContext()
  await context.addCookies([{name: 'NEXT_LOCALE', value: 'fr', url: base}])
  const page = await context.newPage()
  await login(page, base, email)
  return page
}

/** Règle le seuil horaire de TechCorp ; une valeur vide rend le défaut. */
const setThresholdOfTenantA = async (page: Page, value: string) => {
  await page.goto(`${TENANT_A}${SETTINGS_ROUTE}`, {waitUntil: 'load'})
  await expect(
    page.getByRole('heading', {level: 1, name: "Réglages de l'association"})
  ).toBeVisible({timeout: 15_000})
  await page.getByLabel(THRESHOLD_LABEL).fill(value)
  await page.getByRole('button', {name: 'Enregistrer les réglages'}).click()
  await expect(page.getByText(SETTINGS_SAVED)).toBeVisible({timeout: 15_000})
}

/** Un visiteur, reconnu par l'adresse que déclare le proxy. */
const newVisitor = async (browser: Browser, ip: string) => {
  const context = await browser.newContext({
    locale: 'fr-FR',
    extraHTTPHeaders: {'x-forwarded-for': ip},
  })
  return context.newPage()
}

const field = (page: Page, name: RegExp | string) =>
  page.getByRole('textbox', {name})

/** Ouvre `/contact` une fois hydraté, remplit et envoie le formulaire. */
const submitMessage = async (
  page: Page,
  {subject, body}: {subject: string; body: string}
) => {
  await page.goto(`${TENANT_A}${CONTACT_ROUTE}`, {waitUntil: 'networkidle'})
  await expect(
    page.getByRole('heading', {level: 1, name: 'Contacter le bureau'})
  ).toBeVisible({timeout: 15_000})
  await field(page, /Votre nom/).fill(VISITOR.name)
  await field(page, 'Votre adresse email').fill(VISITOR.email)
  await field(page, 'Objet').fill(subject)
  await field(page, 'Votre message').fill(body)
  await page.getByRole('button', {name: 'Envoyer le message'}).click()
}

const expectSent = async (page: Page) =>
  expect(
    page.getByRole('status').filter({hasText: 'Message envoyé.'})
  ).toBeVisible({timeout: 15_000})

const refusal = (page: Page) =>
  page.getByRole('alert').filter({hasText: 'coup sur coup'})

test.describe('Limitation de débit des formulaires publics', () => {
  test.afterAll(async () => {
    await deleteMessagesOfRun()
  })

  test('critère 1 — au-delà du seuil réglé, la même adresse est refusée ; une autre passe ; le seuil est relu à chaque envoi', async ({
    browser,
  }) => {
    test.setTimeout(240_000)
    const owner = await newSession(browser, TENANT_A, OWNER_A)
    const first = await newVisitor(browser, visitorIp(1))
    const second = await newVisitor(browser, visitorIp(2))
    try {
      await awayFromHourBoundary(first)
      await setThresholdOfTenantA(owner, '1')

      await submitMessage(first, {
        subject: subjectOf('Premier envoi'),
        body: 'Premier message.',
      })
      await expectSent(first)

      const kept = {
        subject: subjectOf('Envoi de trop'),
        body: 'Ce texte doit rester à l’écran.',
      }
      await submitMessage(first, kept)
      await expect(refusal(first)).toBeVisible({timeout: 15_000})
      await expect(refusal(first)).toContainText(
        'Ce formulaire accepte 1 message par heure.'
      )
      await expect(refusal(first)).toContainText('Votre texte est conservé.')
      await expect(refusal(first)).toBeFocused()
      await expect(field(first, 'Objet')).toHaveValue(kept.subject)
      await expect(field(first, 'Votre message')).toHaveValue(kept.body)
      await expect(
        first.getByRole('button', {name: 'Envoyer le message'})
      ).toBeDisabled()

      await submitMessage(second, {
        subject: subjectOf('Autre visiteur'),
        body: 'Un autre visiteur.',
      })
      await expectSent(second)

      await setThresholdOfTenantA(owner, '3')
      await submitMessage(first, {
        subject: subjectOf('Après relèvement du seuil'),
        body: 'Le seuil a été relevé.',
      })
      await expectSent(first)
    } finally {
      await setThresholdOfTenantA(owner, '')
      await Promise.all([
        owner.context().close(),
        first.context().close(),
        second.context().close(),
      ])
    }
  })

  test('critère 2 — aucune adresse IP en clair : ni dans les messages, ni dans les compteurs', async () => {
    const ips = [visitorIp(1), visitorIp(2)]

    const leaks = await asMaintenance(async (client) => {
      const messages = await client.query<{count: string}>(
        `select count(*) from contact_message m
          where m::text like any($1)`,
        [ips.map((ip) => `%${ip}%`)]
      )
      const counters = await client.query<{count: string}>(
        `select count(*) from rate_limit_event e
          where e::text like any($1)`,
        [ips.map((ip) => `%${ip}%`)]
      )
      const malformed = await client.query<{fingerprint: string}>(
        `select fingerprint from rate_limit_event
          where fingerprint !~ '^[0-9a-f]{64}$'`
      )
      return {
        messages: Number(messages.rows[0].count),
        counters: Number(counters.rows[0].count),
        malformed: malformed.rows.map((row) => row.fingerprint),
      }
    })

    expect(leaks.messages).toBe(0)
    expect(leaks.counters).toBe(0)
    expect(leaks.malformed).toEqual([])
  })

  test('critère 3 — la purge seule efface les empreintes de plus de 24 h, sur les deux associations, et aucune autre', async () => {
    test.setTimeout(120_000)
    const {a, b} = await tenantIds()
    const oldOfA = await insertFingerprint(a, 25)
    const recentOfA = await insertFingerprint(a, 1)
    const recentOfB = await insertFingerprint(b, 1)
    const oldOfB = await insertFingerprint(b, 25)
    const all = [oldOfA, recentOfA, recentOfB, oldOfB]
    try {
      const output = execFileSync('pnpm', ['tsx', PURGE_SCRIPT], {
        env: {...process.env, DATABASE_URL: databaseUrl()},
        encoding: 'utf8',
        timeout: 90_000,
      })
      expect(output).toMatch(/Empreintes purgees : \d+/)

      expect(await remainingOf(all)).toEqual([recentOfA, recentOfB].sort())
    } finally {
      await deleteFingerprints(all)
    }
  })

  test('critère 3 — la même purge s’exécute à chaque envoi', async ({
    browser,
  }) => {
    test.setTimeout(90_000)
    const {a} = await tenantIds()
    const old = await insertFingerprint(a, 25)
    const recent = await insertFingerprint(a, 1)
    const visitor = await newVisitor(browser, visitorIp(3))
    try {
      await submitMessage(visitor, {
        subject: subjectOf('Purge à l’envoi'),
        body: 'Un envoi purge les empreintes expirées.',
      })
      await expectSent(visitor)

      expect(await remainingOf([old, recent])).toEqual([recent])
    } finally {
      await deleteFingerprints([old, recent])
      await visitor.context().close()
    }
  })
})
