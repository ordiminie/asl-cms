/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import path from 'node:path'

import {expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'
import sharp from 'sharp'

/**
 * Fiches du bureau — s06, critères 1 à 4.
 *
 * Trois choses ne sont prouvables qu'ici : la **RLS** et l'accès croisé
 * (`db.ts` refuse toute connexion en test), les **rangs contigus en base**
 * après une suppression — l'ordre affiché seul ne prouverait rien — et les
 * **dimensions réelles** du fichier servi, où se prouve le redimensionnement
 * du critère 2.
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

const BOARD_ROUTE = '/fr/bureau/le-bureau'
const PUBLIC_BOARD_ROUTE = '/fr/le-bureau'
const DENIED_TITLE = "Cette page est réservée au bureau de l'association"

/** Le carré stocké, ADR 024. */
const STORED_SIZE = 512

/** Un PNG paysage, décodable : le redimensionnement doit vraiment le recadrer. */
let portraitFixture: Buffer | undefined
const portraitPng = async (): Promise<Buffer> => {
  portraitFixture ??= await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: {r: 120, g: 160, b: 200},
    },
  })
    .png()
    .toBuffer()
  return portraitFixture
}

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

/** Les rangs des fiches restantes, dans l'ordre — la preuve du critère 3. */
const ranksOf = async (namePattern: string): Promise<number[]> =>
  withAppRoleClient(async (client) => {
    await client.query('begin')
    await client.query(`select set_config('app.bypass_rls', 'on', true)`)
    const result = await client.query<{rank: number}>(
      `select rank from board_member where name like $1 order by rank`,
      [namePattern]
    )
    await client.query('commit')
    return result.rows.map((row) => row.rank)
  })

const photoKeyOf = async (name: string): Promise<string | null> =>
  withAppRoleClient(async (client) => {
    await client.query('begin')
    await client.query(`select set_config('app.bypass_rls', 'on', true)`)
    const result = await client.query<{photo_key: string | null}>(
      `select photo_key from board_member where name = $1`,
      [name]
    )
    await client.query('commit')
    return result.rows[0]?.photo_key ?? null
  })

