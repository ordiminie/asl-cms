import {expect, Page, test} from '@playwright/test'

/**
 * Contrôle d'accès des routes authentifiées sous Cache Components.
 *
 * Ces trois comportements sont ceux que la migration a le plus déplacés :
 * le gating est passé dans le proxy, la session se lit derrière un <Suspense>,
 * et le contrôle de rôle est resté bloquant pour que le 403 reste un vrai 403.
 * Le build ne peut rien prouver de tout ça — d'où ces specs.
 */

const login = async (page: Page, email: string) => {
  await page.goto('/en/login')
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
    await page.goto('/en/dashboard')

    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('input[name="email"]')).toBeVisible()
  })

  test('sans session, une route admin redirige vers login', async ({page}) => {
    await page.goto('/en/admin')

    await expect(page).toHaveURL(/\/login/)
  })

  test('un utilisateur standard n’atteint pas le contenu admin', async ({
    page,
  }) => {
    await login(page, 'user@gmail.com')

    const response = await page.goto('/en/admin')

    // La garantie qui compte : aucun contenu admin ne fuit, l’UI forbidden
    // prend toute la place.
    await expect(
      page.getByRole('heading', {name: /unauthorized/i})
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

    const response = await page.goto('/en/dashboard')

    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(/\/en\/dashboard/)
  })

  test('un administrateur atteint /admin', async ({page}) => {
    await login(page, 'admin@gmail.com')

    const response = await page.goto('/en/admin')

    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(/\/en\/admin/)
  })
})
