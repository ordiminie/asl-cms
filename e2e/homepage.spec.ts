import {expect, test} from '@playwright/test'

/**
 * Accueil du site public (s44, critère 2) : sur une base fraîche, aucune page
 * n'est désignée — `/` sert l'accueil automatique de l'association du
 * domaine, jamais la vitrine du boilerplate.
 */
test.describe('Homepage', () => {
  test('affiche l’accueil de l’association : son nom en titre et en h1', async ({
    page,
  }) => {
    await page.goto('/')

    // Titre de la page d'accueil : le nom de l'association du domaine (s11)
    await expect(page).toHaveTitle('TechCorp Solutions')
    await expect(
      page.getByRole('heading', {level: 1, name: 'TechCorp Solutions'})
    ).toBeVisible()
    await expect(
      page.getByRole('heading', {level: 2, name: 'Dernières actualités'})
    ).toBeVisible()
  })

  test('porte l’en-tête du site public', async ({page}) => {
    await page.goto('/')

    await expect(page.getByRole('banner')).toBeVisible()
  })

  test('ne sert rien de la vitrine du boilerplate', async ({page}) => {
    await page.goto('/')

    await expect(
      page.getByRole('heading', {level: 1, name: 'TechCorp Solutions'})
    ).toBeVisible()
    await expect(page.getByText('Essayez gratuitement')).toHaveCount(0)
    await expect(page.getByText(/La plateforme SaaS moderne/)).toHaveCount(0)
  })
})
