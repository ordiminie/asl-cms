import {expect, test} from '@playwright/test'

test.describe('Mobile Navigation', () => {
  test.use({viewport: {width: 375, height: 667}}) // iPhone-like viewport

  test('should display mobile navigation correctly', async ({page}) => {
    await page.goto('/')

    // Mobile nav might be hidden by default
    await expect(page.locator('nav')).toBeAttached()
  })

  test('should display homepage on mobile', async ({page}) => {
    await page.goto('/')

    // Titre de la page d'accueil : le nom de l'association du domaine (s11)
    await expect(page).toHaveTitle('TechCorp Solutions')

    // Check for hero content
    await expect(page.getByText('La plateforme SaaS moderne')).toBeVisible()
  })
})
