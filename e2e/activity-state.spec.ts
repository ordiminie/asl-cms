import {expect, Page, test} from '@playwright/test'

/**
 * État client des dialogs face à `<Activity>`.
 *
 * Sous Cache Components, Next garde l'arbre de la page précédente vivant mais
 * masqué au lieu de le démonter. L'état local d'un dialog contrôlé
 * (`useState(false)` + `onOpenChange`) peut donc survivre à un aller-retour de
 * navigation et réapparaître ouvert — c'est la tâche 2.6 du plan, qui n'avait
 * jamais été vérifiée autrement que par lecture de code.
 *
 * Le test doit naviguer **côté client** (clic sur un lien) : un `page.goto()`
 * recharge tout et ne prouverait rien.
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

test('un dialog ouvert ne réapparaît pas au retour arrière', async ({page}) => {
  await login(page, 'admin@gmail.com')
  await page.goto('/en/admin/plans')

  const trigger = page.getByRole('button', {name: /Nouveau plan/i})
  await expect(trigger).toBeVisible({timeout: 15_000})

  const dialog = page.getByRole('dialog')
  // Sous streaming, le bouton est affiché avant d'être hydraté : un premier
  // clic peut ne rien déclencher. On réessaie jusqu'à ce qu'il prenne.
  await expect(async () => {
    await trigger.click()
    await expect(dialog).toBeVisible({timeout: 2000})
  }).toPass({timeout: 20_000})

  await expect(dialog).toContainText('Créer un nouveau plan')

  // Marqueur sur window : s'il survit, aucun rechargement de document n'a eu
  // lieu et la navigation était bien côté client. Sans cette garde, le test
  // passerait pour une mauvaise raison — un reload remet tout à zéro et ne
  // prouverait rien sur <Activity>.
  await page.evaluate(() => {
    ;(window as unknown as {__navMarker?: string}).__navMarker = 'kept'
  })

  // Navigation client, dialog laissé ouvert
  await page
    .getByRole('link', {name: /Utilisateurs|Users/i})
    .first()
    .click()
  await page.waitForURL(/\/admin\/users/)
  await expect(dialog).toBeHidden()

  // Retour arrière : c'est là que <Activity> peut restaurer l'état masqué
  await page.goBack()
  await page.waitForURL(/\/admin\/plans/)
  await expect(trigger).toBeVisible({timeout: 15_000})

  const marker = await page.evaluate(
    () => (window as unknown as {__navMarker?: string}).__navMarker
  )
  expect(
    marker,
    'la navigation a rechargé le document : le test ne prouve rien sur <Activity>'
  ).toBe('kept')

  await expect(dialog).toBeHidden()
})
