import {expect, test} from '@playwright/test'

/**
 * Garde-fou : l'application est-elle réellement stylée ?
 *
 * `globals.css` était importé par `src/app/layout.tsx`. La migration a supprimé
 * ce fichier pour faire de `[locale]/layout.tsx` la racine, et l'import est
 * parti avec — le build de production sortait alors sans aucune feuille de
 * style. Ni le build, ni tsc, ni les 381 tests unitaires, ni les 22 specs e2e
 * ne l'ont vu : un import CSS manquant n'est une erreur pour personne, et une
 * assertion de DOM passe très bien sur une page sans styles.
 */

const ROUTES = ['/en', '/en/login', '/en/blog', '/en/pricing']

for (const route of ROUTES) {
  test(`${route} charge la feuille de styles de l'application`, async ({
    page,
  }) => {
    await page.goto(route)

    // Une feuille servie par Next, et pas seulement celle d'une dépendance.
    const stylesheets = await page
      .locator('link[rel="stylesheet"][href*="/_next/static/"]')
      .count()
    expect(stylesheets).toBeGreaterThan(0)

    // Et surtout : Tailwind produit-il vraiment quelque chose ? On vérifie
    // qu'une utilitaire connue résout, plutôt que de faire confiance au <link>.
    const flexResolves = await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.className = 'flex'
      document.body.append(probe)
      const display = getComputedStyle(probe).display
      probe.remove()
      return display
    })
    expect(flexResolves).toBe('flex')
  })
}
