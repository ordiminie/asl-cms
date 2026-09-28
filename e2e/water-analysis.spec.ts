/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import path from 'node:path'

import {expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Analyses d'eau — s09, critères 1 à 5 (ADR 026).
 *
 * Ce que seuls un navigateur, deux domaines et la base prouvent : la
 * publication en une seule soumission avec deux fichiers, le téléchargement
 * anonyme du PDF, l'ordre par date, l'enveloppe de requête à 16 Mo, et
 * l'isolation RLS de `water_analysis`.
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

const BUREAU_ROUTE = '/fr/bureau/analyses-eau'
const PUBLIC_ROUTE = '/fr/analyses-eau'
const DENIED_TITLE = "Cette page est réservée au bureau de l'association"

/** Un PNG minimal valide : la validation juge la signature binaire. */
const PNG_FIXTURE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)
const pdfFixture = (label: string) =>
  Buffer.from(`%PDF-1.4\n% ${label}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`)

const MEGABYTE = 1024 * 1024

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

/**
 * Repart d'une liste vide pour les deux associations de test : l'ordre « en
 * tête » ne se prouve que sur une liste que la spec maîtrise. La CI n'en a
 * pas besoin — sa base est éphémère — mais une exécution locale répétée, si.
 */
const deleteAllWaterAnalyses = async () => {
  await withAppRoleClient(async (client) => {
    const ids = await tenantIds(client)
    await client.query('begin')
    await client.query(`select set_config('app.bypass_rls', 'on', true)`)
    await client.query(
      `delete from water_analysis where organization_id in ($1, $2)`,
      [ids.a, ids.b]
    )
    await client.query('commit')
  })
}

const countAnalysesOfTenantA = async (): Promise<number> =>
  withAppRoleClient(async (client) => {
    const ids = await tenantIds(client)
    const result = await inTenantScope(client, ids.a, () =>
      client.query<{total: string}>(
        `select count(*) as total from water_analysis`
      )
    )
    return Number(result.rows[0].total)
  })

/** Fichiers écrits sous la portée `water-analysis` de l'association A. */
const storedFilesOfTenantA = async (): Promise<number> => {
  const root = process.env.LOCAL_STORAGE_ROOT
  if (!root) return 0
  const organizationId = await withAppRoleClient(
    async (client) => (await tenantIds(client)).a
  )
  const directory = path.join(root, organizationId, 'water-analysis')
  if (!fs.existsSync(directory)) return 0
  return fs.readdirSync(directory, {recursive: true, withFileTypes: true})
    .length
}

/** Le jour calendaire de Paris, celui que le serveur applique. */
const parisToday = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

const shiftDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** `2026-09-02` -> `02/09/2026`, la forme saisie et affichée au bureau. */
const shortDate = (isoDate: string): string =>
  isoDate.split('-').reverse().join('/')

/** `2026-09-02` -> `2 septembre 2026`, la forme du site public. */
const longDate = (isoDate: string): string =>
  new Intl.DateTimeFormat('fr-FR', {dateStyle: 'long', timeZone: 'UTC'}).format(
    new Date(`${isoDate}T00:00:00Z`)
  )

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

type AnalysisInput = {
  date: string
  content?: string
  poster?: {name: string; mimeType: string; buffer: Buffer}
  report?: {name: string; mimeType: string; buffer: Buffer}
}

const openNewForm = async (page: Page) => {
  await page.goto(`${TENANT_A}${BUREAU_ROUTE}/nouvelle`, {waitUntil: 'load'})
  await expect(
    page.getByRole('heading', {level: 1, name: "Publier une analyse d'eau"})
  ).toBeVisible({timeout: 20_000})
}

