/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import path from 'node:path'

import {expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Bandeau d'alerte — s07, critères 1 à 4.
 *
 * Ce que seuls un navigateur, deux domaines et un serveur de production
 * prouvent : le bandeau posé dans le gabarit commun paraît sur une page
 * publique **et** sur une page authentifiée ; le modifier le met à jour sans
 * redémarrage (preuve du `updateTag` — invisible en `pnpm dev`, où le cache est
 * froid) ; le retirer l'efface partout en laissant le message dans le champ ;
 * et il ne paraît jamais sur le domaine d'une autre association.
 *
 * Le bandeau est **global au tenant** et les specs tournent en parallèle en
 * local : chaque test qui l'active le retire dans un `finally`, puis efface
 * les deux lignes qu'il a créées — le retrait conserve le message par
 * conception, et `association-settings.spec.ts` attend de Marketing Pro son
 * seul jeu de paramètres du seed.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'

/** TechCorp Solutions dans le seed. */
const TENANT_A = `http://localhost:${PORT}`
/** Marketing Pro dans le seed. */
const TENANT_B = `http://127.0.0.1:${PORT}`

const PASSWORD = 'Azerty123'
/** Membre du bureau (rôle `board`) de Marketing Pro — critère 4. */
const BOARD_B = 'user-admin@gmail.com'
/** Membre simple de TechCorp Solutions, jamais du bureau. */
const MEMBER_A = 'user@gmail.com'

const ALERT_ROUTE = '/fr/bureau/alerte'
const ALERT_TITLE = 'Bandeau d’alerte'
const DENIED_TITLE = "Cette page est réservée au bureau de l'association"
const BANNER_LABEL = "Alerte de l'association"
/** Une page publique du socle, sous le gabarit du site public. */
const PUBLIC_ROUTE = '/fr/privacy'
/** Une page authentifiée, sous le gabarit à barre latérale du bureau. */
const AUTHENTICATED_ROUTE = '/fr/bureau/pages'

const ALERT_SETTING_KEYS = ['site.alert_message', 'site.alert_active']

const databaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const testEnvPath = path.resolve(process.cwd(), '.env.test')
  const parsed = fs.existsSync(testEnvPath)
    ? dotenv.parse(fs.readFileSync(testEnvPath))
    : {}

  const url = parsed.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL introuvable : le nettoyage attaque la base.')
  }
  return url
}

/**
 * Remet Marketing Pro dans l'état du seed : aucune ligne de bandeau. Sous le
 * rôle applicatif et le scope de l'association, comme le produit.
 */
const deleteStoredAlertOfTenantB = async () => {
  const client = new Client({connectionString: databaseUrl()})
  await client.connect()
  try {
    const result = await client.query<{id: string}>(
      `select id from organization where slug = 'marketing-pro'`
    )
    const organizationId = result.rows[0]?.id
    expect(organizationId, 'le seed doit porter Marketing Pro').toBeTruthy()

    await client.query('begin')
    await client.query(`select set_config('app.organization_id', $1, true)`, [
      organizationId,
    ])
    await client.query(
      `delete from organization_setting where organization_id = $1 and key = any($2)`,
      [organizationId, ALERT_SETTING_KEYS]
    )
    await client.query('commit')
  } finally {
    await client.end()
  }
}

const unique = (prefix: string) =>
  `${prefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`

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
 * Le bandeau du site : premier enfant de `<body>`, rendu par le gabarit
 * commun. L'aperçu de l'écran du bureau porte le même composant, mais pas à
 * cet endroit.
 */
const siteBanner = (page: Page) =>
  page.locator(`body > section[aria-label="${BANNER_LABEL}"]`)

const messageField = (page: Page) => page.getByLabel('Message de l’alerte')

const openAlertPage = async (page: Page, base: string) => {
  await page.goto(`${base}${ALERT_ROUTE}`, {waitUntil: 'load'})
  await expect(
    page.getByRole('heading', {level: 1, name: ALERT_TITLE})
  ).toBeVisible({timeout: 15_000})
}

/**
 * Saisit le message une fois le formulaire hydraté : l'aperçu ne suit la
 * frappe que lorsque l'état React l'a reçue, on réessaye tant qu'il ne l'a pas.
 */
