import {expect, Page, test} from '@playwright/test'

/**
 * Contrôle d'accès et session sous Cache Components.
 *
 * Ce que la migration a le plus déplacé : le gating est passé dans le proxy, la
 * session se lit derrière un <Suspense> via un cache privé, et l'organisation
 * active vient de cette session plutôt que d'un état client. Le build ne peut
 * rien prouver de tout ça — d'où ces specs.
 *
 * Sur le statut du refus admin, lire D20 : il n'y a pas de 403, et c'est une
 * limite de Cache Components, pas un oubli.
 */

const login = async (page: Page, email: string) => {
  await page.goto('/login/prestataire')
  await expect(page.locator('form')).toBeVisible()
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', 'Azerty123')
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.toString().includes('/login'), {
    timeout: 15_000,
  })
}

test.describe('Contrôle d’accès', () => {
  test('sans session, une route (app) redirige vers login', async ({page}) => {
    // Gating du proxy : la redirection doit être tranchée avant tout rendu,
    // sinon elle partirait après le début d’un 200 sous streaming.
    await page.goto('/dashboard')

    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('input[name="email"]')).toBeVisible()
  })

  test('sans session, une route admin redirige vers login', async ({page}) => {
    await page.goto('/admin')

    await expect(page).toHaveURL(/\/login/)
  })

  test('un utilisateur standard n’atteint pas le contenu admin', async ({
    page,
  }) => {
    await login(page, 'user@gmail.com')

    const response = await page.goto('/admin')

    // La garantie qui compte : aucun contenu admin ne fuit, l’UI forbidden
    // prend toute la place.
    await expect(
      page.getByRole('heading', {name: /accès non autorisé/i})
    ).toBeVisible()

    // Le statut reste 200, et c’est une limite documentée, pas un oubli :
    // « With Cache Components, every dynamic route streams a static shell
    // first, so run that check in proxy instead. »
    // https://nextjs.org/docs/app/api-reference/functions/forbidden
    // Assertion volontairement stricte : le jour où le contrôle de rôle passe
    // dans le proxy, ce test tombe et signale que la situation a changé.
    expect(response?.status()).toBe(200)
  })

  test('un utilisateur standard atteint son espace', async ({page}) => {
    await login(page, 'user@gmail.com')

    const response = await page.goto('/dashboard')

    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/dashboard$/)
  })

  test('un ancien compte admin, user depuis s47, n’atteint pas le contenu admin', async ({
    page,
  }) => {
    // admin@gmail.com portait le rôle global `admin` avant s47 (ADR 035). Il
    // est désormais `user` : la console plateforme lui est refusée, comme à
    // tout compte qui n'est pas SuperAdmin. Statut 200 sous Cache Components,
    // l'assertion porte sur le contenu (voir le cas précédent).
    await login(page, 'admin@gmail.com')

    await page.goto('/admin')

    await expect(
      page.getByRole('heading', {name: /accès non autorisé/i})
    ).toBeVisible()
  })

  test('le SuperAdmin atteint /admin', async ({page}) => {
    await login(page, 'superadmin@gmail.com')

    const response = await page.goto('/admin')

    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/admin$/)

    // Le statut 200 et l'URL vaudraient aussi pour l'UI forbidden (voir les
    // cas précédents) : il faut le contenu admin, et pas l'écran de refus.
    await expect(
      page.getByRole('heading', {name: 'Dashboard Administration'})
    ).toBeVisible({timeout: 20_000})
    await expect(
      page.getByRole('heading', {name: /accès non autorisé/i})
    ).toHaveCount(0)
  })
})
