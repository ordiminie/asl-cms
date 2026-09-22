import {expect, Page, test} from '@playwright/test'

/**
 * Navigation du site public — s04b, critères 1 à 7.
 *
 * Ce que seuls un navigateur, deux domaines et un serveur qui tourne
 * prouvent : le menu composé par le bureau rendu au visiteur, son isolation
 * entre deux associations, le refus d'un membre hors bureau, et surtout les
 * deux invalidations de cache — **publier une page depuis l'éditeur de s04
 * met à jour le menu qui la référence, sans redémarrage** (critère 5), et une
 * entrée basculée sur « masquée » reste absente même quand sa page est
 * publiée (critère 6).
 */

/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
/* eslint-enable no-restricted-properties */

/** TechCorp Solutions dans le seed. */
const TENANT_A = `http://localhost:${PORT}`
/** Marketing Pro dans le seed. */
const TENANT_B = `http://127.0.0.1:${PORT}`

const PASSWORD = 'Azerty123'
/** Présidente de TechCorp Solutions. */
const OWNER_A = 'user-owner@gmail.com'
/** Membre simple de TechCorp Solutions, jamais du bureau. */
const MEMBER_A = 'user@gmail.com'

const NAVIGATION_ROUTE = '/fr/bureau/navigation'
const NAVIGATION_TITLE = 'Navigation du site'
const DENIED_TITLE = "Cette page est réservée au bureau de l'association"
/** Une page publique du socle : elle porte l'en-tête et le pied de page du site. */
const PUBLIC_ROUTE = '/fr/privacy'