/** Remplit les quatre champs, sans soumettre. */
const fillForm = async (page: Page, input: AnalysisInput) => {
  const date = page.getByLabel('Date du prélèvement', {exact: true})
  await date.fill(shortDate(input.date))
  await expect(date).toHaveValue(shortDate(input.date))

  await page.getByLabel('Affiche', {exact: true}).setInputFiles(
    input.poster ?? {
      name: 'affiche.png',
      mimeType: 'image/png',
      buffer: PNG_FIXTURE,
    }
  )
  if (input.content) {
    await page.getByLabel(/^Texte/).fill(input.content)
  }
  await page.getByLabel('Résultat complet (PDF)', {exact: true}).setInputFiles(
    input.report ?? {
      name: 'resultat.pdf',
      mimeType: 'application/pdf',
      buffer: pdfFixture(input.date),
    }
  )
}

/** Publie une analyse en une seule soumission et attend le retour à la liste. */
const publishAnalysis = async (page: Page, input: AnalysisInput) => {
  await openNewForm(page)
  await fillForm(page, input)
  await page.getByRole('button', {name: "Publier l'analyse"}).click()
  await page.waitForURL(/\/bureau\/analyses-eau\?statut=publiee/, {
    timeout: 60_000,
  })
  await expect(
    page.getByRole('status').filter({hasText: "L'analyse est publiée"})
  ).toBeVisible({timeout: 20_000})
}

const publicHeadings = async (page: Page): Promise<string[]> =>
  page.locator('main li h2, li h2').allInnerTexts()

test.describe.configure({mode: 'serial'})

test.beforeAll(async () => {
  await deleteAllWaterAnalyses()
})

test.afterAll(async () => {
  await deleteAllWaterAnalyses()
})

