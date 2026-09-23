/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import path from 'node:path'

import {expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Actualités — s05, critères 1 à 4.
 *
 * Ce que seuls un navigateur, deux domaines et la base prouvent : le cycle
 * brouillon → publiée, l'ordre par date décroissante, la pagination au-delà de
 * dix actualités, l'URL qui ne bouge pas quand le titre change, et l'isolation
 * RLS de `news`.
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

const NEWS_ROUTE = '/fr/bureau/actualites'
const PUBLIC_NEWS_ROUTE = '/fr/actualites'
const DENIED_TITLE = "Cette page est réservée au bureau de l'association"
const NOT_FOUND_TITLE = 'Page non trouvée'

/** Un PNG minimal valide : la validation juge la signature binaire. */
const PNG_FIXTURE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

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

/**
 * Retire les actualités écrites par un test, par motif de titre.
 *
 * Chaque test qui publie nettoie derrière lui : sans ça, une exécution locale
 * répétée empile les lignes et finit par pousser hors de la première page
 * celles que la spec attend. La CI n'y est pas exposée — sa base est éphémère
 * et seedée — mais une spec qui suppose une base neuve ne se relit pas deux
 * fois de suite.
 */
const deleteNewsLike = async (...patterns: string[]) => {
  await withAppRoleClient(async (client) => {
    await client.query('begin')
    await client.query(`select set_config('app.bypass_rls', 'on', true)`)
    for (const pattern of patterns) {
      await client.query(`delete from news where title like $1`, [pattern])
    }
    await client.query('commit')
  })
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

const openNewsList = async (page: Page, base: string) => {
  await page.goto(`${base}${NEWS_ROUTE}`, {waitUntil: 'load'})
  await expect(
    page.getByRole('heading', {level: 1, name: 'Actualités'})
  ).toBeVisible({timeout: 20_000})
}

/** Crée une actualité en brouillon et ouvre son éditeur. */
const createNews = async (page: Page, base: string) => {
  await openNewsList(page, base)
  await page
    .getByRole('button', {name: /Nouvelle actualité|Écrire la première/})
    .first()
    .click()
  await page.waitForURL(/\/bureau\/actualites\/[0-9a-f-]{36}/, {
    timeout: 20_000,
  })
  await expect(page.getByLabel('Titre', {exact: true})).toBeVisible({
    timeout: 20_000,
  })
  return page.url()
}

const fillNews = async (
  page: Page,
  {title, date, content}: {title: string; date: string; content: string}
) => {
  await page.getByLabel('Titre', {exact: true}).fill(title)
  await page.getByLabel('Date', {exact: true}).fill(date)
  await page.getByLabel('Contenu', {exact: true}).fill(content)
}

const saveDraft = async (page: Page) => {
  await page.getByRole('button', {name: 'Enregistrer le brouillon'}).click()
  await expect(page.getByText('Brouillon enregistré.')).toBeVisible({
    timeout: 20_000,
  })
}

const publish = async (page: Page) => {
  await page
    .getByRole('button', {name: /Publier l'actualité|Enregistrer et mettre/})
    .click()
  await expect(
    page.getByText('Actualité publiée.', {exact: false})
  ).toBeVisible({timeout: 20_000})
}

const uniqueTitle = (prefix: string) =>
  `${prefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`

test.describe.configure({mode: 'serial'})

test.describe('Actualités — bureau et site public', () => {
  test('la présidente publie une actualité datée avec image : elle ouvre la liste publique', async ({
    page,
    browser,
  }) => {
    const title = uniqueTitle('Assemblée générale')

    await login(page, TENANT_A, OWNER_A)
    await createNews(page, TENANT_A)
    await fillNews(page, {
      title,
      // Date lointaine : l'actualité de ce test reste en tête de la liste,
      // quel que soit ce que les autres tests ont publié.
      date: '2031-06-01',
      content: "## Ordre du jour\n\nUn **point** important pour l'association.",
    })

    await page.locator('#file-upload-handle').setInputFiles({
      name: 'mare.png',
      mimeType: 'image/png',
      buffer: PNG_FIXTURE,
    })
    await expect(page.getByLabel('Texte alternatif')).toBeVisible({
      timeout: 20_000,
    })
    await page.getByLabel('Texte alternatif').fill('La mare au printemps')

    await publish(page)

    // Critères 1 et 2 : en tête de la liste publique, avec sa page dédiée.
    const visitor = await browser.newContext()
    const visitorPage = await visitor.newPage()
    try {
      await visitorPage.goto(`${TENANT_A}${PUBLIC_NEWS_ROUTE}`, {
        waitUntil: 'load',
      })
      const firstTitle = visitorPage.locator('li h2 a').first()
      await expect(firstTitle).toHaveText(title, {timeout: 20_000})

      await firstTitle.click()
      await expect(
        visitorPage.getByRole('heading', {level: 1, name: title})
      ).toBeVisible({timeout: 20_000})
      const article = visitorPage.locator('article')
      await expect(article.getByText('1 juin 2031')).toBeVisible()
      await expect(article.getByText('Ordre du jour')).toBeVisible()

      const image = article.getByRole('img', {name: 'La mare au printemps'})
      await expect(image).toBeVisible()

      // `getByRole('img')` passe aussi sur une image cassée : seul un appel à
      // l'adresse rendue prouve l'aller-retour disque, du dépôt à /api/files.
      const source = await image.getAttribute('src')
      expect(source, "l'image doit porter une adresse").toBeTruthy()
      const served = await visitorPage.request.get(
        new URL(source as string, TENANT_A).toString()
      )
      expect(served.status()).toBe(200)
      expect(served.headers()['content-type']).toContain('image/')
      expect(
        Buffer.from(await served.body()).equals(PNG_FIXTURE),
        'les octets servis sont ceux du fichier déposé'
      ).toBe(true)
    } finally {
      await deleteNewsLike(`${title}%`)
      await visitor.close()
    }
  })

  test('deux actualités paraissent de la plus récente à la plus ancienne', async ({
    page,
    browser,
  }) => {
    const recent = uniqueTitle('La plus récente')
    const older = uniqueTitle('La plus ancienne')

    await login(page, TENANT_A, OWNER_A)
    await createNews(page, TENANT_A)
    await fillNews(page, {
      title: older,
      date: '2029-03-02',
      content: 'Contenu ancien.',
    })
    await publish(page)

    await createNews(page, TENANT_A)
    await fillNews(page, {
      title: recent,
      date: '2029-09-02',
      content: 'Contenu récent.',
    })
    await publish(page)

    const visitor = await browser.newContext()
    const visitorPage = await visitor.newPage()
    try {
      await visitorPage.goto(`${TENANT_A}${PUBLIC_NEWS_ROUTE}`, {
        waitUntil: 'load',
      })

      const listText = await visitorPage.locator('ul').first().innerText()
      expect(listText.indexOf(recent)).toBeGreaterThanOrEqual(0)
      expect(listText.indexOf(older)).toBeGreaterThanOrEqual(0)
      expect(listText.indexOf(recent)).toBeLessThan(listText.indexOf(older))
    } finally {
      await deleteNewsLike(`${recent}%`, `${older}%`)
      await visitor.close()
    }
  })

  test("le titre modifié après publication ne change pas l'adresse", async ({
    page,
    browser,
  }) => {
    const title = uniqueTitle('Travaux du chemin')

    await login(page, TENANT_A, OWNER_A)
    await createNews(page, TENANT_A)
    await fillNews(page, {
      title,
      date: '2029-05-05',
      content: 'Les travaux commencent.',
    })
    await publish(page)

    const address = await page.getByText(/Adresse sur le site :/).innerText()
    const url = address.split(':')[1].trim()
    expect(url.startsWith('/actualites/')).toBe(true)

    const visitor = await browser.newContext()
    const visitorPage = await visitor.newPage()
    try {
      const renamed = `${title} (corrigé)`
      await page.getByLabel('Titre', {exact: true}).fill(renamed)
      await publish(page)
      await expect(page.getByText(url)).toBeVisible()

      await visitorPage.goto(`${TENANT_A}/fr${url}`, {waitUntil: 'load'})
      await expect(
        visitorPage.getByRole('heading', {level: 1, name: renamed})
      ).toBeVisible({timeout: 20_000})
    } finally {
      await deleteNewsLike(`${title}%`)
      await visitor.close()
    }
  })

  test('un brouillon reste invisible pour le visiteur, en aperçu pour le bureau', async ({
    page,
    browser,
  }) => {
    const title = uniqueTitle('Brouillon de la voirie')

    await login(page, TENANT_A, OWNER_A)
    await createNews(page, TENANT_A)
    await fillNews(page, {
      title,
      date: '2030-04-04',
      content: 'Contenu encore en brouillon.',
    })
    await saveDraft(page)

    const address = await page.getByText(/Adresse sur le site :/).innerText()
    const url = address.split(':')[1].trim()

    // Critère 3 : ni dans la liste, ni à son adresse, pour un visiteur.
    const visitor = await browser.newContext()
    const visitorPage = await visitor.newPage()
    await visitorPage.goto(`${TENANT_A}${PUBLIC_NEWS_ROUTE}`, {
      waitUntil: 'load',
    })
    await expect(visitorPage.getByText(title)).toBeHidden()

    await visitorPage.goto(`${TENANT_A}/fr${url}`, {waitUntil: 'load'})
    await expect(visitorPage.getByText(NOT_FOUND_TITLE)).toBeVisible({
      timeout: 20_000,
    })

    // Le bureau, lui, prévisualise le même brouillon.
    await page.goto(`${TENANT_A}/fr${url}`, {waitUntil: 'load'})
    await expect(page.getByText(/Aperçu/)).toBeVisible({timeout: 20_000})
    await expect(page.getByText('Contenu encore en brouillon.')).toBeVisible()

    await visitor.close()
  })

  test('un membre non-bureau ne voit pas la gestion des actualités', async ({
    page,
  }) => {
    await login(page, TENANT_A, MEMBER_A)
    await page.goto(`${TENANT_A}${NEWS_ROUTE}`, {waitUntil: 'load'})

    await expect(page.getByText(DENIED_TITLE)).toBeVisible({timeout: 20_000})
    await expect(
      page.getByRole('button', {name: 'Nouvelle actualité'})
    ).toBeHidden()
  })
})

test.describe('Actualités — pagination et isolation', () => {
  test('onze actualités publiées donnent deux pages, la plus ancienne en page 2', async ({
    page,
  }) => {
    const marker = `Pagination ${Date.now().toString(36)}`
    const oldest = `${marker} — la plus ancienne`

    // Insérées en SQL sous bypass : dix allers-retours dans l'éditeur ne
    // prouveraient rien de plus et tiendraient la suite plusieurs minutes. La
    // onzième, elle, est publiée par le bureau dans l'interface : une écriture
    // en SQL direct ne passe par aucune Server Action, donc par aucun
    // `updateTag` — sans elle, la liste publique resterait servie depuis le
    // cache et le test prouverait l'état d'une exécution précédente.
    await withAppRoleClient(async (client) => {
      const ids = await tenantIds(client)
      await client.query('begin')
      await client.query(`select set_config('app.bypass_rls', 'on', true)`)
      for (let index = 0; index < 10; index++) {
        const day = String(index + 1).padStart(2, '0')
        await client.query(
          `insert into news (organization_id, slug, title, published_on, content, status)
           values ($1, $2, $3, $4, 'Contenu de pagination', 'published')`,
          [
            ids.b,
            `pagination-${Date.now().toString(36)}-${index}`,
            index === 0 ? oldest : `${marker} — numéro ${index}`,
            `2027-01-${day}`,
          ]
        )
      }
      await client.query('commit')
    })

    try {
      await login(page, TENANT_B, BOARD_B)
      await createNews(page, TENANT_B)
      await fillNews(page, {
        title: `${marker} — publiée par le bureau`,
        date: '2027-02-01',
        content: 'Onzième actualité, publiée depuis l’interface.',
      })
      await publish(page)

      await page.goto(`${TENANT_B}${PUBLIC_NEWS_ROUTE}`, {waitUntil: 'load'})
      await expect(page.getByText('Page 1 sur 2')).toBeVisible({
        timeout: 20_000,
      })
      await expect(page.getByText(oldest)).toBeHidden()

      await page.getByRole('link', {name: 'Suivant →'}).click()
      await expect(page.getByText('Page 2 sur 2')).toBeVisible({
        timeout: 20_000,
      })
      await expect(page.getByText(oldest)).toBeVisible()
    } finally {
      await deleteNewsLike(`${marker}%`)
    }
  })

  test('une actualité publiée par une association est invisible sur le domaine de l’autre', async ({
    page,
    browser,
  }) => {
    const title = uniqueTitle('Actualité du tenant A')

    await login(page, TENANT_A, OWNER_A)
    await createNews(page, TENANT_A)
    await fillNews(page, {
      title,
      date: '2028-07-07',
      content: 'Contenu du tenant A.',
    })
    await publish(page)

    const address = await page.getByText(/Adresse sur le site :/).innerText()
    const url = address.split(':')[1].trim()

    const visitor = await browser.newContext()
    const visitorPage = await visitor.newPage()
    try {
      await visitorPage.goto(`${TENANT_B}${PUBLIC_NEWS_ROUTE}`, {
        waitUntil: 'load',
      })
      await expect(visitorPage.getByText(title)).toBeHidden()

      await visitorPage.goto(`${TENANT_B}/fr${url}`, {waitUntil: 'load'})
      await expect(visitorPage.getByText(NOT_FOUND_TITLE)).toBeVisible({
        timeout: 20_000,
      })
    } finally {
      await deleteNewsLike(`${title}%`)
      await visitor.close()
    }
  })

  test('la RLS refuse de lire l’actualité d’une association depuis le scope de l’autre', async () => {
    await withAppRoleClient(async (client) => {
      const ids = await tenantIds(client)

      const inserted = await inTenantScope(client, ids.a, async () => {
        const result = await client.query<{id: string}>(
          `insert into news (organization_id, slug, title, published_on, status)
           values ($1, $2, 'Isolation RLS', '2027-02-02', 'published') returning id`,
          [ids.a, `isolation-rls-${Date.now().toString(36)}`]
        )
        return result.rows[0].id
      })

      const fromOtherTenant = await inTenantScope(client, ids.b, () =>
        client.query(`select id from news where id = $1`, [inserted])
      )
      expect(
        fromOtherTenant.rowCount,
        'un oubli de scope ne fuite pas : il ne retourne rien'
      ).toBe(0)

      const withoutScope = await client.query(
        `select id from news where id = $1`,
        [inserted]
      )
      expect(withoutScope.rowCount).toBe(0)

      await inTenantScope(client, ids.a, () =>
        client.query(`delete from news where id = $1`, [inserted])
      )
    })
  })
})
