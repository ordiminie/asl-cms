/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {Browser, expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Connexion par lien — s03, critères 1 à 4 et 6 (le 5 est prouvé en unitaire,
 * et ici par la boîte de sortie du transport de test).
 *
 * Aucun email ne part : le serveur sous test envoie par le transport `file`
 * (`EMAIL_TRANSPORT=file`, ADR 005, ADR 017), qui écrit chaque message en JSON
 * dans `EMAIL_OUTBOX_DIR`. La spec lit cette boîte de sortie à la place d'une
 * vraie messagerie.
 *
 * Rejouable sur un serveur déjà lancé : les messages d'un essai sont ceux
 * apparus pendant cet essai (différence de la boîte avant / après), les
 * adresses inconnues sont uniques, et le jeton reculé en base est celui de
 * l'essai. `localhost` sert TechCorp Solutions (voir tenant-isolation).
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
const TENANT_A = `http://localhost:${PORT}`
const LOGIN_PAGE = `${TENANT_A}/fr/login`

const KNOWN_ADDRESS = 'user-owner@gmail.com'
const TENANT_A_SLUG = 'techcorp-solutions'
const TENANT_A_NAME = 'TechCorp Solutions'

const SENT_TITLE = 'Consultez votre boîte mail'
const INVALID_TITLE = 'Ce lien ne fonctionne plus'

/** Triplet d'en-tête de chaque teinte (design system §1.2). */
const ACCENT_SURFACES: Record<string, string> = {
  '195': '#E8F5F8',
  '150': '#E7F5EC',
  '255': '#EAF1FA',
  '40': '#F8EDE6',
  '300': '#F1ECF9',
  '95': '#F4F2E2',
}

type OutboxMessage = {
  from: string
  to: string
  subject: string
  html?: string
  text: string
  sentAt: string
}

test.use({locale: 'fr-FR'})

const outboxDir = () =>
  process.env.EMAIL_OUTBOX_DIR ??
  path.join(os.tmpdir(), 'asl-cms-email-outbox')

const outboxFiles = (): Set<string> => {
  const dir = outboxDir()
  return new Set(
    fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((file) => file.endsWith('.json'))
      : []
  )
}

/** Les messages écrits depuis `before`, adressés à `to`. */
const newMessagesTo = (before: Set<string>, to: string): OutboxMessage[] =>
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
    throw new Error('DATABASE_URL introuvable : la spec lit la base en direct.')
  }
  return parsed.DATABASE_URL
}

