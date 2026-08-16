import {expect, Page, test} from '@playwright/test'

/**
 * Balayage des pages authentifiées.
 *
 * Les specs d'autorisation vérifient qui a le droit d'entrer ; celle-ci vérifie
 * que la page **rend vraiment**, une fois entré. Sous Cache Components le shell
 * part en `200` avant que le contenu n'arrive : une page qui casse en cours de
 * stream affiche donc une frontière d'erreur dans un document parfaitement
 * valide, et aucune assertion de statut ne le voit.
 *
 * Trois contrôles par page : pas de frontière d'erreur, pas d'erreur console
 * (les avertissements d'hydratation en font partie), et un HTML sans
 * imbrication invalide — c'est ce dernier qui a rattrapé un `<p>` dans un `<p>`
 * sur les pages de documentation.
 */

const PASSWORD = 'Azerty123'

const USER_ROUTES = [
  '/en/dashboard',
  '/en/account',
  '/en/account/settings',
  '/en/account/notifications',
  '/en/account/organizations',
  '/en/account/invitations',
  '/en/account/api-keys',
  '/en/account/billing/subscription',
  '/en/account/billing/credit',
  '/en/account/billing/usage',
]

const TEAM_ROUTES = [
  '/en/team/evil-corp',
  '/en/team/evil-corp/projects',
  '/en/team/evil-corp/projects/new',
  '/en/team/evil-corp/credits-simulator',
]

const ADMIN_ROUTES = [
  '/en/admin',
  '/en/admin/users',
  '/en/admin/organizations',
  '/en/admin/plans',
  '/en/admin/subscriptions',
  '/en/admin/credits',
  '/en/admin/blog',
  '/en/admin/emails',
  '/en/admin/submissions',
  '/en/admin/settings',
]

/** Bruit de console sans rapport avec la santé de la page. */
const IGNORED_CONSOLE = [
  /favicon/i,
  /Download the React DevTools/i,
  /was preloaded using link preload/i,
  /Image with src .* was detected as the Largest Contentful Paint/i,
  // next-themes rend un <script> inline pour poser le thème avant peinture ;
  // React 19 le signale en développement. Tiers, absent du build de production.
  /Encountered a script tag while rendering React component/,
]

/**
 * En développement, Next signale dans la console ce qui empêche une route
 * d'être prerendue ou une navigation d'être instantanée. Ce sont de vrais
 * signaux, mais ils sont déjà remontés par l'overlay et le terminal : les
 * compter ici rendrait la suite rouge en local et personne ne la lancerait.
 * La suite fait foi contre le build de production, comme le veut la config.
 */
const DEV_ONLY_ADVISORIES =
  /Next\.js encountered (the unstable value|uncached data)/

const login = async (page: Page, email: string) => {
  await page.goto('/en/login')
  await expect(page.locator('form')).toBeVisible()
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.toString().includes('/login'), {
    timeout: 15_000,
  })
}

/** Une imbrication que le navigateur corrigera en silence, au prix de l'hydratation. */
const findInvalidNesting = (html: string) => {
  let depth = 0
  for (const match of html.matchAll(/<p(?:\s[^>]*)?>|<\/p>/g)) {
    depth += match[0] === '</p>' ? -1 : 1
    if (depth > 1) return '<p> imbriqué dans un <p>'
  }
  const block = html.match(
    /<p(?:\s[^>]*)?>(?:(?!<\/p>)[\s\S])*?<(div|ul|ol|pre|table|blockquote|h[1-6])\b/
  )
  return block ? `<${block[1]}> à l'intérieur d'un <p>` : undefined
}

const checkPage = async (page: Page, route: string) => {
  const consoleErrors: string[] = []
  const onConsole = (message: {type: () => string; text: () => string}) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (IGNORED_CONSOLE.some((pattern) => pattern.test(text))) return
    if (!process.env.CI && DEV_ONLY_ADVISORIES.test(text)) return
    consoleErrors.push(text)
  }
  page.on('console', onConsole)

  // `networkidle` est fragile ici : certaines pages émettent des requêtes
  // périodiques et n'atteignent jamais le silence réseau. `load` suffit, puis
  // on laisse au streaming et à l'hydratation le temps de parler.
  await page.goto(route, {waitUntil: 'load'})
  await page.waitForTimeout(1_500)

  // La frontière d'erreur de Next remplace le contenu sans changer le statut.
  await expect(
    page.getByText(/something went wrong|une erreur|application error/i)
  ).toHaveCount(0)

  const nesting = findInvalidNesting(await page.content())
  expect(nesting, `${route} : ${nesting}`).toBeUndefined()

  page.off('console', onConsole)
  expect(consoleErrors, `${route} : ${consoleErrors[0]}`).toEqual([])
}

/**
 * Une seule session par groupe, réutilisée en série. Se reconnecter avant
 * chaque page — 24 fois — rendait la suite instable sans rien tester de plus :
 * l'authentification a déjà ses propres specs.
 */
const describeRoutes = (title: string, email: string, routes: string[]) => {
  test.describe.serial(title, () => {
    let page: Page

    test.beforeAll(async ({browser}) => {
      page = await browser.newPage()
      await login(page, email)
    })

    test.afterAll(async () => {
      await page.close()
    })

    for (const route of routes) {
      test(`${route} rend sans erreur`, async () => {
        await checkPage(page, route)
      })
    }
  })
}

describeRoutes('Pages authentifiées — utilisateur standard', 'user@gmail.com', [
  ...USER_ROUTES,
  ...TEAM_ROUTES,
])

describeRoutes(
  'Pages authentifiées — administrateur',
  'admin@gmail.com',
  ADMIN_ROUTES
)
