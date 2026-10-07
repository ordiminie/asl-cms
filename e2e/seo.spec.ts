/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import {APIRequestContext, Browser, expect, Page, test} from '@playwright/test'
import sharp from 'sharp'

/**
 * Référencement — s11, critères 1 à 5.
 *
 * Ce que seuls deux domaines et un vrai serveur prouvent : chaque association
 * sert son propre sitemap, son propre robots.txt et ses propres métadonnées ;
 * publier une page l'ajoute au sitemap à la requête suivante ; le code Google
 * saisi en back-office paraît chez l'une et jamais chez l'autre.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
/** TechCorp Solutions dans le seed. */
const TENANT_A = `http://localhost:${PORT}`
/** Marketing Pro dans le seed. */
const TENANT_B = `http://127.0.0.1:${PORT}`

const PASSWORD = 'Azerty123'
/** Présidente de TechCorp Solutions. */
const OWNER_A = 'user-owner@gmail.com'

const PAGES_ROUTE = '/bureau/pages'
const SETTINGS_ROUTE = '/bureau/reglages'
const SETTINGS_TITLE = "Réglages de l'association"

const GOOGLE_CODE = 'k3Jd8-QwX_9mLp2vRtY7aBcDeFgHiJ0kLmNoPq'
const SAVED_SEO =
  'Réglages enregistrés. Google en tiendra compte à son prochain passage sur le site.'

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
  const page = await browser.newPage()
  await login(page, base, email)
  return page
}

