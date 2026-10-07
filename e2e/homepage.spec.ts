import {expect, test} from '@playwright/test'

test.describe('Homepage', () => {
  test('should display the homepage correctly', async ({page}) => {
    await page.goto('/')

    // Titre de la page d'accueil : le nom de l'association du domaine (s11)
    await expect(page).toHaveTitle('TechCorp Solutions')

    // Check for main hero heading specifically
    await expect(
      page.getByRole('heading', {
        name: /La plateforme SaaS moderne pour booster/,
      })
    ).toBeVisible()
  })

  test('should have working navigation', async ({page}) => {
    await page.goto('/')

    // Check if navigation links are present - use more specific selector
    const navigation = page.locator('nav').first()
    await expect(navigation).toBeVisible()
  })

  test('should display hero section', async ({page}) => {
    await page.goto('/')

    // Check for hero content
    await expect(page.getByText('La plateforme SaaS moderne')).toBeVisible()
  })
})
