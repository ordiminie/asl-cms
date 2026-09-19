/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import path from 'node:path'

import {Browser, expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Paramètres de l'association — s02, critères 2 à 10.
 *
 * Ce que seuls un navigateur, deux domaines et la base prouvent : la lecture
 * du seed, la relecture après modification sans redéploiement, le refus en
 * interface **et** sur l'appel direct de l'action serveur, la teinte servie au
 * site public, et l'isolation RLS de `organization_setting`.
 *
 * Deux hôtes du loopback, deux associations du seed (voir
 * `tenant-isolation.spec.ts`) : `localhost` sert TechCorp Solutions (teinte
 * 150 au seed), `127.0.0.1` sert Marketing Pro (aucune teinte : la teinte par
 * défaut). Valeurs fictives du jeu de paramètres de test
 * (`src/db/scripts/tenant-settings-seed.ts`), jamais celles d'un client.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
const TENANT_A = `http://localhost:${PORT}`
const TENANT_B = `http://127.0.0.1:${PORT}`

const PASSWORD = 'Azerty123'
const SETTINGS_PAGE = '/fr/bureau/reglages'
const IDENTITY_PAGE = '/fr/bureau/identite'
const PUBLIC_PAGE = '/fr/privacy'
const SETTINGS_TITLE = "Réglages de l'association"
const IDENTITY_TITLE = "Identité de l'association"
const DENIED_TITLE = "Cette page est réservée au bureau de l'association"

const CONTACT_KEY = 'contact.email'
const FORAGE_KEY = 'forage.responsable.email'
const HUE_KEY = 'identity.accent_hue'

/** Le jeu de paramètres de test, tel que le seed le déclare. */
const SEED = {
  a: {contact: 'contact@techcorp-solutions.test', hue: '150'},
  b: {contact: 'contact@marketing-pro.test'},
}

const NEW_CONTACT_A = 'bureau@techcorp-solutions.test'
const REPLAYED_CONTACT_A = 'rejoue@techcorp-solutions.test'
const NEW_FORAGE_A = 'forage@techcorp-solutions.test'

const SAVED =
  'Réglages enregistrés. Les prochains messages partiront vers ces adresses.'
const INVALID_EMAIL = "Cette adresse n'est pas valide. Exemple : nom@domaine.fr"

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

/**
 * Une connexion sous le **rôle applicatif**, soumis à la RLS forcée : la
 * preuve d'isolation ne vaudrait rien sous le rôle propriétaire.
 */
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

/** Exécute `callback` dans une transaction scopée sur une association. */
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

/** Les paramètres stockés d'une association, lus sous son propre scope. */
const storedSettings = async (organizationSlug: 'a' | 'b') =>
  await withAppRoleClient(async (client) => {
    const ids = await tenantIds(client)
    const id = ids[organizationSlug]
    const rows = await inTenantScope(client, id, () =>
      client.query<{key: string; value: string}>(
        `select key, value from organization_setting where organization_id = $1`,
        [id]
      )
    )
    return Object.fromEntries(rows.rows.map((row) => [row.key, row.value]))
  })

/** Remet TechCorp au jeu de paramètres du seed : la spec est rejouable. */
const restoreTenantASeed = async () =>
  await withAppRoleClient(async (client) => {
    const {a} = await tenantIds(client)
    await inTenantScope(client, a, async () => {
      for (const [key, value] of [
        [CONTACT_KEY, SEED.a.contact],
        [HUE_KEY, SEED.a.hue],
      ]) {
        await client.query(
          `insert into organization_setting (organization_id, key, value)
           values ($1, $2, $3)
           on conflict (organization_id, key) do update set value = excluded.value`,
          [a, key, value]
        )
      }
      await client.query(
        `delete from organization_setting where organization_id = $1 and key = $2`,
        [a, FORAGE_KEY]
      )
    })
  })

const login = async (page: Page, base: string, email: string) => {
  await page.goto(`${base}/fr/login`)
  await expect(page.locator('form')).toBeVisible()
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.toString().includes('/login'), {
    timeout: 15_000,
  })
}

const newSession = async (browser: Browser, base: string, email: string) => {
  const page = await browser.newPage()
  await login(page, base, email)
  return page
}