test.describe("Analyses d'eau — publication et site public", () => {
  test('la présidente publie en une seule soumission : l’analyse paraît en tête, et son PDF se télécharge sans session', async ({
    page,
    browser,
  }) => {
    const today = parisToday()
    const marker = `Eau conforme ${Date.now().toString(36)}`
    const report = pdfFixture(`rapport ${marker}`)

    await login(page, TENANT_A, OWNER_A)
    await publishAnalysis(page, {
      date: shiftDays(today, -40),
      content: 'Analyse plus ancienne.',
    })
    await publishAnalysis(page, {
      date: today,
      content: marker,
      report: {name: 'labo.pdf', mimeType: 'application/pdf', buffer: report},
    })

    // Critères 1 et 4 : en tête de la liste publique.
    const visitor = await browser.newContext()
    const visitorPage = await visitor.newPage()
    try {
      await visitorPage.goto(`${TENANT_A}${PUBLIC_ROUTE}`, {waitUntil: 'load'})
      const first = visitorPage.locator('li').first()
      await expect(first.getByRole('heading', {level: 2})).toHaveText(
        `Prélèvement du ${longDate(today)}`,
        {timeout: 20_000}
      )
      await expect(first.getByText(marker)).toBeVisible()
      await expect(
        first.getByRole('img', {
          name: `Affiche de l'analyse d'eau du ${longDate(today)}.`,
        })
      ).toBeVisible()

      // Critère 2 : le PDF se télécharge depuis un contexte sans session.
      const link = first.getByRole('link', {
        name: new RegExp(`Résultat complet du ${longDate(today)} \\(PDF`),
      })
      await expect(link).toHaveAttribute('download', `analyse-eau-${today}.pdf`)
      const href = await link.getAttribute('href')
      expect(href, 'le lien doit porter une adresse').toBeTruthy()
      const served = await visitorPage.request.get(
        new URL(href as string, TENANT_A).toString()
      )
      expect(served.status()).toBe(200)
      expect(served.headers()['content-type']).toContain('application/pdf')
      expect(
        Buffer.from(await served.body()).equals(report),
        'les octets servis sont ceux du PDF déposé'
      ).toBe(true)

      const download = visitorPage.waitForEvent('download')
      await link.click()
      expect((await download).suggestedFilename()).toBe(
        `analyse-eau-${today}.pdf`
      )
    } finally {
      await visitor.close()
    }
  })

  test('une analyse sans texte : ni bloc vide ni libellé orphelin, et l’ordre reste décroissant', async ({
    page,
    browser,
  }) => {
    const today = parisToday()
    const noText = shiftDays(today, -10)

    await login(page, TENANT_A, OWNER_A)
    await publishAnalysis(page, {date: noText})

    const visitor = await browser.newContext()
    const visitorPage = await visitor.newPage()
    try {
      await visitorPage.goto(`${TENANT_A}${PUBLIC_ROUTE}`, {waitUntil: 'load'})
      await expect(visitorPage.locator('li h2').first()).toBeVisible({
        timeout: 20_000,
      })

      // Critère 5 : par date décroissante, quelle que soit la date de saisie.
      expect(await publicHeadings(visitorPage)).toEqual([
        `Prélèvement du ${longDate(today)}`,
        `Prélèvement du ${longDate(noText)}`,
        `Prélèvement du ${longDate(shiftDays(today, -40))}`,
      ])

      // Critère 3 : la date, l'affiche, le lien — et rien d'autre.
      const item = visitorPage.locator('li').nth(1)
      await expect(
        item.locator('[data-slot="water-analysis-text"]')
      ).toHaveCount(0)
      await expect(item.getByRole('img')).toBeVisible()
      await expect(item.getByRole('link')).toHaveCount(1)
      await expect(item.locator('p')).toHaveCount(0)
      // Trois enfants seulement : le titre, l'affiche, le lien.
      await expect(item.locator(':scope > *')).toHaveCount(3)
    } finally {
      await visitor.close()
    }
  })

  test("une affiche de 4 Mo et un PDF de 8 Mo partent dans la même soumission : l'enveloppe à 16 Mo tient, proxy compris", async ({
    page,
    browser,
  }) => {
    const date = shiftDays(parisToday(), -3)
    const poster = Buffer.concat([PNG_FIXTURE, Buffer.alloc(4 * MEGABYTE)])
    const report = Buffer.concat([
      pdfFixture('lourd'),
      Buffer.alloc(8 * MEGABYTE),
    ])

    await login(page, TENANT_A, OWNER_A)
    await publishAnalysis(page, {
      date,
      poster: {
        name: 'grande-affiche.png',
        mimeType: 'image/png',
        buffer: poster,
      },
      report: {
        name: 'gros-rapport.pdf',
        mimeType: 'application/pdf',
        buffer: report,
      },
    })

    const visitor = await browser.newContext()
    const visitorPage = await visitor.newPage()
    try {
      await visitorPage.goto(`${TENANT_A}${PUBLIC_ROUTE}`, {waitUntil: 'load'})
      const item = visitorPage
        .locator('li')
        .filter({hasText: `Prélèvement du ${longDate(date)}`})
      await expect(item).toHaveCount(1, {timeout: 20_000})

      const href = await item.getByRole('link').getAttribute('href')
      const served = await visitorPage.request.get(
        new URL(href as string, TENANT_A).toString()
      )
      expect(served.status()).toBe(200)
      expect(
        Buffer.from(await served.body()).equals(report),
        'le PDF servi est complet : ni tronqué par le proxy, ni refusé'
      ).toBe(true)
    } finally {
      await visitor.close()
    }
  })
})

