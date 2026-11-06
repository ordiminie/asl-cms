import {expect, Page, test} from '@playwright/test'

/**
 * Polices hébergées avec le site — s51, critères 2 à 4 (ADR 046).
 *
 * Seul un build de production prouve que les chemins `src` de
 * `next/font/local` sont bons : un test unitaire mocke le loader. Sur une page
 * publique et une page du bureau, ni le HTML ni les feuilles de style de Next
 * ne citent Google Fonts, aucune requête n'y part, et les trois familles
 * consommées par `globals.css` se chargent depuis le site.
 */

const PASSWORD = 'Azerty123'
const BOARD_EMAIL = 'user-owner@gmail.com'
const PUBLIC_ROUTE = '/'
const BOARD_ROUTE = '/bureau/reglages'

const GOOGLE_FONTS_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']

const FONT_VARIABLES = [
  '--font-public-sans',
  '--font-source-serif',
  '--font-jetbrains-mono',
]

const citesGoogleFonts = (text: string) =>
  GOOGLE_FONTS_HOSTS.some((host) => text.includes(host))

const login = async (page: Page, email: string) => {
  await page.goto('/login/prestataire')
  await expect(page.locator('form')).toBeVisible()
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.toString().includes('/login'), {
    timeout: 15_000,
  })
}

const watchGoogleFontsRequests = (page: Page) => {
  const requested: string[] = []
  page.on('request', (request) => {
    if (GOOGLE_FONTS_HOSTS.includes(new URL(request.url()).hostname)) {
      requested.push(request.url())
    }
  })
  return requested
}

const nextStylesheetsOf = (page: Page) =>
  page
    .locator('link[rel="stylesheet"][href*="/_next/static/"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href))

/** Charge chaque famille déclarée derrière sa variable CSS, et rend son statut. */
const loadedFamiliesOf = (page: Page) =>
  page.evaluate(async (variables) => {
    const body = getComputedStyle(document.body)
    const families = variables.map((variable) =>
      body
        .getPropertyValue(variable)
        .split(',')[0]
        .trim()
        .replace(/^['"]|['"]$/g, '')
    )
    await Promise.all(
      families.map((family) => document.fonts.load(`400 16px "${family}"`))
    )
    await document.fonts.ready
    return families.map((family) => ({
      family,
      loaded: [...document.fonts].some(
        (face) =>
          face.family.replace(/^['"]|['"]$/g, '') === family &&
          face.status === 'loaded'
      ),
    }))
  }, FONT_VARIABLES)

const expectSelfHostedFonts = async (page: Page, route: string) => {
  const requested = watchGoogleFontsRequests(page)

  const response = await page.goto(route, {waitUntil: 'load'})
  if (!response) throw new Error(`${route} : aucune réponse`)
  expect(response.ok(), `${route} : statut`).toBe(true)
  expect(citesGoogleFonts(await response.text()), `${route} : HTML`).toBe(false)

  const stylesheets = await nextStylesheetsOf(page)
  expect(stylesheets.length).toBeGreaterThan(0)
  for (const href of stylesheets) {
    const css = await (await page.request.get(href)).text()
    expect(citesGoogleFonts(css), `${route} : ${href}`).toBe(false)
  }

  const families = await loadedFamiliesOf(page)
  for (const {family, loaded} of families) {
    expect(family, `${route} : famille vide`).not.toBe('')
    expect(loaded, `${route} : ${family} non chargée`).toBe(true)
  }

  expect(requested, `${route} : requêtes vers Google Fonts`).toEqual([])
}

test('page publique : polices servies par le site, rien chez Google', async ({
  page,
}) => {
  await expectSelfHostedFonts(page, PUBLIC_ROUTE)
})

test('page du bureau : polices servies par le site, rien chez Google', async ({
  page,
}) => {
  await login(page, BOARD_EMAIL)
  await expectSelfHostedFonts(page, BOARD_ROUTE)
})
