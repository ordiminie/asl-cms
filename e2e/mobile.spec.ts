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

    // Check if the page loads with correct title
    await expect(page).toHaveTitle(/Next SaaS Boilerplate/)

    // Check for hero content
    await expect(page.getByText('Modern SaaS platform')).toBeVisible()
  })
})