const withClient = async <T>(
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

/** Ce que l'email de TechCorp doit porter : logo PNG ou non, teinte. */
const tenantAIdentity = () =>
  withClient(async (client) => {
    const organization = await client.query<{
      id: string
      identity_logo_key: string | null
    }>(`select id, identity_logo_key from organization where slug = $1`, [
      TENANT_A_SLUG,
    ])
    const {id, identity_logo_key: logoKey} = organization.rows[0]

    await client.query('begin')
    try {
      await client.query(
        `select set_config('app.organization_id', $1, true)`,
        [id]
      )
      const hue = await client.query<{value: string}>(
        `select value from organization_setting
          where organization_id = $1 and key = 'identity.accent_hue'`,
        [id]
      )
      await client.query('commit')
      return {
        pngLogo: Boolean(logoKey?.endsWith('.png')),
        hue: hue.rows[0]?.value ?? '195',
      }
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  })

const userCount = (address: string) =>
  withClient(async (client) => {
    const result = await client.query<{count: string}>(
      `select count(*) from "user" where lower(email) = lower($1)`,
      [address]
    )
    return Number(result.rows[0].count)
  })

/** Le jeton en attente pour une adresse, lu en base (`storeToken: 'plain'`). */
const pendingTokenFor = (address: string) =>
  withClient(async (client) => {
    const result = await client.query<{identifier: string}>(
      `select identifier from verification
        where value like $1
        order by created_at desc limit 1`,
      [`%"email":"${address}"%`]
    )
    return result.rows[0]?.identifier
  })

const tokenTiming = (token: string) =>
  withClient(async (client) => {
    const result = await client.query<{validity_seconds: number}>(
      `select extract(epoch from (expires_at - created_at))::int
         as validity_seconds
        from verification where identifier = $1`,
      [token]
    )
    return result.rows[0]?.validity_seconds
  })

/** Recule l'émission et l'échéance du jeton : un lien vieux de 21 minutes. */
const ageToken = (token: string) =>
  withClient(async (client) => {
    await client.query(
      `update verification
          set created_at = created_at - interval '21 minutes',
              expires_at = expires_at - interval '21 minutes'
        where identifier = $1`,
      [token]
    )
  })

const requestLink = async (page: Page, address: string) => {
  await page.goto(LOGIN_PAGE)
  await page.getByLabel('Adresse email').fill(address)
  await page
    .getByRole('button', {name: 'Recevoir mon lien de connexion'})
    .click()
  await expect(
    page.getByRole('heading', {level: 1, name: SENT_TITLE})
  ).toBeVisible({timeout: 15_000})
}

/** Demande un lien pour l'adresse connue et rend le message reçu. */
const requestKnownLink = async (page: Page) => {
  const before = outboxFiles()
  await requestLink(page, KNOWN_ADDRESS)

  await expect
    .poll(() => newMessagesTo(before, KNOWN_ADDRESS).length, {timeout: 10_000})
    .toBe(1)
  return newMessagesTo(before, KNOWN_ADDRESS)[0]
}

const linkOf = (message: OutboxMessage) => {
  const link = message.text.match(/https?:\/\/\S+\/magic-link\/verify\?\S+/)?.[0]
  expect(link, 'la version texte porte l’URL en clair').toBeTruthy()
  return link as string
}

const expectInvalidLinkScreen = async (page: Page) => {
  await expect(page).toHaveURL(/\/login\/lien-invalide/)
  await expect(
    page.getByRole('heading', {level: 1, name: INVALID_TITLE})
  ).toBeVisible()
  const again = page.getByRole('link', {name: 'Recevoir un nouveau lien'})
  await expect(again).toBeVisible()
  await expect(again).toHaveAttribute('href', /\/login$/)
}

const freshPage = async (browser: Browser) =>
  (await browser.newContext({locale: 'fr-FR'})).newPage()

test.describe('connexion par lien — s03', () => {
  test('critères 1, 2 et 6 — lien reçu, session ouverte, rejeu refusé', async ({
    browser,
  }) => {
    const page = await freshPage(browser)
    const message = await requestKnownLink(page)

    // Critère 1 : écran d'attente explicite, conditionnel.
    await expect(page.getByText(/Si l'adresse .* est enregistrée/)).toBeVisible()

    // Critère 6 : l'en-tête de l'association du domaine appelé.
    const identity = await tenantAIdentity()
    expect(message.subject).toContain(
      `${TENANT_A_NAME} — votre lien de connexion`
    )
    expect(message.html).toContain(TENANT_A_NAME)
    expect(message.html?.toLowerCase()).toContain(
      ACCENT_SURFACES[identity.hue].toLowerCase()
    )
    if (identity.pngLogo) {
      expect(message.html).toMatch(
        new RegExp(`<img[^>]+alt="${TENANT_A_NAME}"`)
      )
      expect(message.html).toContain('/api/identity/logo?v=')
    } else {
      expect(message.html).not.toContain('<img')
    }

    // Critère 2 : le lien ouvre une session valide...
    const link = linkOf(message)
    await page.goto(link)
    await expect(page).toHaveURL(/\/dashboard/, {timeout: 15_000})
    const cookies = await page.context().cookies()
    expect(
      cookies.some((cookie) => cookie.name.includes('session_token'))
    ).toBe(true)
    await page.context().close()

    // ... et, rouvert, il est refusé avec un bouton pour en redemander un.
    const replay = await freshPage(browser)
    await replay.goto(link)
    await expectInvalidLinkScreen(replay)
    await replay.context().close()
  })

  test('critère 3 — un lien de plus de 20 minutes est refusé', async ({
    browser,
  }) => {
    const page = await freshPage(browser)
    const message = await requestKnownLink(page)
    const link = linkOf(message)
    const token = new URL(link).searchParams.get('token') as string

    // La durée est celle de la configuration, pas le défaut de la lib (300 s).
    const validity = await tokenTiming(token)
    expect(validity).toBeGreaterThanOrEqual(20 * 60 - 1)
    expect(validity).toBeLessThanOrEqual(20 * 60)

    await ageToken(token)
    await page.goto(link)
    await expectInvalidLinkScreen(page)
    await page.context().close()
  })

  test('critère 4 — adresse inconnue : même écran, aucun email, aucun compte', async ({
    browser,
  }) => {
    const unknown = `inconnu-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@exemple.test`

    const knownPage = await freshPage(browser)
    await requestLink(knownPage, KNOWN_ADDRESS)
    const knownText = (
      await knownPage.getByTestId('magic-link-sent').textContent()
    )?.replaceAll(KNOWN_ADDRESS, '{adresse}')
    await knownPage.context().close()

    const page = await freshPage(browser)
    const before = outboxFiles()
    await requestLink(page, unknown)

    // Même écran, au mot près.
    const unknownText = (
      await page.getByTestId('magic-link-sent').textContent()
    )?.replaceAll(unknown, '{adresse}')
    expect(unknownText).toBe(knownText)

    // Aucun email : l'action n'a répondu qu'après l'envoi éventuel.
    expect(newMessagesTo(before, unknown)).toHaveLength(0)

    // Aucun compte, même en suivant le jeton que Better Auth a tout de même
    // émis : `disableSignUp` refuse l'inscription et mène à l'écran C.
    const token = await pendingTokenFor(unknown)
    expect(token).toBeTruthy()
    await page.goto(
      `${TENANT_A}/api/auth/magic-link/verify?token=${token}` +
        `&callbackURL=%2Fdashboard&errorCallbackURL=%2Flogin%2Flien-invalide`
    )
    await expect(page).toHaveURL(/\/login\/lien-invalide/)
    expect(await userCount(unknown)).toBe(0)
    await page.context().close()
  })
})