test.describe("Analyses d'eau — refus", () => {
  test('une date future est refusée avec son message écrit', async ({page}) => {
    await login(page, TENANT_A, OWNER_A)
    await openNewForm(page)
    await fillForm(page, {date: shiftDays(parisToday(), 2)})
    const before = await countAnalysesOfTenantA()

    await page.getByRole('button', {name: "Publier l'analyse"}).click()

    const message = 'La date du prélèvement ne peut pas être dans le futur.'
    await expect(
      page.getByRole('alert').filter({hasText: message})
    ).toBeVisible()
    await expect(page.getByText(message)).toHaveCount(2)
    await expect(page).toHaveURL(/\/nouvelle/)
    expect(await countAnalysesOfTenantA()).toBe(before)
  })

  test('un fichier au mauvais format est refusé par le serveur, sans rien écrire', async ({
    page,
  }) => {
    await login(page, TENANT_A, OWNER_A)
    await openNewForm(page)
    // Un « PNG » dont les octets n'en sont pas : le navigateur le laisse
    // partir, seule la signature binaire le trahit.
    await fillForm(page, {
      date: shiftDays(parisToday(), -5),
      poster: {
        name: 'faux.png',
        mimeType: 'image/png',
        buffer: Buffer.from('ceci n’est pas une image'),
      },
    })
    const rowsBefore = await countAnalysesOfTenantA()
    const filesBefore = await storedFilesOfTenantA()

    await page.getByRole('button', {name: "Publier l'analyse"}).click()

    await expect(
      page
        .getByRole('alert')
        .filter({hasText: "L'affiche doit être une image PNG, JPEG ou WebP."})
    ).toBeVisible({timeout: 30_000})
    expect(await countAnalysesOfTenantA()).toBe(rowsBefore)
    expect(
      await storedFilesOfTenantA(),
      "aucun fichier n'est écrit, pas même le PDF valide"
    ).toBe(filesBefore)
  })

  test("un membre simple n'atteint pas l'écran de gestion", async ({page}) => {
    await login(page, TENANT_A, MEMBER_A)

    await page.goto(`${TENANT_A}${BUREAU_ROUTE}`, {waitUntil: 'load'})
    await expect(page.getByText(DENIED_TITLE)).toBeVisible({timeout: 20_000})

    await page.goto(`${TENANT_A}${BUREAU_ROUTE}/nouvelle`, {waitUntil: 'load'})
    await expect(page.getByText(DENIED_TITLE)).toBeVisible({timeout: 20_000})
    await expect(
      page.getByRole('button', {name: "Publier l'analyse"})
    ).toBeHidden()
  })
})

test.describe("Analyses d'eau — correction et suppression", () => {
  test('la correction change la date et remplace le PDF ; la suppression retire l’analyse du site', async ({
    page,
    browser,
  }) => {
    const initial = shiftDays(parisToday(), -20)
    const corrected = shiftDays(parisToday(), -22)
    const replacement = pdfFixture('rapport corrigé')

    await login(page, TENANT_A, OWNER_A)
    await publishAnalysis(page, {date: initial})

    const row = page.getByRole('row').filter({hasText: shortDate(initial)})
    await row.getByRole('link', {name: /Modifier/}).click()
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: `Analyse du ${longDate(initial)}`,
      })
    ).toBeVisible({timeout: 20_000})
    await expect(page.getByRole('button', {name: /Retirer/})).toHaveCount(0)

    await page
      .getByLabel('Date du prélèvement', {exact: true})
      .fill(shortDate(corrected))
    await page
      .getByLabel('Résultat complet (PDF)', {exact: true})
      .setInputFiles({
        name: 'corrige.pdf',
        mimeType: 'application/pdf',
        buffer: replacement,
      })
    await page
      .getByRole('button', {name: 'Enregistrer les modifications'})
      .click()
    await page.waitForURL(/\/bureau\/analyses-eau\?statut=enregistree/, {
      timeout: 60_000,
    })

    const visitor = await browser.newContext()
    const visitorPage = await visitor.newPage()
    try {
      await visitorPage.goto(`${TENANT_A}${PUBLIC_ROUTE}`, {waitUntil: 'load'})
      const item = visitorPage
        .locator('li')
        .filter({hasText: `Prélèvement du ${longDate(corrected)}`})
      await expect(item).toHaveCount(1, {timeout: 20_000})
      await expect(
        visitorPage.getByText(`Prélèvement du ${longDate(initial)}`)
      ).toHaveCount(0)

      const href = await item.getByRole('link').getAttribute('href')
      const served = await visitorPage.request.get(
        new URL(href as string, TENANT_A).toString()
      )
      expect(Buffer.from(await served.body()).equals(replacement)).toBe(true)

      // Suppression : la ligne, ses deux fichiers, et l'analyse quitte le site.
      await page
        .getByRole('row')
        .filter({hasText: shortDate(corrected)})
        .getByRole('link', {name: /Modifier/})
        .click()
      await page.getByRole('button', {name: "Supprimer l'analyse"}).click()
      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toContainText(
        `Supprimer l'analyse du ${longDate(corrected)} ?`
      )
      await expect(dialog).toContainText('Cette action est définitive.')
      await dialog.getByRole('button', {name: "Supprimer l'analyse"}).click()
      await page.waitForURL(/\/bureau\/analyses-eau\?statut=supprimee/, {
        timeout: 30_000,
      })

      await visitorPage.goto(`${TENANT_A}${PUBLIC_ROUTE}`, {waitUntil: 'load'})
      await expect(visitorPage.locator('h1')).toBeVisible({timeout: 20_000})
      await expect(
        visitorPage.getByText(`Prélèvement du ${longDate(corrected)}`)
      ).toHaveCount(0)
      const gone = await visitorPage.request.get(
        new URL(href as string, TENANT_A).toString()
      )
      expect(gone.status(), 'le PDF supprimé ne se sert plus').toBe(404)
    } finally {
      await visitor.close()
    }
  })
})