const uniqueSlug = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`

/** Crée une page en brouillon, titrée et adressée, et reste dans l'éditeur. */
const createDraftPage = async (page: Page, title: string, slug: string) => {
  await page.goto(`${TENANT_A}${PAGES_ROUTE}`, {waitUntil: 'load'})
  await page.getByRole('button', {name: 'Nouvelle page'}).click()
  await page.waitForURL(/\/bureau\/pages\/[0-9a-f-]{36}/, {timeout: 20_000})
  await expect(page.getByLabel('Adresse de la page')).toBeVisible({
    timeout: 20_000,
  })
  await page.getByLabel('Titre', {exact: true}).fill(title)
  await page.getByLabel('Adresse de la page').fill(slug)
  await page.getByRole('button', {name: 'Enregistrer le brouillon'}).click()
  await expect(page.getByText('Modifications non enregistrées')).toBeHidden({
    timeout: 20_000,
  })
}

const publish = async (page: Page) => {
  // `exact` : une page en ligne porte aussi « Dépublier la page ».
  await page.getByRole('button', {name: 'Publier la page', exact: true}).click()
  await expect(page.getByText('En ligne')).toBeVisible({timeout: 20_000})
}

const sitemapUrls = async (page: Page, base: string): Promise<string[]> => {
  const response = await page.request.get(`${base}/sitemap.xml`)
  expect(response.ok()).toBe(true)
  const xml = await response.text()
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
}

const robotsText = async (page: Page, base: string): Promise<string> => {
  const response = await page.request.get(`${base}/robots.txt`)
  expect(response.ok()).toBe(true)
  return response.text()
}

/**
 * Fait charger sharp par l'optimiseur de `next/image` dans le processus du
 * serveur (revue s11, C3) : à son premier appel, Next y bloque le chargeur SVG
 * dont `next/og` a besoin. Sans cela, le test dépendrait de l'ordre des specs.
 *
 * L'image source n'est rendue par aucune page via `next/image`, et 32 px est
 * une largeur qu'aucune autre spec ne demande pour elle : avec un build neuf
 * (la CI), la requête n'est jamais servie depuis `.next/cache/images` et
 * passe donc par sharp. Next refuse une URL locale avec paramètres : on ne
 * peut pas rendre la source unique à chaque passage. Largeur et qualité font
 * partie de celles que `next.config.ts` autorise (valeurs par défaut).
 */
const forceImageOptimizer = async (
  request: APIRequestContext,
  base: string
) => {
  const response = await request.get(
    `${base}/_next/image?url=${encodeURIComponent('/shipsaas/shipsaas.png')}&w=32&q=75`
  )
  expect(response.ok()).toBe(true)
}

const decodePng = async (bytes: Buffer) => {
  const {info} = await sharp(bytes, {failOn: 'warning'})
    .raw()
    .toBuffer({resolveWithObject: true})
  const {format} = await sharp(bytes).metadata()
  return {format, width: info.width, height: info.height}
}

const metaContent = async (page: Page, selector: string) =>
  page.locator(selector).first().getAttribute('content')

const openSettings = async (page: Page) => {
  await page.goto(`${TENANT_A}${SETTINGS_ROUTE}`, {waitUntil: 'load'})
  await expect(
    page.getByRole('heading', {level: 1, name: SETTINGS_TITLE})
  ).toBeVisible({timeout: 15_000})
}

const codeField = (page: Page) => page.getByLabel(/Code de vérification Google/)

/**
 * Vide le code Google de TechCorp **par l'application** : l'action invalide le
 * cache des paramètres, ce qu'une écriture directe en base ne ferait pas.
 */
const clearGoogleCode = async (browser: Browser) => {
  const page = await newSession(browser, TENANT_A, OWNER_A)
  await openSettings(page)
  if ((await codeField(page).inputValue()) !== '') {
    await codeField(page).fill('')
    await page.getByRole('button', {name: 'Enregistrer les réglages'}).click()
    await expect(page.getByText(SAVED_SEO)).toBeVisible({timeout: 15_000})
  }
  await page.close()
}

test.describe.serial('s11 — référencement', () => {
  let slug: string

  test.beforeAll(async ({browser}) => {
    await clearGoogleCode(browser)
  })

  test.afterAll(async ({browser}) => {
    await clearGoogleCode(browser)
  })

  test('critère 1 — le sitemap liste les pages publiées, pas le brouillon ; publier l’ajoute', async ({
    page,
  }) => {
    slug = uniqueSlug('referencement')
    await login(page, TENANT_A, OWNER_A)
    await createDraftPage(page, 'Qualité de l’eau', slug)

    const before = await sitemapUrls(page, TENANT_A)
    expect(before).toContain(`${TENANT_A}/`)
    expect(before).not.toContain(`${TENANT_A}/${slug}`)

    await publish(page)

    const after = await sitemapUrls(page, TENANT_A)
    expect(after).toContain(`${TENANT_A}/${slug}`)
    for (const url of after) {
      expect(url).not.toMatch(/\/(fr|en|es)(\/|$)/)
      expect(url).not.toContain('/blog')
    }
  })

  test('critère 2 — titre et description du bureau dans le <head>, puis repli sur l’association', async ({
    page,
    browser,
  }) => {
    await login(page, TENANT_A, OWNER_A)
    await page.goto(`${TENANT_A}${PAGES_ROUTE}`, {waitUntil: 'load'})
    await page
      .getByRole('row', {name: new RegExp(slug)})
      .getByRole('link', {name: 'Modifier'})
      .click()
    await expect(page.getByLabel('Adresse de la page')).toBeVisible({
      timeout: 20_000,
    })

    await page
      .getByLabel(/Titre dans les moteurs de recherche/)
      .fill('Analyses de l’eau du domaine')
    await page
      .getByRole('region', {name: 'Référencement et partage'})
      .getByLabel(/^Description/)
      .fill('Résultats des analyses du réseau d’eau.')
    await publish(page)

    const visitor = await browser.newPage()
    await visitor.goto(`${TENANT_A}/${slug}`, {waitUntil: 'load'})
    await expect(visitor).toHaveTitle(
      'Analyses de l’eau du domaine · TechCorp Solutions'
    )
    expect(await metaContent(visitor, 'meta[name="description"]')).toBe(
      'Résultats des analyses du réseau d’eau.'
    )
    expect(await metaContent(visitor, 'meta[property="og:title"]')).toBe(
      'Analyses de l’eau du domaine'
    )
    expect(await metaContent(visitor, 'meta[property="og:description"]')).toBe(
      'Résultats des analyses du réseau d’eau.'
    )
    expect(
      await visitor.locator('link[rel="canonical"]').getAttribute('href')
    ).toBe(`${TENANT_A}/${slug}`)

    // Vidés : repli sur le titre de la page et l'image de l'association.
    await page.getByLabel(/Titre dans les moteurs de recherche/).fill('')
    await page
      .getByRole('region', {name: 'Référencement et partage'})
      .getByLabel(/^Description/)
      .fill('')
    await publish(page)

    await visitor.goto(`${TENANT_A}/${slug}`, {waitUntil: 'load'})
    await expect(visitor).toHaveTitle('Qualité de l’eau · TechCorp Solutions')
    const image = await metaContent(visitor, 'meta[property="og:image"]')
    expect(image).toMatch(
      new RegExp(`^${TENANT_A}/api/identity/share-image\\?`)
    )

    await forceImageOptimizer(visitor.request, TENANT_A)
    const generated = await visitor.request.get(image as string)
    expect(generated.status()).toBe(200)
    expect(generated.headers()['content-type']).toBe('image/png')
    expect(await decodePng(await generated.body())).toEqual({
      format: 'png',
      width: 1200,
      height: 630,
    })

    await visitor.close()
  })

  test('critère 3 — robots.txt exclut les routes authentifiées ; le bureau est noindex', async ({
    page,
  }) => {
    const robots = await robotsText(page, TENANT_A)
    for (const path of [
      '/bureau',
      '/dashboard',
      '/account',
      '/admin',
      '/login',
      '/register',
      '/fr/bureau',
      '/fr/login',
      '/api/',
    ]) {
      expect(robots).toContain(`Disallow: ${path}`)
    }
    expect(robots).toContain('Allow: /api/identity/')
    expect(robots).toContain('Allow: /api/files/')
    expect(robots).not.toContain('/(app)/')

    await login(page, TENANT_A, OWNER_A)
    await page.goto(`${TENANT_A}${PAGES_ROUTE}`, {waitUntil: 'load'})
    expect(await metaContent(page, 'meta[name="robots"]')).toContain('noindex')
  })

  test('critère 4 — le code Google collé en balise entière ne paraît que chez son association', async ({
    page,
    browser,
  }) => {
    await login(page, TENANT_A, OWNER_A)
    await openSettings(page)

    await codeField(page).fill(
      `<meta name="google-site-verification" content="${GOOGLE_CODE}" />`
    )
    await codeField(page).blur()
    await expect(codeField(page)).toHaveValue(GOOGLE_CODE)
    await page.getByRole('button', {name: 'Enregistrer les réglages'}).click()
    await expect(page.getByText(SAVED_SEO)).toBeVisible({timeout: 15_000})

    const visitor = await browser.newPage()
    await visitor.goto(`${TENANT_A}/contact`, {waitUntil: 'load'})
    expect(
      await metaContent(visitor, 'meta[name="google-site-verification"]')
    ).toBe(GOOGLE_CODE)

    await visitor.goto(`${TENANT_B}/contact`, {waitUntil: 'load'})
    await expect(
      visitor.locator('meta[name="google-site-verification"]')
    ).toHaveCount(0)
    await visitor.close()
  })

  test('critère 5 — l’autre association sert son sitemap, son robots et ses métadonnées sur son domaine', async ({
    page,
  }) => {
    const urls = await sitemapUrls(page, TENANT_B)
    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) {
      expect(url.startsWith(`${TENANT_B}/`)).toBe(true)
    }
    expect(urls).not.toContain(`${TENANT_B}/${slug}`)

    expect(await robotsText(page, TENANT_B)).toContain(
      `Sitemap: ${TENANT_B}/sitemap.xml`
    )

    await page.goto(`${TENANT_B}/contact`, {waitUntil: 'load'})
    expect(await metaContent(page, 'meta[property="og:url"]')).toBe(
      `${TENANT_B}/contact`
    )
    expect(
      await page.locator('link[rel="canonical"]').getAttribute('href')
    ).toBe(`${TENANT_B}/contact`)
    expect(await metaContent(page, 'meta[property="og:image"]')).toMatch(
      new RegExp(`^${TENANT_B}/`)
    )
    await expect(page).toHaveTitle(/· Marketing Pro$/)

    await page.goto(`${TENANT_B}/${slug}`, {waitUntil: 'load'})
    await expect(page.getByText('Page non trouvée')).toBeVisible({
      timeout: 20_000,
    })
  })
})
