/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import path from 'node:path'

import {Browser, expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Connexion par mot de passe — s03 (accès prestataire), puis s46b : inscription
 * fermée, connexion limitée à l'association du domaine (ADR 034) et
 * destination selon le rôle.
 *
 * `localhost` sert TechCorp Solutions (A), `127.0.0.1` Marketing Pro (B), comme
 * dans `tenant-isolation.spec.ts`.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
const TENANT_A = `http://localhost:${PORT}`
const TENANT_B = `http://127.0.0.1:${PORT}`

const PASSWORD = 'Azerty123'

/** Membre de A seulement. */
const MEMBER_A = 'user@gmail.com'
/** Présidence de A. */
const OWNER_A = 'user-owner@gmail.com'
/** Bureau de B. */
const BOARD_B = 'user-admin@gmail.com'
/** SuperAdmin, sans appartenance. */
const SUPER_ADMIN = 'superadmin@gmail.com'

const INVALID_CREDENTIALS = 'Identifiants invalides'
const NOT_FOUND_TITLE = 'Page non trouvée'

test.use({locale: 'fr-FR'})

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

const userCount = async (address: string) => {
  const client = new Client({connectionString: databaseUrl()})
  await client.connect()
  try {
    const result = await client.query<{count: string}>(
      `select count(*) from "user" where lower(email) = lower($1)`,
      [address]
    )
    return Number(result.rows[0].count)
  } finally {
    await client.end()
  }
}

const uniqueAddress = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@exemple.test`

const sessionCookiesOn = async (page: Page, origin: string) =>
  (await page.context().cookies(origin)).filter((cookie) =>
    cookie.name.includes('session_token')
  )

const newPage = async (browser: Browser) => {
  const context = await browser.newContext({locale: 'fr-FR'})
  return context.newPage()
}

/** Soumet le formulaire de l'accès prestataire sur `base`. */
const submitCredentials = async (
  page: Page,
  base: string,
  email: string,
  password = PASSWORD
) => {
  await page.goto(`${base}/login/prestataire`)
  await page.waitForLoadState('networkidle')
  await expect(page.locator('form')).toBeVisible()
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
}

/** Le message d'erreur rendu par le formulaire après un refus. */
const refusalMessage = async (page: Page) => {
  const message = page.locator('form .text-red-500').first()
  await expect(message).toBeVisible({timeout: 15_000})
  return message.textContent()
}

test.describe('accès prestataire — s03', () => {
  test('affiche le formulaire de connexion par mot de passe', async ({
    page,
  }) => {
    await page.goto(`${TENANT_A}/login/prestataire`)

    await expect(page.locator('form')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  // Ni l'écran de connexion par lien ni l'accès prestataire ne proposent
  // l'inscription (pas d'inscription libre, design system §7).
  test('les écrans de connexion ne proposent pas l’inscription', async ({
    page,
  }) => {
    await page.goto(`${TENANT_A}/login/prestataire`)
    await expect(page.locator('form')).toBeVisible()
    await expect(page.locator('a[href="/register"]')).toHaveCount(0)

    await page.goto(`${TENANT_A}/login`)
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('a[href="/register"]')).toHaveCount(0)
  })

  test('identifiants invalides : message générique, aucune session', async ({
    browser,
  }) => {
    const page = await newPage(browser)
    await submitCredentials(
      page,
      TENANT_A,
      uniqueAddress('inconnu'),
      'MotDePasseFaux1'
    )

    expect(await refusalMessage(page)).toBe(INVALID_CREDENTIALS)
    await expect(page).toHaveURL(/\/login\/prestataire/)
    expect(await sessionCookiesOn(page, TENANT_A)).toHaveLength(0)
    await page.context().close()
  })
})

test.describe('inscription fermée — s46b, critère 3', () => {
  // Une adresse à un segment sans page tombe sur la route des pages CMS, qui
  // streame : « introuvable » se lit sous un statut 200 (ADR 013).
  test('/register ne sert que « Page non trouvée », sans formulaire', async ({
    page,
  }) => {
    const response = await page.goto(`${TENANT_A}/register`, {
      waitUntil: 'load',
    })

    expect(response?.status()).toBe(200)
    await expect(page.getByText(NOT_FOUND_TITLE)).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
    await expect(page.locator('input[name="confirmPassword"]')).toHaveCount(0)
  })

  // L'en-tête Origin du domaine passe le contrôle d'origine de Better Auth :
  // le refus vient bien de `disableSignUp`.
  test('la création de compte adressée au serveur est refusée, aucun utilisateur créé', async ({
    request,
  }) => {
    const address = uniqueAddress('inscription')

    const response = await request.post(`${TENANT_A}/api/auth/sign-up/email`, {
      headers: {origin: TENANT_A},
      data: {name: 'Inscription', email: address, password: 'MotDePasse123!'},
    })

    expect(response.status()).toBe(400)
    expect((await response.json()).code).toBe('EMAIL_PASSWORD_SIGN_UP_DISABLED')
    expect(await userCount(address)).toBe(0)
  })
})

test.describe('connexion limitée à l’association du domaine — s46b, critère 2', () => {
  test('un membre de A refusé sur B reçoit le message d’une adresse inconnue, sans session', async ({
    browser,
  }) => {
    const unknownPage = await newPage(browser)
    await submitCredentials(
      unknownPage,
      TENANT_B,
      uniqueAddress('inconnu'),
      'MotDePasseFaux1'
    )
    const unknownMessage = await refusalMessage(unknownPage)
    await unknownPage.context().close()

    const page = await newPage(browser)
    await submitCredentials(page, TENANT_B, MEMBER_A)

    const refused = await refusalMessage(page)
    expect(refused).toBe(INVALID_CREDENTIALS)
    expect(refused).toBe(unknownMessage)
    await expect(page).toHaveURL(/\/login\/prestataire/)
    expect(await sessionCookiesOn(page, TENANT_B)).toHaveLength(0)
    expect(await sessionCookiesOn(page, TENANT_A)).toHaveLength(0)
    await page.context().close()
  })
})

test.describe('destination après connexion — s46b, critère 1', () => {
  for (const [who, base, email, destination] of [
    ['la Présidence de A, sur A', TENANT_A, OWNER_A, '/bureau/pages'],
    ['le bureau de B, sur B', TENANT_B, BOARD_B, '/bureau/pages'],
    ['un membre de A, sur A', TENANT_A, MEMBER_A, '/dashboard'],
    ['le SuperAdmin, sur A', TENANT_A, SUPER_ADMIN, '/admin'],
  ]) {
    test(`${who} arrive sur ${destination}`, async ({browser}) => {
      const page = await newPage(browser)
      await submitCredentials(page, base, email)

      await expect(page).toHaveURL(`${base}${destination}`, {
        timeout: 15_000,
      })
      expect(await sessionCookiesOn(page, base)).toHaveLength(1)
      await page.context().close()
    })
  }
})
