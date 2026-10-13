/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import {Browser, expect, Page, test} from '@playwright/test'

/**
 * Compte hérité réduit à sa sécurité — s46, critères 1 à 3.
 *
 * Ce que seuls deux domaines et un vrai serveur prouvent : les écrans du
 * compte hérité ne sont plus servis (un vrai 404 : adresses à plusieurs
 * segments, ADR 013), `/dashboard` est l'espace membre vide, la déconnexion
 * ferme bien la session, aucun menu ne renvoie vers une adresse retirée, et le
 * SuperAdmin passe de `/admin` à `/bureau` sans se reconnecter (cookie propre
 * à l'hôte).
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
/** TechCorp Solutions dans le seed. */
const TENANT_A = `http://localhost:${PORT}`
const TENANT_A_NAME = 'TechCorp Solutions'
/** Marketing Pro dans le seed. */
const TENANT_B = `http://127.0.0.1:${PORT}`

const PASSWORD = 'Azerty123'
/** Membre de TechCorp Solutions, d'aucune autre association. */
const MEMBER_A = 'user@gmail.com'
/** SuperAdmin, sans appartenance à une association. */
const SUPER_ADMIN = 'superadmin@gmail.com'

const REMOVED_ROUTES = [
  '/account/settings',
  '/account/api-keys',
  '/account/notifications',
  '/account/notifications/x',
  '/account/organizations',
  '/account/organizations/x',
  '/account/invitations',
  '/account/invitations/x',
  '/account/billing/subscription',
  '/team/x',
]

/** Un chemin retiré par s46, sous n'importe quelle forme. */
const REMOVED_PATH =
  /^\/(account\/(settings|api-keys|notifications|organizations|invitations|billing)|team)(\/|$)/

/** Textes du tableau de bord de démonstration du boilerplate. */
const LEGACY_DASHBOARD_TEXTS = [
  'Total Revenue',
  'Subscriptions',
  'Active Now',
  'Recent Sales',
]

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

const openMemberSpace = async (page: Page, base: string) => {
  await page.goto(`${base}/dashboard`, {waitUntil: 'load'})
  await expect(
    page.getByRole('heading', {level: 1, name: 'Votre espace membre'})
  ).toBeVisible({timeout: 20_000})
}

test.describe('critère 1 — les écrans du compte hérité répondent 404', () => {
  for (const base of [TENANT_A, TENANT_B]) {
    test(`${base} : chaque adresse retirée répond 404, connecté`, async ({
      browser,
    }) => {
      const page = await newSession(browser, base, SUPER_ADMIN)

      for (const route of REMOVED_ROUTES) {
        const response = await page.goto(`${base}${route}`)
        expect(response?.status(), route).toBe(404)
      }

      await page.close()
    })

    test(`${base}/team/x répond 404 sans session`, async ({page}) => {
      const response = await page.goto(`${base}/team/x`)

      expect(response?.status()).toBe(404)
    })
  }

  test('le membre connecté obtient aussi 404', async ({browser}) => {
    const page = await newSession(browser, TENANT_A, MEMBER_A)

    for (const route of REMOVED_ROUTES) {
      const response = await page.goto(`${TENANT_A}${route}`)
      expect(response?.status(), route).toBe(404)
    }

    await page.close()
  })

  test('/account ne propose que la sécurité, sans barre latérale', async ({
    browser,
  }) => {
    const page = await newSession(browser, TENANT_A, MEMBER_A)
    await page.goto(`${TENANT_A}/account`, {waitUntil: 'load'})

    await expect(
      page.getByRole('heading', {level: 1, name: 'Sécurité du compte'})
    ).toBeVisible({timeout: 20_000})
    await expect(
      page.getByRole('link', {name: 'Revenir à mon espace'})
    ).toHaveAttribute('href', '/dashboard')
    await expect(page.locator('[data-sidebar]')).toHaveCount(0)

    await page.close()
  })
})

test.describe('critère 2 — /dashboard est l’espace membre', () => {
  for (const [base, email] of [
    [TENANT_A, MEMBER_A],
    [TENANT_A, SUPER_ADMIN],
  ]) {
    test(`${email} voit l’espace membre vide`, async ({browser}) => {
      const page = await newSession(browser, base, email)
      await openMemberSpace(page, base)

      await expect(
        page.locator('header').getByText(TENANT_A_NAME, {exact: true})
      ).toBeVisible()
      await expect(
        page.getByRole('link', {name: 'Gérer la sécurité du compte'})
      ).toHaveAttribute('href', '/account')
      for (const text of LEGACY_DASHBOARD_TEXTS) {
        await expect(page.getByText(text, {exact: true}), text).toHaveCount(0)
      }
      await expect(page.locator('[data-sidebar]')).toHaveCount(0)

      await page.close()
    })
  }

  test('sans session, /dashboard redirige vers la connexion', async ({
    page,
  }) => {
    await page.goto(`${TENANT_A}/dashboard`)

    await expect(page).toHaveURL(/\/login/)
  })

  test('« Se déconnecter » ferme la session', async ({browser}) => {
    const page = await newSession(browser, TENANT_A, MEMBER_A)
    await openMemberSpace(page, TENANT_A)

    await page.getByRole('button', {name: 'Se déconnecter'}).click()
    await page.waitForURL(/\/login/, {timeout: 15_000})

    await page.goto(`${TENANT_A}/dashboard`)
    await expect(page).toHaveURL(/\/login/)

    await page.close()
  })
})

test.describe('critère 1 — aucun lien ne vise une adresse retirée', () => {
  test('/dashboard et /account', async ({browser}) => {
    const page = await newSession(browser, TENANT_A, MEMBER_A)

    await openMemberSpace(page, TENANT_A)
    expect(await removedLinksOn(page)).toEqual([])

    await page.goto(`${TENANT_A}/account`, {waitUntil: 'load'})
    await expect(
      page.getByRole('heading', {level: 1, name: 'Sécurité du compte'})
    ).toBeVisible({timeout: 20_000})
    expect(await removedLinksOn(page)).toEqual([])

    await page.close()
  })

  test('la barre de /admin', async ({browser}) => {
    const page = await newSession(browser, TENANT_A, SUPER_ADMIN)
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

test.describe('critère 3 — de /admin à /bureau sans reconnexion', () => {
  test('le SuperAdmin ouvre le back-office de l’association du domaine', async ({
    browser,
  }) => {
    const page = await newSession(browser, TENANT_A, SUPER_ADMIN)
    await page.goto(`${TENANT_A}/admin`, {waitUntil: 'load'})
    const menu = page.locator('[data-sidebar="sidebar"]')
    const entry = menu.getByRole('link', {
      name: `Back-office de l'association ${TENANT_A_NAME}`,
    })
    await expect(entry).toBeVisible({timeout: 20_000})
    await expect(entry).toContainText(TENANT_A_NAME)
    await expect(entry).toHaveAttribute('href', '/bureau')
    await expect(menu.getByText('Application (front office)')).toHaveCount(0)

    const visited: string[] = []
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) visited.push(frame.url())
    })

    await entry.click()
    await page.waitForURL(/\/bureau/, {timeout: 20_000})
    await expect(page.locator('main').first()).toBeVisible({timeout: 20_000})

    expect(visited.filter((url) => url.includes('/login'))).toEqual([])
    await page.close()
  })
})
