/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import path from 'node:path'

import {expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Pages du site — s04, critères 1 à 9.
 *
 * Ce que seuls un navigateur, deux domaines et la base prouvent : le cycle
 * brouillon → publiée → dépubliée → republiée, le réordonnancement **au
 * clavier seul**, le rendu public dans l'ordre après rechargement, l'isolation
 * RLS de `page` / `content_block`, et le bloc de type inconnu inséré
 * directement en base — aucun chemin de l'interface ne le produit.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
/** TechCorp Solutions dans le seed. */
const TENANT_A = `http://localhost:${PORT}`
/** Marketing Pro dans le seed. */
const TENANT_B = `http://127.0.0.1:${PORT}`

const PASSWORD = 'Azerty123'
/** Présidente de TechCorp Solutions. */
const OWNER_A = 'user-owner@gmail.com'
/** Membre simple de TechCorp Solutions, jamais du bureau. */
const MEMBER_A = 'user@gmail.com'
/** Bureau de Marketing Pro. */
const BOARD_B = 'user-admin@gmail.com'

const PAGES_ROUTE = '/fr/bureau/pages'
const PAGES_TITLE = 'Pages'
const DENIED_TITLE = "Cette page est réservée au bureau de l'association"
const NOT_FOUND_TITLE = 'Page non trouvée'

const databaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const testEnvPath = path.resolve(process.cwd(), '.env.test')
  const parsed = fs.existsSync(testEnvPath)
    ? dotenv.parse(fs.readFileSync(testEnvPath))
    : {}

  const url = parsed.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL introuvable : la preuve RLS attaque la base en direct.'
    )
  }
  return url
}

/** Une connexion sous le rôle applicatif, soumis à la RLS forcée. */
const withAppRoleClient = async <T>(
  callback: (client: Client) => Promise<T>
): Promise<T> => {
  const client = new Client({connectionString: databaseUrl()})
  await client.connect()
  try {
    return await callback(client)
  } finally {
    await client.end()
  }
}

const tenantIds = async (client: Client) => {
  const result = await client.query<{slug: string; id: string}>(
    `select slug, id from organization where slug in ('techcorp-solutions', 'marketing-pro')`
  )
  const bySlug = new Map(result.rows.map((row) => [row.slug, row.id]))
  const a = bySlug.get('techcorp-solutions')
  const b = bySlug.get('marketing-pro')
  expect(a, 'le seed doit porter les deux associations').toBeTruthy()
  expect(b, 'le seed doit porter les deux associations').toBeTruthy()
  return {a: a as string, b: b as string}
}

const inTenantScope = async <T>(
  client: Client,
  organizationId: string,
  callback: () => Promise<T>
): Promise<T> => {
  await client.query('begin')
  try {
    await client.query(`select set_config('app.organization_id', $1, true)`, [
      organizationId,
    ])
    const result = await callback()
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  }
}

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

const openPagesList = async (page: Page, base: string) => {
  await page.goto(`${base}${PAGES_ROUTE}`, {waitUntil: 'load'})
  await expect(
    page.getByRole('heading', {level: 1, name: PAGES_TITLE})
  ).toBeVisible({timeout: 20_000})
}

/** Crée une page et ouvre son éditeur ; rend le slug enregistré. */
const createPage = async (page: Page, base: string) => {
  await openPagesList(page, base)
  await page.getByRole('button', {name: 'Nouvelle page'}).click()
  await page.waitForURL(/\/bureau\/pages\/[0-9a-f-]{36}/, {timeout: 20_000})
  await expect(page.getByLabel('Adresse de la page')).toBeVisible({
    timeout: 20_000,
  })
  return page.url()
}

const addTextBlock = async (page: Page, text: string) => {
  await page.getByRole('button', {name: 'Ajouter un bloc'}).last().click()
  await page
    .getByRole('dialog')
    .getByRole('button', {name: /^Texte riche/})
    .click()
  const editors = page.getByLabel('Texte', {exact: true})
  await editors.last().fill(text)
}

const saveDraft = async (page: Page) => {
  await page.getByRole('button', {name: 'Enregistrer le brouillon'}).click()
  await expect(page.getByText('Modifications non enregistrées')).toBeHidden({
    timeout: 20_000,
  })
}

/**
 * Le corps de la page publique, espaces normalises : `innerText` depend de la
 * mise en page au moment de la lecture, et comparer deux relectures brutes
 * rendrait le test instable sans rien prouver de plus.
 */
const articleText = async (page: Page) => {
  await expect(page.locator('article h1')).toBeVisible({timeout: 20_000})
  const text = await page.locator('article').innerText()
  return text.replaceAll(/\s+/g, ' ').trim()
}

