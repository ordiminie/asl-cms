import {expect, test} from '@playwright/test'

test.describe('Mobile Navigation', () => {
  test.use({viewport: {width: 375, height: 667}}) // iPhone-like viewport

  test('porte l’en-tête du site public', async ({page}) => {
    await page.goto('/')

    await expect(page.getByRole('banner')).toBeVisible()
  })

  test('affiche l’accueil de l’association sur mobile, sans la vitrine', async ({
    page,
  }) => {
    await page.goto('/')

    // Titre de la page d'accueil : le nom de l'association du domaine (s11)
    await expect(page).toHaveTitle('TechCorp Solutions')
    await expect(
      page.getByRole('heading', {level: 1, name: 'TechCorp Solutions'})
    ).toBeVisible()
    await expect(page.getByText('Essayez gratuitement')).toHaveCount(0)
  })
})