test.describe("Analyses d'eau — isolation entre associations", () => {
  test("l'analyse d'une association est absente du site de l'autre", async ({
    page,
    browser,
  }) => {
    const date = shiftDays(parisToday(), -30)

    await login(page, TENANT_A, OWNER_A)
    await publishAnalysis(page, {date, content: 'Réservée au tenant A.'})

    const visitor = await browser.newContext()
    const visitorPage = await visitor.newPage()
    try {
      await visitorPage.goto(`${TENANT_A}${PUBLIC_ROUTE}`, {waitUntil: 'load'})
      await expect(
        visitorPage.getByText(`Prélèvement du ${longDate(date)}`)
      ).toBeVisible({timeout: 20_000})

      await visitorPage.goto(`${TENANT_B}${PUBLIC_ROUTE}`, {waitUntil: 'load'})
      await expect(visitorPage.locator('h1')).toHaveText("Analyses d'eau", {
        timeout: 20_000,
      })
      await expect(
        visitorPage.getByText(`Prélèvement du ${longDate(date)}`)
      ).toHaveCount(0)
      await expect(visitorPage.getByText('Réservée au tenant A.')).toHaveCount(
        0
      )
    } finally {
      await visitor.close()
    }
  })

  test("la RLS refuse de lire l'analyse d'une association depuis le scope de l'autre", async () => {
    await withAppRoleClient(async (client) => {
      const ids = await tenantIds(client)

      const inserted = await inTenantScope(client, ids.a, async () => {
        const result = await client.query<{id: string}>(
          `insert into water_analysis (organization_id, sampled_on, poster_key, report_key, report_bytes)
           values ($1, '2026-01-15', 'rls/poster.png', 'rls/report.pdf', 1) returning id`,
          [ids.a]
        )
        return result.rows[0].id
      })

      const fromOtherTenant = await inTenantScope(client, ids.b, () =>
        client.query(`select id from water_analysis where id = $1`, [inserted])
      )
      expect(
        fromOtherTenant.rowCount,
        'un oubli de scope ne fuite pas : il ne retourne rien'
      ).toBe(0)

      const withoutScope = await client.query(
        `select id from water_analysis where id = $1`,
        [inserted]
      )
      expect(withoutScope.rowCount).toBe(0)

      await expect(
        inTenantScope(client, ids.b, () =>
          client.query(
            `insert into water_analysis (organization_id, sampled_on, poster_key, report_key, report_bytes)
             values ($1, '2026-01-16', 'x.png', 'x.pdf', 1)`,
            [ids.a]
          )
        ),
        'une écriture hors de son tenant est refusée'
      ).rejects.toThrow()

      await inTenantScope(client, ids.a, () =>
        client.query(`delete from water_analysis where id = $1`, [inserted])
      )
    })
  })
})