const uniqueSlug = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`

test.describe.configure({mode: 'serial'})

test.describe('Pages du site — bureau', () => {
  test('crée une page de plusieurs blocs, réordonne au clavier, publie, dépublie, republie', async ({
    page,
    browser,
  }) => {
    const slug = uniqueSlug('qualite-de-leau')

    await login(page, TENANT_A, OWNER_A)
    await createPage(page, TENANT_A)

    await page.getByLabel('Titre', {exact: true}).fill("Qualité de l'eau")
    await page.getByLabel('Adresse de la page').fill(slug)

    await addTextBlock(page, 'Premier bloc')
    await addTextBlock(page, 'Deuxieme bloc')
    await addTextBlock(page, 'Troisieme bloc')
    await saveDraft(page)

    // Critère 2 : un visiteur ne voit pas un brouillon.
    const visitor = await browser.newContext()
    const visitorPage = await visitor.newPage()
    await visitorPage.goto(`${TENANT_A}/fr/${slug}`, {waitUntil: 'load'})
    await expect(visitorPage.getByText(NOT_FOUND_TITLE)).toBeVisible({
      timeout: 20_000,
    })
    await expect(visitorPage.getByText('Premier bloc')).toBeHidden()

    // Critère 2 (suite) : le bureau, lui, prévisualise le même brouillon.
    await page.goto(`${TENANT_A}/fr/${slug}`, {waitUntil: 'load'})
    await expect(page.getByText(/Aperçu du bureau/)).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText('Premier bloc')).toBeVisible()

    // Critères 7 et 8 : réordonnancement au clavier seul, sans glisser-déposer.
    await page.goBack()
    await expect(page.getByLabel('Adresse de la page')).toBeVisible({
      timeout: 20_000,
    })

    await page.keyboard.press('Tab')
    const moveDownButtons = page.getByRole('button', {name: 'Descendre'})
    await moveDownButtons.first().focus()
    await page.keyboard.press('Enter')

    await expect(page.getByText(/a été déplacé/)).toBeVisible({timeout: 5000})

    // Le premier bloc de la liste ne peut plus monter : bouton visible, désactivé.
    await expect(
      page.getByRole('button', {name: 'Monter'}).first()
    ).toBeDisabled()

    await page.getByRole('button', {name: 'Publier la page'}).click()
    await expect(page.getByText('En ligne')).toBeVisible({timeout: 20_000})

    // Critère 1 et 7 : rendu public dans l'ordre, après rechargement.
    await visitorPage.goto(`${TENANT_A}/fr/${slug}`, {waitUntil: 'load'})
    const publishedText = await articleText(visitorPage)
    expect(publishedText).toContain('Premier bloc')
    expect(publishedText.indexOf('Deuxieme bloc')).toBeLessThan(
      publishedText.indexOf('Premier bloc')
    )
    expect(publishedText.indexOf('Premier bloc')).toBeLessThan(
      publishedText.indexOf('Troisieme bloc')
    )

    // Critère 3 : dépublier retire du site public sans rien supprimer.
    await page.goto(`${TENANT_A}${PAGES_ROUTE}`, {waitUntil: 'load'})
    await page.getByRole('link', {name: 'Modifier'}).first().click()
    await expect(page.getByLabel('Adresse de la page')).toBeVisible({
      timeout: 20_000,
    })
    await page.getByRole('button', {name: 'Dépublier la page'}).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', {name: 'Dépublier la page'})
      .click()
    await expect(page.getByText('Dépubliée')).toBeVisible({timeout: 20_000})

    await visitorPage.goto(`${TENANT_A}/fr/${slug}`, {waitUntil: 'load'})
    await expect(visitorPage.getByText(NOT_FOUND_TITLE)).toBeVisible({
      timeout: 20_000,
    })

    // Critère 3 (suite) : republier restaure le contenu à l'identique.
    await page.getByRole('button', {name: 'Publier la page'}).click()
    await expect(page.getByText('En ligne')).toBeVisible({timeout: 20_000})

    await visitorPage.goto(`${TENANT_A}/fr/${slug}`, {waitUntil: 'load'})
    const republishedText = await articleText(visitorPage)
    expect(republishedText).toBe(publishedText)

    await visitor.close()
  })

  test('un slug déjà utilisé dans la même association est refusé sur le champ', async ({
    page,
  }) => {
    const first = uniqueSlug('adherer')

    await login(page, TENANT_A, OWNER_A)
    await createPage(page, TENANT_A)
    await page.getByLabel('Adresse de la page').fill(first)
    await saveDraft(page)

    await createPage(page, TENANT_A)
    await page.getByLabel('Adresse de la page').fill(first)
    await page.getByRole('button', {name: 'Enregistrer le brouillon'}).click()

    await expect(
      page.getByText('Ce slug est déjà utilisé par une autre page.')
    ).toBeVisible({timeout: 20_000})
  })
})

test.describe('Pages du site — autorisation et isolation', () => {
  test('un membre non-bureau ne voit pas la gestion des pages', async ({
    page,
  }) => {
    await login(page, TENANT_A, MEMBER_A)
    await page.goto(`${TENANT_A}${PAGES_ROUTE}`, {waitUntil: 'load'})

    await expect(page.getByText(DENIED_TITLE)).toBeVisible({timeout: 20_000})
    await expect(page.getByRole('button', {name: 'Nouvelle page'})).toBeHidden()
  })

  test('une page publiée par une association est invisible sur le domaine de l’autre, et le même slug y est libre', async ({
    page,
    browser,
  }) => {
    const shared = uniqueSlug('le-meme-slug')

    // Tenant A publie sa page.
    await login(page, TENANT_A, OWNER_A)
    await createPage(page, TENANT_A)
    await page.getByLabel('Titre', {exact: true}).fill('Page du tenant A')
    await page.getByLabel('Adresse de la page').fill(shared)
    await addTextBlock(page, 'Contenu du tenant A')
    await page.getByRole('button', {name: 'Publier la page'}).click()
    await expect(page.getByText('En ligne')).toBeVisible({timeout: 20_000})

    // Le même slug sur le domaine du tenant B : rien, même page publiée.
    const visitor = await browser.newContext()
    const visitorPage = await visitor.newPage()
    await visitorPage.goto(`${TENANT_B}/fr/${shared}`, {waitUntil: 'load'})
    await expect(visitorPage.getByText(NOT_FOUND_TITLE)).toBeVisible({
      timeout: 20_000,
    })
    await expect(visitorPage.getByText('Contenu du tenant A')).toBeHidden()

    // Critère 5 : le tenant B a le droit d'utiliser exactement le même slug.
    const boardB = await browser.newContext()
    const boardBPage = await boardB.newPage()
    await login(boardBPage, TENANT_B, BOARD_B)
    await createPage(boardBPage, TENANT_B)
    await boardBPage.getByLabel('Titre', {exact: true}).fill('Page du tenant B')
    await boardBPage.getByLabel('Adresse de la page').fill(shared)
    await addTextBlock(boardBPage, 'Contenu du tenant B')
    await boardBPage.getByRole('button', {name: 'Publier la page'}).click()
    await expect(boardBPage.getByText('En ligne')).toBeVisible({
      timeout: 20_000,
    })

    await visitorPage.goto(`${TENANT_B}/fr/${shared}`, {waitUntil: 'load'})
    await expect(visitorPage.getByText('Contenu du tenant B')).toBeVisible({
      timeout: 20_000,
    })
    await expect(visitorPage.getByText('Contenu du tenant A')).toBeHidden()

    await visitor.close()
    await boardB.close()
  })

  test('la RLS refuse de lire la page d’une association depuis le scope de l’autre', async () => {
    await withAppRoleClient(async (client) => {
      const ids = await tenantIds(client)

      const inserted = await inTenantScope(client, ids.a, async () => {
        const result = await client.query<{id: string}>(
          `insert into page (organization_id, slug, title, status)
           values ($1, $2, 'Isolation RLS', 'published') returning id`,
          [ids.a, uniqueSlug('isolation-rls')]
        )
        return result.rows[0].id
      })

      const fromOtherTenant = await inTenantScope(client, ids.b, () =>
        client.query(`select id from page where id = $1`, [inserted])
      )
      expect(
        fromOtherTenant.rowCount,
        'un oubli de scope ne fuite pas : il ne retourne rien'
      ).toBe(0)

      const withoutScope = await client.query(
        `select id from page where id = $1`,
        [inserted]
      )
      expect(withoutScope.rowCount).toBe(0)

      await inTenantScope(client, ids.a, () =>
        client.query(`delete from page where id = $1`, [inserted])
      )
    })
  })

  test('un bloc de type inconnu inséré en base ne casse pas le rendu et reste signalé au bureau', async ({
    page,
    browser,
  }) => {
    const slug = uniqueSlug('bloc-inconnu')

    await login(page, TENANT_A, OWNER_A)
    const editorUrl = await createPage(page, TENANT_A)
    await page.getByLabel('Titre', {exact: true}).fill('Page à bloc inconnu')
    await page.getByLabel('Adresse de la page').fill(slug)
    await addTextBlock(page, 'Bloc de texte visible')
    await page.getByRole('button', {name: 'Publier la page'}).click()
    await expect(page.getByText('En ligne')).toBeVisible({timeout: 20_000})

    const pageId = editorUrl.split('/').pop() as string

    // Aucun chemin de l'interface ne produit un type inconnu : on l'insère
    // directement en base, comme le ferait une version antérieure du code.
    await withAppRoleClient(async (client) => {
      const ids = await tenantIds(client)
      await inTenantScope(client, ids.a, () =>
        client.query(
          `insert into content_block (page_id, type, rank, data)
           values ($1, 'carrousel-2019', 1, '{"slides": []}'::jsonb)`,
          [pageId]
        )
      )
    })

    // Le rendu public s'affiche, le bloc inconnu est simplement absent.
    const visitor = await browser.newContext()
    const visitorPage = await visitor.newPage()
    await visitorPage.goto(`${TENANT_A}/fr/${slug}`, {waitUntil: 'load'})
    await expect(visitorPage.getByText('Bloc de texte visible')).toBeVisible({
      timeout: 20_000,
    })
    await expect(visitorPage.getByText('carrousel-2019')).toBeHidden()
    await visitor.close()

    // Côté bureau, le bloc est signalé, en lecture seule.
    await page.goto(editorUrl, {waitUntil: 'load'})
    await expect(
      page.getByText('Type de bloc inconnu (carrousel-2019)')
    ).toBeVisible({timeout: 20_000})
  })
})
