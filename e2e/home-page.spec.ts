/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import path from 'node:path'

import {Browser, expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Page d'accueil désignée par le bureau — s44, critères 1 à 6.
 *
 * Ce que seuls un navigateur, deux domaines, un serveur qui tourne et la base
 * attaquée en direct prouvent : `/` sert la page désignée avec la navigation
 * du site, une seule adresse pour les moteurs, le retour à l'accueil minimal
 * quand la page est dépubliée, son retour à la republication **sans
 * redéploiement ni redémarrage** (le tag de la page, décision C du plan),
 * l'étanchéité entre deux associations et le refus d'un membre hors bureau.
 *
 * Chaque scénario revient à « L'accueil automatique » avant de rendre la main,
 * par l'application : c'est l'action qui invalide le cache de `/`, une
 * écriture directe en base le laisserait servir la page aux specs suivantes.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'

/** TechCorp Solutions dans le seed. */
const TENANT_A = `http://localhost:${PORT}`
const TENANT_A_NAME = 'TechCorp Solutions'
/** Marketing Pro dans le seed. */
const TENANT_B = `http://127.0.0.1:${PORT}`
const TENANT_B_NAME = 'Marketing Pro'

const PASSWORD = 'Azerty123'
/** Présidente de TechCorp Solutions. */
const OWNER_A = 'user-owner@gmail.com'
/** Membre simple de TechCorp Solutions, jamais du bureau. */
const MEMBER_A = 'user@gmail.com'
/** Bureau de Marketing Pro. */
const BOARD_B = 'user-admin@gmail.com'

const HOME_PAGE_ROUTE = '/bureau/page-accueil'
const HOME_PAGE_TITLE = 'Page d’accueil'
const DENIED_TITLE = "Cette page est réservée au bureau de l'association"
const HOME_PAGE_SETTING_KEY = 'site.home_page_id'

const unique = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`

const databaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const testEnvPath = path.resolve(process.cwd(), '.env.test')
  const parsed = fs.existsSync(testEnvPath)
    ? dotenv.parse(fs.readFileSync(testEnvPath))
    : {}

  const url = parsed.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL introuvable : la preuve RLS attaque la base en direct.'
    )
  }
  return url
}

/**
 * Une connexion sous le **rôle applicatif**, celui de l'application (gabarit
 * de `tenant-isolation.spec.ts`) : la RLS forcée s'y applique.
 */
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

/** Une requête sous le scope d'une association, comme `withTenant`. */
const queryAs = async <T extends Record<string, unknown>>(
  client: Client,
  organizationId: string,
  sql: string,
  params: unknown[] = []
) => {
  await client.query('begin')
  try {
    await client.query(`select set_config('app.organization_id', $1, true)`, [
      organizationId,
    ])
    return await client.query<T>(sql, params)
  } finally {
    await client.query('commit')
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

/** La bande d'état de l'éditeur de s04 (gabarit de `site-navigation.spec.ts`). */
const editorStatus = (page: Page) => page.locator('[data-status]').first()

/** Crée une page en brouillon, titre et adresse renseignés, et l'enregistre. */
const createDraftPage = async (
  page: Page,
  base: string,
  title: string,
  slug: string
) => {
  await page.goto(`${base}/bureau/pages`, {waitUntil: 'load'})
  await page.getByRole('button', {name: 'Nouvelle page'}).click()
  await page.waitForURL(/\/bureau\/pages\/[0-9a-f-]{36}/, {timeout: 20_000})
  await expect(page.getByLabel('Adresse de la page')).toBeVisible({
    timeout: 20_000,
  })

  // La saisie n'est prise qu'une fois l'éditeur hydraté : « Modifications non
  // enregistrées » prouve que l'état a reçu la frappe.
  await expect(async () => {
    await page.getByLabel('Titre', {exact: true}).fill(title)
    await expect(page.getByText('Modifications non enregistrées')).toBeVisible({
      timeout: 2000,
    })
  }).toPass({timeout: 30_000})

  await page.getByLabel('Adresse de la page').fill(slug)
  await expect(page.getByLabel('Adresse de la page')).toHaveValue(slug)

  const editorUrl = page.url()
  await page.getByRole('button', {name: 'Enregistrer le brouillon'}).click()
  await expect(editorStatus(page)).toHaveAttribute('data-status', 'draft', {
    timeout: 20_000,
  })

  return editorUrl
}

const publishPage = async (page: Page, editorUrl: string) => {
  await page.goto(editorUrl, {waitUntil: 'load'})
  await expect(page.getByLabel('Adresse de la page')).toBeVisible({
    timeout: 20_000,
  })
  await expect(async () => {
    await page
      .getByRole('button', {name: 'Publier la page', exact: true})
      .click()
    await expect(editorStatus(page)).toHaveAttribute('data-status', 'live', {
      timeout: 5000,
    })
  }).toPass({timeout: 30_000})
}

const unpublishPage = async (page: Page, editorUrl: string) => {
  await page.goto(editorUrl, {waitUntil: 'load'})
  await expect(page.getByLabel('Adresse de la page')).toBeVisible({
    timeout: 20_000,
  })
  await expect(async () => {
    await page.getByRole('button', {name: 'Dépublier la page'}).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', {name: 'Dépublier la page'})
      .click({timeout: 5000})
    await expect(page.getByText('Dépubliée')).toBeVisible({timeout: 5000})
  }).toPass({timeout: 30_000})
}

const openHomePageScreen = async (page: Page, base: string) => {
  await page.goto(`${base}${HOME_PAGE_ROUTE}`, {waitUntil: 'load'})
  await expect(
    page.getByRole('heading', {level: 1, name: HOME_PAGE_TITLE})
  ).toBeVisible({timeout: 20_000})
}

/**
 * Désigne la page de ce titre comme accueil. L'écran peut ne pas être encore
 * hydraté au premier clic : on réessaye jusqu'à l'accusé d'enregistrement,
 * écrit dans la page (jamais un toast).
 */
const designateHomePage = async (page: Page, base: string, title: string) => {
  await openHomePageScreen(page, base)
  await expect(async () => {
    await page.getByRole('radio', {name: /Une page du site/}).click()
    await page.getByRole('combobox', {name: 'Page choisie'}).click()
    await page.getByRole('option', {name: title}).click({timeout: 5000})
    await page.getByRole('button', {name: 'Enregistrer l’accueil'}).click()
    await expect(
      page.getByRole('status').filter({
        hasText: `Les visiteurs voient maintenant la page « ${title} »`,
      })
    ).toBeVisible({timeout: 5000})
  }).toPass({timeout: 30_000})
}

/** Revient à l'accueil automatique, par l'application (invalide le cache). */
const resetHomePage = async (page: Page, base: string) => {
  await openHomePageScreen(page, base)
  await expect(async () => {
    await page.getByRole('radio', {name: /L’accueil automatique/}).click()
    await page.getByRole('button', {name: 'Enregistrer l’accueil'}).click()
    await expect(
      page.getByRole('status').filter({
        hasText: 'Les visiteurs voient maintenant l’accueil automatique',
      })
    ).toBeVisible({timeout: 5000})
  }).toPass({timeout: 30_000})
}

const newVisitor = async (browser: Browser) => {
  const context = await browser.newContext()
  return {context, page: await context.newPage()}
}

const canonicalOf = async (page: Page) =>
  page.locator('link[rel="canonical"]').getAttribute('href')

/**
 * `http://hote/` et `http://hote` sont la même adresse pour un moteur, et le
 * rendu des métadonnées de Next retire la barre finale d'une URL réduite à
 * son origine. On compare donc des adresses normalisées.
 */
const sameAddress = (url: string | null) =>
  url === null ? null : url.replace(/^(https?:\/\/[^/]+)\/$/, '$1')

const sitemapUrls = async (page: Page, base: string): Promise<string[]> => {
  const response = await page.request.get(`${base}/sitemap.xml`)
  expect(response.ok()).toBe(true)
  const xml = await response.text()
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
}

test.describe.configure({mode: 'serial'})

test.describe('Page d’accueil — cycle complet', () => {
  test('désigner, dépublier, republier : / suit, sans redéploiement (critères 1, 2, 5, 6)', async ({
    page,
    browser,
  }) => {
    const title = unique('Bienvenue')
    const slug = unique('bienvenue')

    await login(page, TENANT_A, OWNER_A)
    const editorUrl = await createDraftPage(page, TENANT_A, title, slug)
    await publishPage(page, editorUrl)
    await designateHomePage(page, TENANT_A, title)

    try {
      // Critère 1 : `/` sert la page désignée, dans le cadre du site public.
      const visitor = await newVisitor(browser)
      await visitor.page.goto(`${TENANT_A}/`, {waitUntil: 'load'})
      await expect(
        visitor.page.getByRole('heading', {level: 1, name: title})
      ).toBeVisible({timeout: 20_000})
      await expect(visitor.page.getByRole('banner')).toBeVisible()

      // Critère 6 : une seule adresse pour les moteurs.
      const rootCanonical = sameAddress(await canonicalOf(visitor.page))
      expect(rootCanonical).toBe(sameAddress(`${TENANT_A}/`))
      await visitor.page.goto(`${TENANT_A}/${slug}`, {waitUntil: 'load'})
      await expect(
        visitor.page.getByRole('heading', {level: 1, name: title})
      ).toBeVisible({timeout: 20_000})
      expect(sameAddress(await canonicalOf(visitor.page))).toBe(rootCanonical)

      const urls = (await sitemapUrls(visitor.page, TENANT_A)).map(sameAddress)
      expect(
        urls.filter((url) => url === sameAddress(`${TENANT_A}/`))
      ).toHaveLength(1)
      expect(urls).not.toContain(`${TENANT_A}/${slug}`)

      // Critère 2 : dépubliée, l'accueil automatique reprend la main…
      await unpublishPage(page, editorUrl)
      await visitor.page.goto(`${TENANT_A}/`, {waitUntil: 'load'})
      await expect(
        visitor.page.getByRole('heading', {level: 1, name: TENANT_A_NAME})
      ).toBeVisible({timeout: 20_000})
      await expect(visitor.page.getByText(title)).toHaveCount(0)

      // … et l'écran du bureau le dit, le choix étant conservé.
      await openHomePageScreen(page, TENANT_A)
      await expect(
        page.getByRole('alert').filter({
          hasText: `La page « ${title} » n’est plus publiée.`,
        })
      ).toBeVisible()

      // Critère 5 : republiée, elle redevient l'accueil à la requête suivante.
      await publishPage(page, editorUrl)
      await visitor.page.goto(`${TENANT_A}/`, {waitUntil: 'load'})
      await expect(
        visitor.page.getByRole('heading', {level: 1, name: title})
      ).toBeVisible({timeout: 20_000})

      await visitor.context.close()
    } finally {
      await resetHomePage(page, TENANT_A)
    }

    const after = await newVisitor(browser)
    await after.page.goto(`${TENANT_A}/`, {waitUntil: 'load'})
    await expect(
      after.page.getByRole('heading', {level: 1, name: TENANT_A_NAME})
    ).toBeVisible({timeout: 20_000})
    await after.context.close()
  })
})

test.describe('Page d’accueil — accès croisé (critère 3)', () => {
  test('la page désignée par A ne sort ni sur le domaine de B, ni sous le scope de B en base', async ({
    page,
    browser,
  }) => {
    const title = unique('Accueil A')
    const slug = unique('accueil-a')

    await login(page, TENANT_A, OWNER_A)
    const editorUrl = await createDraftPage(page, TENANT_A, title, slug)
    await publishPage(page, editorUrl)
    await designateHomePage(page, TENANT_A, title)

    try {
      // Côté interface : B sert son propre accueil minimal.
      const visitor = await newVisitor(browser)
      await visitor.page.goto(`${TENANT_B}/`, {waitUntil: 'load'})
      await expect(
        visitor.page.getByRole('heading', {level: 1, name: TENANT_B_NAME})
      ).toBeVisible({timeout: 20_000})
      await expect(visitor.page.getByText(title)).toHaveCount(0)
      await visitor.context.close()

      // Le bureau de B ne se voit jamais proposer la page de A. B publie sa
      // propre page d'abord : le choix « Une page du site » est alors actif
      // quel que soit l'état laissé par les autres specs, et la liste ouverte
      // prouve que l'absence de la page de A n'est pas une liste jamais vue.
      const boardB = await newVisitor(browser)
      await login(boardB.page, TENANT_B, BOARD_B)
      const titleOfB = unique('Page B')
      const editorUrlOfB = await createDraftPage(
        boardB.page,
        TENANT_B,
        titleOfB,
        unique('page-b')
      )
      await publishPage(boardB.page, editorUrlOfB)

      await openHomePageScreen(boardB.page, TENANT_B)
      const pageChoice = boardB.page.getByRole('radio', {
        name: /Une page du site/,
      })
      await expect(pageChoice).toBeEnabled()
      await expect(async () => {
        await pageChoice.click()
        await boardB.page
          .getByRole('combobox', {name: 'Page choisie'})
          .click({timeout: 5000})
        await expect(
          boardB.page.getByRole('option', {name: titleOfB})
        ).toBeVisible({timeout: 5000})
      }).toPass({timeout: 30_000})
      await expect(boardB.page.getByRole('option', {name: title})).toHaveCount(
        0
      )
      await expect(boardB.page.getByText(title)).toHaveCount(0)
      await boardB.context.close()

      // Côté base, sous le rôle applicatif : sous le scope de B, ni la ligne
      // du choix de A ni la page désignée ne sortent.
      await withAppRoleClient(async (client) => {
        const {a, b} = await tenantIds(client)

        const choiceOfA = await queryAs<{value: string}>(
          client,
          a,
          `select value from organization_setting where organization_id = $1 and key = $2`,
          [a, HOME_PAGE_SETTING_KEY]
        )
        const designatedId = choiceOfA.rows[0]?.value
        expect(designatedId, 'A doit avoir désigné sa page').toBeTruthy()

        const settingFromB = await queryAs(
          client,
          b,
          `select value from organization_setting where organization_id = $1 and key = $2`,
          [a, HOME_PAGE_SETTING_KEY]
        )
        expect(settingFromB.rowCount).toBe(0)

        const pageFromB = await queryAs(
          client,
          b,
          `select id from page where id = $1`,
          [designatedId]
        )
        expect(pageFromB.rowCount).toBe(0)
      })
    } finally {
      await resetHomePage(page, TENANT_A)
    }
  })
})

test.describe('Page d’accueil — autorisation (critère 4)', () => {
  test('un membre non-bureau ne peut pas changer l’accueil', async ({page}) => {
    await login(page, TENANT_A, MEMBER_A)
    await page.goto(`${TENANT_A}${HOME_PAGE_ROUTE}`, {waitUntil: 'load'})

    await expect(page.getByText(DENIED_TITLE)).toBeVisible({timeout: 20_000})
    await expect(page.getByRole('radio')).toHaveCount(0)
    await expect(
      page.getByRole('button', {name: 'Enregistrer l’accueil'})
    ).toHaveCount(0)
  })
})
