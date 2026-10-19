import {expect, test} from '@playwright/test'

import {readSmokeTargets} from './smoke-targets'

/**
 * Test de fumee du serveur deploye (s12b, criteres 1, 2 et 5). Lance depuis le
 * poste, contre les domaines reels : `pnpm test:smoke`. Ne tourne jamais en CI.
 */
// eslint-disable-next-line no-restricted-properties
const {associations, unknownDomain} = readSmokeTargets(process.env)

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

for (const [index, {domain, name}] of associations.entries()) {
  const other = associations[1 - index]

  test.describe(`association « ${name} »`, () => {
    test('sert son site en HTTPS, certificat valide, sous son nom', async ({
      page,
    }) => {
      const response = await page.goto(`https://${domain}/`)

      expect(response?.status()).toBe(200)
      expect(page.url()).toMatch(
        new RegExp(`^https://${escapeRegExp(domain)}/`)
      )
      await expect(page).toHaveTitle(new RegExp(escapeRegExp(name)))
      await expect(page).not.toHaveTitle(new RegExp(escapeRegExp(other.name)))
    })

    test('sert son favicon (200)', async ({request}) => {
      const response = await request.get(
        `https://${domain}/api/identity/favicon`
      )
      expect(response.status()).toBe(200)
    })

    test('redirige HTTP vers HTTPS', async ({request}) => {
      const response = await request.get(`http://${domain}/`, {
        maxRedirects: 0,
      })

      expect([301, 308]).toContain(response.status())
      expect(response.headers()['location']).toMatch(
        new RegExp(`^https://${escapeRegExp(domain)}/`)
      )
    })
  })
}

test.describe('domaine routé mais sans association', () => {
  test('le favicon répond 404', async ({request}) => {
    const response = await request.get(
      `https://${unknownDomain}/api/identity/favicon`
    )
    expect(response.status()).toBe(404)
  })

  test('la page d’accueil affiche l’écran introuvable, sans contenu d’association', async ({
    page,
  }) => {
    // Statut 200 assume : sous Cache Components, notFound() part apres le
    // debut de la reponse (ADR 013).
    await page.goto(`https://${unknownDomain}/`)

    await expect(page.getByText('Page non trouvée')).toBeVisible()
    for (const {name} of associations) {
      await expect(page.getByText(name)).toHaveCount(0)
    }
  })
})