const unique = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`

const login = async (page: Page, base: string, email: string) => {
  await page.goto(`${base}/fr/login/prestataire`)
  await expect(page.locator('form')).toBeVisible()
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.toString().includes('/login'), {
    timeout: 15_000,
  })
}

/**
 * La bande d'état de l'éditeur de s04. Elle porte l'état persisté en attribut
 * (`draft`, `live`, `dirty`, `publishing`) : une assertion dessus ne dépend
 * ni d'un libellé ni d'un délai.
 */
const editorStatus = (page: Page) => page.locator('[data-status]').first()

/** Crée une page en brouillon, titre et adresse renseignés, et l'enregistre. */
const createDraftPage = async (
  page: Page,
  base: string,
  title: string,
  slug: string
) => {
  await page.goto(`${base}/fr/bureau/pages`, {waitUntil: 'load'})
  await page.getByRole('button', {name: 'Nouvelle page'}).click()
  await page.waitForURL(/\/bureau\/pages\/[0-9a-f-]{36}/, {timeout: 20_000})
  await expect(page.getByLabel('Adresse de la page')).toBeVisible({
    timeout: 20_000,
  })

  // La saisie n'est prise que lorsque l'editeur est hydrate : saisie avant,
  // elle reste dans le DOM sans atteindre l'etat React, et l'enregistrement
  // partirait avec le titre par defaut — silencieusement. L'apparition de
  // « Modifications non enregistrées » est la preuve que l'etat a recu la
  // frappe ; on reessaye tant qu'elle n'est pas la.
  await expect(async () => {
    await page.getByLabel('Titre', {exact: true}).fill(title)
    await expect(page.getByText('Modifications non enregistrées')).toBeVisible({
      timeout: 2000,
    })
  }).toPass({timeout: 30_000})

  await page.getByLabel('Adresse de la page').fill(slug)
  await expect(page.getByLabel('Adresse de la page')).toHaveValue(slug)

  const editorUrl = page.url()
  await page.getByRole('button', {name: 'Enregistrer le brouillon'}).click()

  // La bande d'etat passe `dirty` -> `publishing` -> `draft` : c'est le retour
  // a `draft`, apres le passage par `dirty`, qui atteste l'enregistrement.
  // Guetter la disparition de « Modifications non enregistrées » ne prouverait
  // rien : elle disparait des le clic, l'ecriture encore en vol.
  await expect(editorStatus(page)).toHaveAttribute('data-status', 'draft', {
    timeout: 20_000,
  })

  return editorUrl
}

const openNavigation = async (page: Page, base: string) => {
  await page.goto(`${base}${NAVIGATION_ROUTE}`, {waitUntil: 'load'})
  await expect(
    page.getByRole('heading', {level: 1, name: NAVIGATION_TITLE})
  ).toBeVisible({timeout: 20_000})
}

/** Ajoute au menu l'entrée pointant vers la page de ce titre (effet immédiat). */
const addMenuEntry = async (page: Page, title: string) => {
  // Le sélecteur ne s'ouvre qu'une fois l'écran hydraté : on réessaye jusqu'à
  // ce que l'entrée soit dans la liste, seule preuve que l'ajout a porté.
  await expect(async () => {
    await page.getByRole('button', {name: 'Ajouter une entrée'}).click()
    await page.getByPlaceholder('Rechercher une page').fill(title)
    await page.getByRole('option', {name: title}).click({timeout: 5000})
    await expect(page.locator('li', {hasText: title})).toBeVisible({
      timeout: 5000,
    })
  }).toPass({timeout: 30_000})
}

const publishPage = async (page: Page, editorUrl: string) => {
  await page.goto(editorUrl, {waitUntil: 'load'})
  await expect(page.getByLabel('Adresse de la page')).toBeVisible({
    timeout: 20_000,
  })
  // Le clic peut précéder l'hydratation : on réessaye jusqu'à ce que la bande
  // d'état passe à « en ligne », seul témoin que la publication est écrite.
  await expect(async () => {
    await page.getByRole('button', {name: 'Publier la page'}).click()
    await expect(editorStatus(page)).toHaveAttribute('data-status', 'live', {
      timeout: 5000,
    })
  }).toPass({timeout: 30_000})
}

/** Le menu tel que le visiteur le voit sur ce domaine. */
const publicMenu = (page: Page) =>
  page.getByRole('navigation', {name: 'Menu du site'})

test.describe.configure({mode: 'serial'})

test.describe('Navigation du site — composition et rendu public', () => {
  test('le menu et le pied de page d’une association ne paraissent pas sur le domaine de l’autre', async ({
    page,
    browser,
  }) => {
    const title = unique('Qualité de l’eau')
    const slug = unique('qualite-de-leau')
    const footer = unique('Les Amis de l’Étang — contact')

    await login(page, TENANT_A, OWNER_A)
    const editorUrl = await createDraftPage(page, TENANT_A, title, slug)
    await publishPage(page, editorUrl)

    await openNavigation(page, TENANT_A)
    await addMenuEntry(page, title)

    // Le clic peut précéder l'hydratation : on réessaye jusqu'à l'accusé
    // d'enregistrement, écrit dans la page (jamais un toast, design system §5).
    await expect(async () => {
      await page.getByLabel('Contenu du pied de page').fill(`## ${footer}`)
      await page.getByRole('button', {name: 'Enregistrer'}).click()
      await expect(page.getByText('Pied de page enregistré.')).toBeVisible({
        timeout: 5000,
      })
    }).toPass({timeout: 30_000})

    // Critères 1 et 3 : le visiteur du domaine A voit l'entrée et le pied de page.
    const visitor = await browser.newContext()
    const visitorPage = await visitor.newPage()
    await visitorPage.goto(`${TENANT_A}${PUBLIC_ROUTE}`, {waitUntil: 'load'})
    await expect(
      publicMenu(visitorPage).getByRole('link', {name: title})
    ).toBeVisible({
      timeout: 20_000,
    })
    await expect(
      visitorPage.getByRole('contentinfo').getByText(footer)
    ).toBeVisible()

    // Critère 4 : rien de tout cela sur le domaine de l'autre association.
    await visitorPage.goto(`${TENANT_B}${PUBLIC_ROUTE}`, {waitUntil: 'load'})
    await expect(visitorPage.getByText(title)).toBeHidden({timeout: 20_000})
    await expect(visitorPage.getByText(footer)).toBeHidden()

    await visitor.close()
  })

  test('publier une page met à jour le menu qui la référence, sans redémarrage, et une entrée masquée reste absente', async ({
    page,
    browser,
  }) => {
    const title = unique('Compte-rendu AG')
    const slug = unique('compte-rendu-ag')

    await login(page, TENANT_A, OWNER_A)
    const editorUrl = await createDraftPage(page, TENANT_A, title, slug)

    await openNavigation(page, TENANT_A)
    await addMenuEntry(page, title)
    await expect(page.getByText(/Masquée sur le site public/)).toBeVisible()

    // Critère 2 : l'entrée pointe vers un brouillon, elle ne parait pas.
    const visitor = await browser.newContext()
    const visitorPage = await visitor.newPage()
    await visitorPage.goto(`${TENANT_A}${PUBLIC_ROUTE}`, {waitUntil: 'load'})
    await expect(visitorPage.getByText(title)).toBeHidden({timeout: 20_000})

    // Critère 5 : publier depuis l'éditeur de s04 fait tomber le tag de la
    // navigation ; l'entrée parait au rechargement suivant, sans redémarrage.
    await publishPage(page, editorUrl)

    await visitorPage.goto(`${TENANT_A}${PUBLIC_ROUTE}`, {waitUntil: 'load'})
    await expect(
      publicMenu(visitorPage).getByRole('link', {name: title})
    ).toBeVisible({timeout: 20_000})

    // Critère 6 : la visibilité de l'entrée est indépendante du statut de sa
    // page — basculée sur « masquée », elle disparait bien que la page reste
    // publiée.
    await openNavigation(page, TENANT_A)
    const menuSwitch = () =>
      page.locator('li', {hasText: title}).getByRole('switch')

    // Le `switch` bascule tout de suite a l'ecran, l'ecriture derriere : c'est
    // l'ecran **rejoue par le serveur** qui atteste l'enregistrement, et lui
    // seul garantit que l'invalidation a deja eu lieu avant la visite suivante.
    await expect(async () => {
      await menuSwitch().click()
      await expect(menuSwitch()).toHaveAttribute('data-state', 'unchecked', {
        timeout: 2000,
      })
      await openNavigation(page, TENANT_A)
      await expect(menuSwitch()).toHaveAttribute('data-state', 'unchecked', {
        timeout: 5000,
      })
    }).toPass({timeout: 30_000})

    await visitorPage.goto(`${TENANT_A}${PUBLIC_ROUTE}`, {waitUntil: 'load'})
    await expect(visitorPage.getByText(title)).toBeHidden({timeout: 20_000})

    // La page, elle, reste atteignable par son adresse (critère 2).
    await visitorPage.goto(`${TENANT_A}/fr/${slug}`, {waitUntil: 'load'})
    await expect(
      visitorPage.getByRole('heading', {level: 1, name: title})
    ).toBeVisible({timeout: 20_000})

    await visitor.close()
  })
})

test.describe('Navigation du site — autorisation', () => {
  test('un membre non-bureau ne peut modifier ni le menu ni le pied de page', async ({
    page,
  }) => {
    await login(page, TENANT_A, MEMBER_A)
    await page.goto(`${TENANT_A}${NAVIGATION_ROUTE}`, {waitUntil: 'load'})

    await expect(page.getByText(DENIED_TITLE)).toBeVisible({timeout: 20_000})
    await expect(
      page.getByRole('button', {name: 'Ajouter une entrée'})
    ).toBeHidden()
    await expect(page.getByLabel('Contenu du pied de page')).toBeHidden()
    await expect(page.getByRole('switch')).toBeHidden()
  })
})