/** Chaque test nettoie derrière lui : une base locale se relit deux fois. */
const deleteBoardMembersLike = async (...patterns: string[]) => {
  await withAppRoleClient(async (client) => {
    await client.query('begin')
    await client.query(`select set_config('app.bypass_rls', 'on', true)`)
    for (const pattern of patterns) {
      await client.query(`delete from board_member where name like $1`, [
        pattern,
      ])
    }
    await client.query('commit')
  })
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

/**
 * Les lignes de la liste réordonnable, **scopées à la carte** : la barre
 * latérale du bureau rend elle aussi des `<li>`, et un `getByRole('listitem')`
 * global viserait la mauvaise ligne.
 */
const boardRows = (page: Page) => page.locator('[data-slot="card"] li')

const openBoardList = async (page: Page, base: string) => {
  await page.goto(`${base}${BOARD_ROUTE}`, {waitUntil: 'load'})
  await expect(
    page.getByRole('heading', {level: 1, name: 'Membres du bureau'})
  ).toBeVisible({timeout: 20_000})
}

const createBoardMember = async (
  page: Page,
  base: string,
  {
    name,
    roleLabel,
    biography,
    withPhoto = false,
  }: {
    name: string
    roleLabel: string
    biography?: string
    withPhoto?: boolean
  }
) => {
  await page.goto(`${base}${BOARD_ROUTE}/nouveau`, {waitUntil: 'load'})
  await expect(page.getByLabel('Nom', {exact: true})).toBeVisible({
    timeout: 20_000,
  })

  await page.getByLabel('Nom', {exact: true}).fill(name)
  await page.getByLabel('Rôle dans le bureau').fill(roleLabel)
  if (biography) {
    await page.getByLabel(/Biographie/).fill(biography)
  }
  if (withPhoto) {
    await page.locator('#file-upload-handle').setInputFiles({
      name: 'portrait.png',
      mimeType: 'image/png',
      buffer: await portraitPng(),
    })
  }

  await page.getByRole('button', {name: 'Enregistrer la fiche'}).click()
  await expect(page.getByText('Fiche enregistrée.')).toBeVisible({
    timeout: 30_000,
  })
}

const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
const named = (first: string) => `${first} Bureau${suffix}`

test.describe.configure({mode: 'serial'})

test.describe('Fiches du bureau — bureau et site public', () => {
  test.afterAll(async () => {
    await deleteBoardMembersLike(`%Bureau${suffix}`, 'Isolation RLS s06%')
  })

  test('la présidente crée cinq fiches : elles paraissent dans l’ordre, la fiche sans photo montre ses initiales', async ({
    page,
    browser,
  }) => {
    await login(page, TENANT_A, OWNER_A)

    await createBoardMember(page, TENANT_A, {
      name: named('Claire'),
      roleLabel: 'Présidente',
      biography: 'Présidente depuis 2022.',
      withPhoto: true,
    })
    await createBoardMember(page, TENANT_A, {
      name: named('Michel'),
      roleLabel: 'Vice-président',
      biography: 'Référent des chemins.',
    })
    await createBoardMember(page, TENANT_A, {
      name: named('Sylvie'),
      roleLabel: 'Trésorière',
      biography: 'Suit les comptes.',
    })
    await createBoardMember(page, TENANT_A, {
      name: named('Jean-Pierre'),
      roleLabel: 'Secrétaire',
      biography: 'Rédige les comptes rendus.',
    })
    // Sans biographie : la fiche s'arrête au rôle (critère 1).
    await createBoardMember(page, TENANT_A, {
      name: named('Hélène'),
      roleLabel: "Référente qualité de l'eau",
    })

    const visitor = await browser.newContext()
    const visitorPage = await visitor.newPage()
    try {
      await visitorPage.goto(`${TENANT_A}${PUBLIC_BOARD_ROUTE}`, {
        waitUntil: 'load',
      })

      const names = visitorPage.locator('ol li h2')
      await expect(names.first()).toHaveText(named('Claire'), {
        timeout: 20_000,
      })
      await expect(names).toHaveText([
        named('Claire'),
        named('Michel'),
        named('Sylvie'),
        named('Jean-Pierre'),
        named('Hélène'),
      ])

      // Critère 4 : initiales, jamais une image cassée.
      const withoutPhoto = visitorPage.locator('ol li').nth(4)
      await expect(withoutPhoto.getByText('HB', {exact: true})).toBeVisible()
      await expect(withoutPhoto.locator('img')).toHaveCount(0)
    } finally {
      await visitor.close()
    }
  })

  test('la photo déposée est servie redimensionnée en WebP de 512 px (critère 2)', async ({
    request,
  }) => {
    const key = await photoKeyOf(named('Claire'))
    expect(key, 'la fiche doit porter une clé de photo').toBeTruthy()
    expect(key).toContain('/board/')
    expect(key).toMatch(/\.webp$/)

    const response = await request.get(`${TENANT_A}/api/files/${key}`)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('image/webp')

    const metadata = await sharp(await response.body()).metadata()
    expect(metadata.format).toBe('webp')
    expect(metadata.width).toBe(STORED_SIZE)
    expect(metadata.height).toBe(STORED_SIZE)
  })

  test('« Monter » puis l’annulation rendent l’ordre précédent au public', async ({
    page,
    browser,
  }) => {
    await login(page, TENANT_A, OWNER_A)
    await openBoardList(page, TENANT_A)

    const second = boardRows(page).nth(1)
    await second.getByRole('button', {name: 'Monter'}).click()

    const visitor = await browser.newContext()
    const visitorPage = await visitor.newPage()
    try {
      await expect(async () => {
        await visitorPage.goto(`${TENANT_A}${PUBLIC_BOARD_ROUTE}`, {
          waitUntil: 'load',
        })
        await expect(visitorPage.locator('ol li h2').first()).toHaveText(
          named('Michel'),
          {timeout: 5000}
        )
      }).toPass({timeout: 30_000})

      await page.getByRole('button', {name: 'Annuler le déplacement'}).click()

      await expect(async () => {
        await visitorPage.goto(`${TENANT_A}${PUBLIC_BOARD_ROUTE}`, {
          waitUntil: 'load',
        })
        await expect(visitorPage.locator('ol li h2').first()).toHaveText(
          named('Claire'),
          {timeout: 5000}
        )
      }).toPass({timeout: 30_000})
    } finally {
      await visitor.close()
    }
  })

  test('supprimer la 2ᵉ fiche de cinq la retire du public et renumérote sans trou (critère 3)', async ({
    page,
    browser,
  }) => {
    await login(page, TENANT_A, OWNER_A)
    await openBoardList(page, TENANT_A)

    expect(await ranksOf(`%Bureau${suffix}`)).toEqual([0, 1, 2, 3, 4])

    const second = boardRows(page).nth(1)
    await second.getByRole('button', {name: 'Supprimer'}).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText(named('Michel'))
    await dialog.getByRole('button', {name: 'Supprimer la fiche'}).click()

    await expect(page.getByText(/renumérotées/)).toBeVisible({timeout: 20_000})

    // La preuve qui compte : les rangs en base, sans trou. L'ordre affiché
    // seul ne prouverait rien — il se lit tout aussi bien sur 0, 2, 3, 4.
    await expect(async () => {
      expect(await ranksOf(`%Bureau${suffix}`)).toEqual([0, 1, 2, 3])
    }).toPass({timeout: 20_000})

    const visitor = await browser.newContext()
    const visitorPage = await visitor.newPage()
    try {
      await expect(async () => {
        await visitorPage.goto(`${TENANT_A}${PUBLIC_BOARD_ROUTE}`, {
          waitUntil: 'load',
        })
        await expect(visitorPage.locator('ol li h2')).toHaveCount(4, {
          timeout: 5000,
        })
      }).toPass({timeout: 30_000})

      await expect(visitorPage.getByText(named('Michel'))).toHaveCount(0)
    } finally {
      await visitor.close()
    }
  })

  test('supprimer une fiche efface sa photo : son adresse répond 404', async ({
    page,
    request,
  }) => {
    const key = await photoKeyOf(named('Claire'))
    expect(key).toBeTruthy()
    expect((await request.get(`${TENANT_A}/api/files/${key}`)).status()).toBe(
      200
    )

    await login(page, TENANT_A, OWNER_A)
    await openBoardList(page, TENANT_A)

    const first = boardRows(page).first()
    await first.getByRole('button', {name: 'Supprimer'}).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText(named('Claire'))
    await dialog.getByRole('button', {name: 'Supprimer la fiche'}).click()
    await expect(page.getByText(/renumérot|aucune fiche/)).toBeVisible({
      timeout: 20_000,
    })

    await expect(async () => {
      const response = await request.get(
        `${TENANT_A}/api/files/${key}?relecture=${Date.now()}`
      )
      expect(response.status()).toBe(404)
    }).toPass({timeout: 20_000})
  })

  test('un membre simple n’atteint pas l’écran du bureau', async ({page}) => {
    await login(page, TENANT_A, MEMBER_A)
    await page.goto(`${TENANT_A}${BOARD_ROUTE}`, {waitUntil: 'load'})

    await expect(page.getByText(DENIED_TITLE)).toBeVisible({timeout: 20_000})
    await expect(
      page.getByRole('heading', {level: 1, name: 'Membres du bureau'})
    ).toHaveCount(0)
  })

  test('les fiches d’une association sont absentes du site de l’autre', async ({
    browser,
  }) => {
    const visitor = await browser.newContext()
    const visitorPage = await visitor.newPage()
    try {
      await visitorPage.goto(`${TENANT_B}${PUBLIC_BOARD_ROUTE}`, {
        waitUntil: 'load',
      })
      await expect(
        visitorPage.getByRole('heading', {level: 1, name: 'Le bureau'})
      ).toBeVisible({timeout: 20_000})
      await expect(visitorPage.getByText(`Bureau${suffix}`)).toHaveCount(0)
    } finally {
      await visitor.close()
    }
  })

  test('la RLS refuse de lire la fiche d’une association depuis le scope de l’autre', async () => {
    await withAppRoleClient(async (client) => {
      const ids = await tenantIds(client)

      const inserted = await inTenantScope(client, ids.a, async () => {
        const result = await client.query<{id: string}>(
          `insert into board_member (organization_id, name, role_label, rank)
           values ($1, 'Isolation RLS s06', 'Présidente', 0) returning id`,
          [ids.a]
        )
        return result.rows[0].id
      })

      const fromOtherTenant = await inTenantScope(client, ids.b, () =>
        client.query(`select id from board_member where id = $1`, [inserted])
      )
      expect(
        fromOtherTenant.rowCount,
        'un oubli de scope ne fuite pas : il ne retourne rien'
      ).toBe(0)

      const withoutScope = await client.query(
        `select id from board_member where id = $1`,
        [inserted]
      )
      expect(withoutScope.rowCount).toBe(0)

      await inTenantScope(client, ids.a, () =>
        client.query(`delete from board_member where id = $1`, [inserted])
      )
    })
  })
})
