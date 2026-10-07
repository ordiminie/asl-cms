/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import {APIRequestContext, expect, Page, test} from '@playwright/test'

/**
 * Locale unique — s43, critères 1 à 3, et le constat déclencheur.
 *
 * Ce que seul un vrai serveur prouve : l'effet des `redirects()` de
 * `next.config.ts` (ADR 031) — statut 308, query conservée —, le gating du
 * proxy sans préfixe et `<html lang="fr">`. Le critère 4 (emails, sitemap
 * sans préfixe) reste couvert par `contact.spec.ts` et `seo.spec.ts`.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
/** TechCorp Solutions dans le seed. */
const TENANT_A = `http://localhost:${PORT}`

const PASSWORD = 'Azerty123'
/** Le seed lui donne `language = 'en'` : le cas du constat du 2026-10-06. */
const ENGLISH_PROFILE = 'superadmin@gmail.com'

const LEGACY_PREFIX = /^\/(fr|en|es)(\/|$)/

const redirectOf = async (request: APIRequestContext, path: string) => {
  const response = await request.get(`${TENANT_A}${path}`, {maxRedirects: 0})
  const location = response.headers()['location']
  const target = location ? new URL(location, TENANT_A) : undefined
  return {
    status: response.status(),
    target: target ? `${target.pathname}${target.search}` : undefined,
  }
}

const login = async (page: Page, email: string) => {
  await page.goto(`${TENANT_A}/login/prestataire`)
  await expect(page.locator('form')).toBeVisible()
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.toString().includes('/login'), {
    timeout: 15_000,
  })
}

test.describe('critère 2 — les anciens préfixes redirigent en permanence', () => {
  for (const prefix of ['/fr', '/en', '/es']) {
    test(`${prefix} → 308 vers la racine`, async ({request}) => {
      expect(await redirectOf(request, prefix)).toEqual({
        status: 308,
        target: '/',
      })
    })
  }

  test('la query string est conservée', async ({request}) => {
    expect(await redirectOf(request, '/en/actualites?page=2')).toEqual({
      status: 308,
      target: '/actualites?page=2',
    })
  })

  test('une route du bureau préfixée redirige vers la même route sans préfixe', async ({
    request,
  }) => {
    expect(await redirectOf(request, '/fr/bureau')).toEqual({
      status: 308,
      target: '/bureau',
    })
  })
})

test.describe('critère 1 — chaque page est servie sans préfixe, en français', () => {
  test('/actualites répond 200, en français', async ({page}) => {
    const response = await page.goto(`${TENANT_A}/actualites`, {
      waitUntil: 'load',
    })

    expect(response?.status()).toBe(200)
    expect(new URL(page.url()).pathname).toBe('/actualites')
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
    await expect(
      page.getByRole('heading', {level: 1, name: 'Actualités'})
    ).toBeVisible({timeout: 20_000})
  })

  test('/login répond 200, en français', async ({page}) => {
    const response = await page.goto(`${TENANT_A}/login`, {waitUntil: 'load'})

    expect(response?.status()).toBe(200)
    expect(new URL(page.url()).pathname).toBe('/login')
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
    await expect(
      page.getByRole('heading', {level: 1, name: 'Se connecter à votre espace'})
    ).toBeVisible({timeout: 20_000})
  })
})

test.describe('critère 3 — le proxy protège les routes sans préfixe', () => {
  test('/bureau sans session renvoie vers /login, sans préfixe', async ({
    page,
  }) => {
    await page.goto(`${TENANT_A}/bureau`)

    await expect(page).toHaveURL(`${TENANT_A}/login`)
  })
})

test.describe('constat déclencheur — un profil en anglais reste sans préfixe', () => {
  test('la navigation du bureau vers une page publique ne quitte jamais une adresse sans préfixe', async ({
    browser,
  }) => {
    const page = await browser.newPage()
    const visited: string[] = []
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) visited.push(frame.url())
    })

    await login(page, ENGLISH_PROFILE)

    await page.goto(`${TENANT_A}/bureau`, {waitUntil: 'load'})
    // UserPreferencesSync s'exécute après hydratation : lui laisser le temps
    // de basculer, s'il le faisait encore.
    await page.waitForTimeout(2_000)
    expect(new URL(page.url()).pathname).toMatch(/^\/bureau/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')

    await page.goto(`${TENANT_A}/actualites`, {waitUntil: 'load'})
    await page.waitForTimeout(2_000)
    expect(new URL(page.url()).pathname).toBe('/actualites')

    const prefixed = visited.filter((url) =>
      LEGACY_PREFIX.test(new URL(url).pathname)
    )
    expect(prefixed, `adresses préfixées visitées : ${prefixed}`).toEqual([])

    await page.close()
  })
})