const typeMessage = async (page: Page, message: string) => {
  await expect(async () => {
    await messageField(page).fill(message)
    await expect(
      page
        .getByRole('region', {name: BANNER_LABEL})
        .filter({hasText: message})
        .last()
    ).toBeVisible({timeout: 2000})
  }).toPass({timeout: 20_000})
}

/** Retire le bandeau s'il est affiché — nettoyage, quel que soit l'état. */
const removeBannerIfShown = async (page: Page, base: string) => {
  await openAlertPage(page, base)
  const remove = page.getByRole('button', {name: 'Retirer le bandeau'})
  if (await remove.isVisible()) {
    await remove.click()
    await expect(page.getByRole('status')).toContainText(
      'Bandeau retiré du site',
      {timeout: 15_000}
    )
  }
}

test.describe.configure({mode: 'serial'})

test.describe('Bandeau d’alerte — activation, modification, retrait', () => {
  test('un membre du bureau l’affiche partout, le modifie et le retire, sans toucher l’autre association', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000)
    const first = unique('Coupure d’eau rue des Pins')
    const second = unique('Travaux reportés au lundi')

    await login(page, TENANT_B, BOARD_B)

    try {
      // Critères 1 et 4 : un `board` l'affiche.
      await openAlertPage(page, TENANT_B)
      await typeMessage(page, first)
      await page
        .getByRole('button', {name: 'Afficher le bandeau sur le site'})
        .click()
      await expect(page.getByRole('status')).toContainText(
        'Bandeau affiché sur tout le site',
        {timeout: 15_000}
      )

      const visitor = await browser.newPage()
      await visitor.goto(`${TENANT_B}${PUBLIC_ROUTE}`, {waitUntil: 'load'})
      await expect(siteBanner(visitor)).toContainText(first)

      await page.goto(`${TENANT_B}${AUTHENTICATED_ROUTE}`, {waitUntil: 'load'})
      await expect(siteBanner(page)).toContainText(first)

      // Isolation : jamais sur le domaine de l'autre association.
      await visitor.goto(`${TENANT_A}${PUBLIC_ROUTE}`, {waitUntil: 'load'})
      await expect(visitor.locator('body')).toBeVisible()
      await expect(visitor.getByText(first)).toHaveCount(0)

      // Critère 2 : modifier le message le met à jour sans redémarrage.
      await openAlertPage(page, TENANT_B)
      await typeMessage(page, second)
      await page.getByRole('button', {name: 'Enregistrer le message'}).click()
      await expect(page.getByRole('status')).toContainText(
        'Bandeau affiché sur tout le site',
        {timeout: 15_000}
      )

      await visitor.goto(`${TENANT_B}${PUBLIC_ROUTE}`, {waitUntil: 'load'})
      await expect(siteBanner(visitor)).toContainText(second)
      await expect(visitor.getByText(first)).toHaveCount(0)

      // Critère 3 : le retirer l'efface partout, le message reste au champ.
      await openAlertPage(page, TENANT_B)
      await page.getByRole('button', {name: 'Retirer le bandeau'}).click()
      await expect(page.getByRole('status')).toContainText(
        'Bandeau retiré du site',
        {timeout: 15_000}
      )

      await visitor.goto(`${TENANT_B}${PUBLIC_ROUTE}`, {waitUntil: 'load'})
      await expect(siteBanner(visitor)).toHaveCount(0)
      await page.goto(`${TENANT_B}${AUTHENTICATED_ROUTE}`, {waitUntil: 'load'})
      await expect(siteBanner(page)).toHaveCount(0)

      await openAlertPage(page, TENANT_B)
      await expect(messageField(page)).toHaveValue(second)
      await expect(page.getByText('Bandeau masqué')).toBeVisible()

      await visitor.close()
    } finally {
      await removeBannerIfShown(page, TENANT_B)
      await deleteStoredAlertOfTenantB()
    }
  })
})

test.describe('Bandeau d’alerte — autorisation', () => {
  test('un membre simple ne voit pas l’écran du bandeau', async ({page}) => {
    await login(page, TENANT_A, MEMBER_A)

    await page.goto(`${TENANT_A}${ALERT_ROUTE}`, {waitUntil: 'load'})

    await expect(
      page.getByRole('heading', {level: 1, name: DENIED_TITLE})
    ).toBeVisible({timeout: 15_000})
    await expect(messageField(page)).toHaveCount(0)
  })
})
