/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import {Browser, expect, Page, test} from '@playwright/test'

/**
 * Pages héritées retirées — s45, critères 1 à 5 et 8.
 *
 * Ce que seuls deux domaines et un vrai serveur prouvent : le blog, la
 * documentation et la vitrine du boilerplate ne sont plus servis, aucune page
 * conservée n'y renvoie, le sitemap et `robots.txt` les ignorent, et un
 * navigateur réglé en sombre voit le produit en clair (ADR 033).
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
/** TechCorp Solutions dans le seed, module `voirie` actif. */
const TENANT_A = `http://localhost:${PORT}`
/** Marketing Pro dans le seed. */
const TENANT_B = `http://127.0.0.1:${PORT}`

const PASSWORD = 'Azerty123'
/** Présidente de TechCorp Solutions. */
const OWNER_A = 'user-owner@gmail.com'
/** Administrateur de la plateforme, celui des specs de `/admin`. */
const PLATFORM_ADMIN = 'admin@gmail.com'

const NOT_FOUND_TITLE = 'Page non trouvée'

/**
 * Adresses à plusieurs segments : aucune route ne les sert plus, la décision
 * précède le premier octet — un vrai 404 (ADR 013).
 */
const REMOVED_NESTED_ROUTES = [
  '/blog/x',
  '/blog/category/x',
  '/blog/page/2',
  '/docs/x/y',
  '/checkout/x',
  '/checkout/success',
]

/**
 * Adresses à un seul segment : depuis l'ADR 020, tout chemin à un segment
 * trouve la route des pages CMS (`/{slug}`). Leurs slugs sont réservés
 * (`RESERVED_PAGE_SLUGS`) : aucune page ne peut y être publiée, la route rend
 * donc l'UI « Page non trouvée », sous le statut 200 que Cache Components
 * impose à un `notFound()` streamé (ADR 013, même constat que
 * `tenant-isolation.spec.ts`).
 */
const REMOVED_ROOT_ROUTES = [
  '/blog',
  '/docs',
  '/pricing',
  '/pricing_old',
  '/privacy',
  '/terms',
]

/** Un chemin retiré, sous n'importe quelle forme (relative ou absolue). */
const REMOVED_PATH =
  /^\/(blog|docs|pricing|pricing_old|checkout|privacy|terms|admin\/blog)(\/|$)/

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

/** Les liens de la page qui mènent, sur ce domaine, vers une adresse retirée. */
const removedLinksOn = async (page: Page) => {
  const hrefs = await page
    .locator('a[href]')
    .evaluateAll((anchors) =>
      anchors.map((anchor) => (anchor as HTMLAnchorElement).href)
    )
  const origin = new URL(page.url()).origin
  return hrefs.filter((href) => {
    const url = new URL(href)
    return url.origin === origin && REMOVED_PATH.test(url.pathname)
  })
}

const sitemapPaths = async (page: Page, base: string) => {
  const response = await page.request.get(`${base}/sitemap.xml`)
  expect(response.ok()).toBe(true)
  const xml = await response.text()
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (match) => new URL(match[1]).pathname
  )
}

/** Les chemins que `robots.txt` cite (`Allow`, `Disallow`). */
const robotsPaths = async (page: Page, base: string) => {
  const response = await page.request.get(`${base}/robots.txt`)
  expect(response.ok()).toBe(true)
  const text = await response.text()
  return [...text.matchAll(/^(?:Allow|Disallow):\s*(\S+)/gim)].map(
    (match) => match[1]
  )
}

/** Le fond calculé du `body`, ramené en RGB quel que soit l'espace de couleur. */
const bodyBackgroundRgb = (page: Page) =>
  page.evaluate(() => {
    const color = getComputedStyle(document.body).backgroundColor
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D indisponible')
    context.fillStyle = color
    context.fillRect(0, 0, 1, 1)
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data
    return {red, green, blue}
  })

const expectLightOnly = async (page: Page) => {
  await expect(page.locator('html')).not.toHaveClass(/(^|\s)dark(\s|$)/)
  await expect(
    page.getByRole('button', {name: /thème|mode sombre|mode clair/i})
  ).toHaveCount(0)
  const {red, green, blue} = await bodyBackgroundRgb(page)
  expect(Math.min(red, green, blue)).toBeGreaterThan(200)
}

test.describe('critère 1 — les adresses retirées ne sont plus servies', () => {
  for (const base of [TENANT_A, TENANT_B]) {
    for (const route of REMOVED_NESTED_ROUTES) {
      test(`${base}${route} répond 404`, async ({page}) => {
        const response = await page.goto(`${base}${route}`)

        expect(response?.status()).toBe(404)
      })
    }

    for (const route of REMOVED_ROOT_ROUTES) {
      test(`${base}${route} ne sert que « Page non trouvée »`, async ({
        page,
      }) => {
        const response = await page.goto(`${base}${route}`, {
          waitUntil: 'load',
        })

        expect(response?.status()).toBe(200)
        await expect(page.getByText(NOT_FOUND_TITLE)).toBeVisible({
          timeout: 20_000,
        })
      })
    }
  }

  test('/modules/<clé inconnue> garde son comportement de sonde', async ({
    page,
  }) => {
    const response = await page.goto(`${TENANT_A}/modules/module-fictif`)

    expect(response?.status()).toBe(200)
    await expect(page.getByTestId('module-actif')).toHaveCount(0)
  })
})