const openSettingsPage = async (page: Page, base: string) => {
  await page.goto(`${base}${SETTINGS_PAGE}`, {waitUntil: 'load'})
  await expect(
    page.getByRole('heading', {level: 1, name: SETTINGS_TITLE})
  ).toBeVisible({timeout: 15_000})
}

const contactField = (page: Page) =>
  page.getByLabel('Adresse de contact', {exact: true})
const forageField = (page: Page) =>
  page.getByLabel(/Adresse du responsable forage/)

const saveSettings = async (page: Page) => {
  const actionRequest = page.waitForRequest(
    (request) =>
      request.method() === 'POST' && Boolean(request.headers()['next-action'])
  )
  await page.getByRole('button', {name: 'Enregistrer les réglages'}).click()
  return await actionRequest
}

/** La teinte posée par le serveur sur `<html>`, lue sur une page publique. */
const servedAccentHue = async (page: Page, base: string) => {
  await page.goto(`${base}${PUBLIC_PAGE}`, {waitUntil: 'load'})
  const style = (await page.locator('html').getAttribute('style')) ?? ''
  return style.match(/--accent-hue:\s*(\d+)/)?.[1]
}

test.describe.serial('s02 — paramètres de l’association', () => {
  /** Un vrai enregistrement de la présidente, rejoué par d'autres comptes. */
  let capturedAction: {
    nextAction: string
    contentType: string
    body: Buffer
  }

  test.afterAll(async () => {
    await restoreTenantASeed()
  })

  test('critère 6 — chaque tenant de test lit les valeurs de son jeu de paramètres', async ({
    browser,
  }) => {
    const pageA = await newSession(browser, TENANT_A, 'user-owner@gmail.com')
    await openSettingsPage(pageA, TENANT_A)
    await expect(contactField(pageA)).toHaveValue(SEED.a.contact)
    await pageA.close()

    const pageB = await newSession(browser, TENANT_B, 'user-admin@gmail.com')
    await openSettingsPage(pageB, TENANT_B)
    await expect(contactField(pageB)).toHaveValue(SEED.b.contact)
    await pageB.close()

    expect(await storedSettings('a')).toMatchObject({
      [CONTACT_KEY]: SEED.a.contact,
      [HUE_KEY]: SEED.a.hue,
    })
    expect(await storedSettings('b')).toEqual({[CONTACT_KEY]: SEED.b.contact})
  })

  test('critère 4 — le forage jamais renseigné se lit à l’adresse de contact', async ({
    browser,
  }) => {
    const page = await newSession(browser, TENANT_A, 'user-owner@gmail.com')
    await openSettingsPage(page, TENANT_A)

    await expect(forageField(page)).toHaveValue('')
    await expect(
      page.getByText(
        `Vide : les signalements de fuite partent vers ${SEED.a.contact}.`
      )
    ).toBeVisible()

    await page.close()
  })

  test('critère 3 — la présidente modifie les adresses et les relit, sans redéploiement', async ({
    browser,
  }) => {
    const page = await newSession(browser, TENANT_A, 'user-owner@gmail.com')
    await openSettingsPage(page, TENANT_A)

    // Premier enregistrement : son appel d'action sert au rejeu du critère 7.
    await contactField(page).fill(REPLAYED_CONTACT_A)
    const request = await saveSettings(page)
    await expect(page.getByText(SAVED)).toBeVisible({timeout: 15_000})
    capturedAction = {
      nextAction: request.headers()['next-action'],
      contentType: request.headers()['content-type'] ?? '',
      body: request.postDataBuffer() ?? Buffer.alloc(0),
    }
    expect(capturedAction.body.byteLength).toBeGreaterThan(0)

    await contactField(page).fill(NEW_CONTACT_A)
    await forageField(page).fill(NEW_FORAGE_A)
    await saveSettings(page)
    await expect(page.getByText(SAVED)).toBeVisible({timeout: 15_000})

    await openSettingsPage(page, TENANT_A)
    await expect(contactField(page)).toHaveValue(NEW_CONTACT_A)
    await expect(forageField(page)).toHaveValue(NEW_FORAGE_A)

    await page.close()
  })

  test('critère 2 — une adresse invalide est refusée avec un message explicite', async ({
    browser,
  }) => {
    const page = await newSession(browser, TENANT_A, 'user-owner@gmail.com')
    await openSettingsPage(page, TENANT_A)

    await forageField(page).fill('forage@techcorp')
    await page.getByRole('button', {name: 'Enregistrer les réglages'}).click()

    await expect(page.getByText(INVALID_EMAIL)).toBeVisible()
    // Le filtre écarte l'annonceur de route de Next, lui aussi en `alert`.
    await expect(
      page
        .getByRole('alert')
        .filter({hasText: "1 réglage n'a pas été enregistré"})
    ).toBeVisible()

    await openSettingsPage(page, TENANT_A)
    await expect(forageField(page)).toHaveValue(NEW_FORAGE_A)

    await page.close()
  })

  test('critère 5 — l’adresse de contact vidée est refusée, l’ancienne reste en vigueur', async ({
    browser,
  }) => {
    const page = await newSession(browser, TENANT_A, 'user-owner@gmail.com')
    await openSettingsPage(page, TENANT_A)

    await contactField(page).fill('')
    await page.getByRole('button', {name: 'Enregistrer les réglages'}).click()

    await expect(
      page.getByText(
        `L'adresse de contact est obligatoire : c'est vers elle que partent les messages quand aucune autre adresse n'est renseignée. L'adresse ${NEW_CONTACT_A} reste en vigueur.`
      )
    ).toBeVisible()

    await openSettingsPage(page, TENANT_A)
    await expect(contactField(page)).toHaveValue(NEW_CONTACT_A)
    expect((await storedSettings('a'))[CONTACT_KEY]).toBe(NEW_CONTACT_A)

    await page.close()
  })

  test('critère 4 — le forage vidé revient à l’adresse de contact', async ({
    browser,
  }) => {
    const page = await newSession(browser, TENANT_A, 'user-owner@gmail.com')
    await openSettingsPage(page, TENANT_A)

    await forageField(page).fill('')
    await saveSettings(page)
    await expect(page.getByText(SAVED)).toBeVisible({timeout: 15_000})

    await openSettingsPage(page, TENANT_A)
    await expect(forageField(page)).toHaveValue('')
    await expect(
      page.getByText(
        `Vide : les signalements de fuite partent vers ${NEW_CONTACT_A}.`
      )
    ).toBeVisible()
    expect(await storedSettings('a')).not.toHaveProperty(FORAGE_KEY)

    await page.close()
  })

  for (const email of ['user@gmail.com', 'admin@gmail.com']) {
    test(`critère 7 — ${email} voit l’écran de refus, et l’action serveur directe est refusée`, async ({
      browser,
    }) => {
      const page = await newSession(browser, TENANT_A, email)

      await page.goto(`${TENANT_A}${SETTINGS_PAGE}`, {waitUntil: 'load'})
      await expect(
        page.getByRole('heading', {level: 1, name: DENIED_TITLE})
      ).toBeVisible({timeout: 15_000})
      await expect(contactField(page)).toHaveCount(0)

      // Rejoue, sous cette session, l'enregistrement de REPLAYED_CONTACT_A par
      // la présidente : l'adresse en vigueur ne doit pas y revenir.
      expect(capturedAction?.nextAction).toBeTruthy()
      const replay = await page.request.post(`${TENANT_A}${SETTINGS_PAGE}`, {
        headers: {
          'next-action': capturedAction.nextAction,
          'content-type': capturedAction.contentType,
          accept: 'text/x-component',
          origin: TENANT_A,
        },
        data: capturedAction.body,
      })
      expect(replay.status()).toBeLessThan(500)
      expect((await storedSettings('a'))[CONTACT_KEY]).toBe(NEW_CONTACT_A)

      await page.close()
    })
  }

  test('critère 7 — le SuperAdmin accède aux réglages', async ({browser}) => {
    const page = await newSession(browser, TENANT_A, 'superadmin@gmail.com')

    await openSettingsPage(page, TENANT_A)
    await expect(contactField(page)).toHaveValue(NEW_CONTACT_A)

    await page.close()
  })

  test('critère 10 — une association sans teinte reçoit la teinte par défaut', async ({
    page,
  }) => {
    expect(await storedSettings('b')).not.toHaveProperty(HUE_KEY)
    expect(await servedAccentHue(page, TENANT_B)).toBe('195')
  })

  test('critère 8 — la teinte choisie dans « Identité » s’applique au site public', async ({
    browser,
  }) => {
    const page = await newSession(browser, TENANT_A, 'user-owner@gmail.com')
    await page.goto(`${TENANT_A}${IDENTITY_PAGE}`, {waitUntil: 'load'})
    await expect(
      page.getByRole('heading', {level: 1, name: IDENTITY_TITLE})
    ).toBeVisible({timeout: 15_000})

    // Six teintes, jamais de sélecteur libre.
    const hues = page.getByRole('radiogroup', {name: 'Teinte'})
    await expect(hues.getByRole('radio')).toHaveCount(6)
    await expect(page.locator('input[type="color"]')).toHaveCount(0)

    await hues.getByRole('radio', {name: /Tuile/}).click()
    await expect(
      page.getByText('Teinte Tuile sélectionnée, pas encore enregistrée.')
    ).toBeVisible()
    await page.getByRole('button', {name: 'Enregistrer la teinte'}).click()
    await expect(
      page.getByText(
        'Teinte Tuile enregistrée. Visible sur votre site et dans cet espace.'
      )
    ).toBeVisible({timeout: 15_000})

    expect(await servedAccentHue(page, TENANT_A)).toBe('40')

    await page.close()
  })

  test('critère 9 — deux domaines, deux teintes, et aucun paramètre de l’un lisible par l’autre', async ({
    page,
    request,
  }) => {
    expect(await servedAccentHue(page, TENANT_A)).toBe('40')
    expect(await servedAccentHue(page, TENANT_B)).toBe('195')

    // Le favicon par défaut de A est peint dans sa teinte.
    const faviconA = await request.get(`${TENANT_A}/api/identity/favicon`)
    if (faviconA.headers()['content-type'] === 'image/svg+xml') {
      expect(await faviconA.text()).toContain('oklch(0.55 0.1 40)')
    }

    await withAppRoleClient(async (client) => {
      const {a, b} = await tenantIds(client)

      // Hors scope, rien ne sort.
      const unscoped = await client.query(
        'select key from organization_setting'
      )
      expect(unscoped.rowCount).toBe(0)

      // Dans le scope de B, aucune ligne de A, même demandée par son id.
      const fromB = await inTenantScope(client, b, () =>
        client.query<{organization_id: string}>(
          `select organization_id from organization_setting where organization_id = $1`,
          [a]
        )
      )
      expect(fromB.rowCount).toBe(0)

      // Écrire pour A depuis le scope de B est refusé.
      await client.query('begin')
      await client.query(`select set_config('app.organization_id', $1, true)`, [
        b,
      ])
      await expect(
        client.query(
          `insert into organization_setting (organization_id, key, value)
           values ($1, 'contact.email', 'forge@example.test')`,
          [a]
        )
      ).rejects.toThrow(/row-level security/i)
      await client.query('rollback')
    })
  })

  test('critère 5 — le provisioning refuse une association sans adresse de contact', async ({
    browser,
  }) => {
    const page = await newSession(browser, TENANT_A, 'superadmin@gmail.com')
    await page.goto(`${TENANT_A}/fr/admin/organizations/new`, {
      waitUntil: 'load',
    })

    await page.getByLabel("Nom de l'association").fill('ASL Sans Contact')
    await page.getByLabel('Domaine').fill('asl-sans-contact.test')
    await page
      .getByLabel('Adresse email')
      .fill('presidence@asl-sans-contact.test')
    await page.getByRole('button', {name: "Provisionner l'association"}).click()

    await expect(
      page.getByText(
        "L'adresse de contact de l'association est obligatoire. Exemple : contact@domaine.fr"
      )
    ).toBeVisible()

    await withAppRoleClient(async (client) => {
      const created = await client.query(
        `select id from organization where slug = 'asl-sans-contact'`
      )
      expect(created.rowCount).toBe(0)
    })

    await page.close()
  })
})
