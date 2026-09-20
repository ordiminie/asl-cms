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
  await page.goto('/en/login/prestataire')
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

test.describe('Changement d’organisation', () => {
  test('le choix survit à un rechargement', async ({page}) => {
    await login(page, 'user@gmail.com')
    await page.goto('/en/dashboard')

    // Scopé à l'en-tête, et ciblé par rôle : `asChild` de Radix écrase le
    // data-slot du bouton, et les items de navigation en portent un identique.
    const switcher = page
      .locator('[data-slot="sidebar-header"]')
      .getByRole('button')
      .first()
    await expect(switcher).toBeVisible({timeout: 15_000})
    // Le switcher affiche « Chargement... » (« Loading... » en anglais, langue
    // de cette page) tant que l'organisation active
    // n'est pas résolue. Lire son texte à ce moment fait échouer la détection
    // de l'organisation courante, et on finit par cliquer sur celle qui est
    // déjà active — le handler sort alors sans rien faire.
    await expect(switcher).not.toContainText(/Chargement|Loading/, {
      timeout: 15_000,
    })

    const switcherLabel = await switcher.innerText()

    await switcher.click()
    const items = page.getByRole('menuitem').filter({hasNotText: 'Add team'})
    // Les items portent leur raccourci clavier ("Acme Corp.⌘2") et le bouton
    // concatène nom + description : on compare sur les seuls noms.
    const names = (await items.allInnerTexts()).map((text) =>
      text.split('⌘')[0].trim()
    )
    const current = names.find((name) => switcherLabel.includes(name))
    const targetName = names.find((name) => name !== current)

    expect(names.length).toBeGreaterThan(1)
    // Sans cette assertion, un échec de détection se manifeste 30 s plus tard
    // par un waitForResponse qui expire, sans dire pourquoi.
    expect(
      current,
      `organisation courante introuvable dans « ${switcherLabel} » parmi ${names}`
    ).toBeTruthy()
    if (!targetName) {
      throw new Error(
        `Aucune autre organisation que "${current}" dans ${names}`
      )
    }

    await items.filter({hasText: targetName}).first().click()

    // Laisser la session serveur se mettre à jour avant de recharger : sans
    // ça, le rechargement peut annuler la requête en vol. On attend le
    // comportement observable, pas une requête précise — la spec ne doit pas
    // dépendre du nom d'un endpoint.
    await expect(switcher).toContainText(targetName)
    await page.waitForLoadState('networkidle')

    // La vraie assertion : après un rechargement, le cache privé est vidé
    // (il ne survit pas à un reload) et l'organisation affichée ne peut venir
    // que de la session serveur. Si `setActive` n'avait pas pris, on
    // retomberait sur la précédente.
    await page.reload()
    await expect(switcher).toContainText(targetName)
  })
})