test.describe('critère 2 — le blog quitte /admin', () => {
  test('/admin/blog et /admin/blog/new répondent 404, le menu ne cite plus « Blog »', async ({
    browser,
  }) => {
    const page = await newSession(browser, TENANT_A, PLATFORM_ADMIN)

    for (const route of ['/admin/blog', '/admin/blog/new']) {
      const response = await page.goto(`${TENANT_A}${route}`)
      expect(response?.status(), route).toBe(404)
    }

    await page.goto(`${TENANT_A}/admin`, {waitUntil: 'load'})
    const menu = page.locator('[data-sidebar="sidebar"]')
    await expect(menu.getByRole('link', {name: 'Plans'})).toBeVisible({
      timeout: 20_000,
    })
    await expect(menu.getByRole('link', {name: 'Abonnements'})).toBeVisible()
    await expect(menu.getByRole('link', {name: 'Blog'})).toHaveCount(0)

    await page.close()
  })
})

test.describe('critère 3 — aucune page servie ne lie une adresse retirée', () => {
  for (const route of [
    '/',
    '/actualites',
    '/login/prestataire',
    '/reset-password',
  ]) {
    test(`${route} ne lie aucune adresse retirée`, async ({page}) => {
      await page.goto(`${TENANT_A}${route}`, {waitUntil: 'load'})
      await expect(page.locator('body')).toBeVisible()

      expect(await removedLinksOn(page)).toEqual([])
    })
  }

  test('/bureau ne lie aucune adresse retirée', async ({browser}) => {
    const page = await newSession(browser, TENANT_A, OWNER_A)
    await page.goto(`${TENANT_A}/bureau`, {waitUntil: 'load'})
    await expect(page.locator('main').first()).toBeVisible({timeout: 20_000})

    expect(await removedLinksOn(page)).toEqual([])
    await page.close()
  })

  test('/admin ne lie aucune adresse retirée', async ({browser}) => {
    const page = await newSession(browser, TENANT_A, PLATFORM_ADMIN)
    await page.goto(`${TENANT_A}/admin`, {waitUntil: 'load'})
    await expect(
      page.locator('[data-sidebar="sidebar"]').getByRole('link', {
        name: 'Plans',
      })
    ).toBeVisible({timeout: 20_000})

    expect(await removedLinksOn(page)).toEqual([])
    await page.close()
  })
})

test.describe('critère 5 — sitemap et robots.txt ignorent les adresses retirées', () => {
  for (const base of [TENANT_A, TENANT_B]) {
    test(`${base} : sitemap.xml et robots.txt`, async ({page}) => {
      const sitemap = await sitemapPaths(page, base)
      expect(sitemap.filter((path) => REMOVED_PATH.test(path))).toEqual([])

      const robots = await robotsPaths(page, base)
      expect(robots.filter((path) => REMOVED_PATH.test(path))).toEqual([])
    })
  }
})

test.describe('critère 8 — un navigateur réglé en sombre voit du clair', () => {
  test.use({colorScheme: 'dark'})

  for (const route of ['/', '/actualites', '/login/prestataire']) {
    test(`${route} reste en clair, sans sélecteur de thème`, async ({page}) => {
      await page.goto(`${TENANT_A}${route}`, {waitUntil: 'load'})
      await expect(page.locator('body')).toBeVisible()

      await expectLightOnly(page)
    })
  }

  test('/bureau reste en clair, sans sélecteur de thème', async ({browser}) => {
    const context = await browser.newContext({colorScheme: 'dark'})
    const page = await context.newPage()
    await login(page, TENANT_A, OWNER_A)
    await page.goto(`${TENANT_A}/bureau`, {waitUntil: 'load'})
    await expect(page.locator('main').first()).toBeVisible({timeout: 20_000})

    await expectLightOnly(page)
    await context.close()
  })

  test('/admin reste en clair, sans sélecteur de thème', async ({browser}) => {
    const context = await browser.newContext({colorScheme: 'dark'})
    const page = await context.newPage()
    await login(page, TENANT_A, PLATFORM_ADMIN)
    await page.goto(`${TENANT_A}/admin`, {waitUntil: 'load'})
    await expect(
      page.locator('[data-sidebar="sidebar"]').getByRole('link', {
        name: 'Plans',
      })
    ).toBeVisible({timeout: 20_000})

    await expectLightOnly(page)
    await context.close()
  })
})
