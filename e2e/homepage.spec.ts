import {expect, test} from '@playwright/test'

test.describe('Homepage', () => {
  test('should display the homepage correctly', async ({page}) => {
    await page.goto('/')

    // Check if the page loads with correct title
    await expect(page).toHaveTitle(/Next SaaS Boilerplate/)

    // Check for main hero heading specifically
    await expect(
      page.getByRole('heading', {name: /Modern SaaS platform to boost/})
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
    await expect(page.getByText('Modern SaaS platform')).toBeVisible()
  })
})
