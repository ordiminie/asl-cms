/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import path from 'node:path'

import {Browser, expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Import initial des membres — s13, critères 1 à 7 et isolation entre
 * associations (ADR 046, ADR 047).
 *
 * Ce que seuls un navigateur, deux associations et une vraie base prouvent :
 * le SuperAdmin importe à l'écran, depuis la fiche de l'association, un
 * fichier **fictif** versionné (`e2e/fixtures/member-import-fictif.csv`) ;
 * fiches, comptes et parcelles sont écrits dans le tenant visé et lui seul
 * (RLS forcée) ; relancer le même fichier ne crée rien ; le bureau de l'autre
 * association ne voit rien, et le même fichier importé chez elle y crée ses
 * propres fiches.
 *
 * `localhost` sert TechCorp Solutions, `127.0.0.1` Marketing Pro (seed). Les
 * lignes du fichier portent le marqueur `s13-e2e`, nettoyé avant et après.
 * Jamais lancée en local : la suite e2e tourne en CI.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
/** TechCorp Solutions dans le seed. */
const TENANT_A = `http://localhost:${PORT}`
/** Marketing Pro dans le seed. */
const TENANT_B = `http://127.0.0.1:${PORT}`
const TENANT_A_SLUG = 'techcorp-solutions'
const TENANT_B_SLUG = 'marketing-pro'

const PASSWORD = 'Azerty123'
const SUPER_ADMIN = 'superadmin@gmail.com'
/** Présidente de TechCorp Solutions. */
const OWNER_A = 'user-owner@gmail.com'
/** Membre du bureau de Marketing Pro. */
const BOARD_B = 'user-admin@gmail.com'

const FIXTURE = path.resolve(
  process.cwd(),
  'e2e/fixtures/member-import-fictif.csv'
)
const CUSTOMER_ID_PREFIX = 's13-e2e-'
const PARCEL_PREFIX = 'S13E2E-'
const EMAIL_DOMAIN = '@s13-e2e.test'
const MARKER = 's13-e2e'
const OWNERSHIP_BEFORE_IMPORT_DATE = '1900-01-01'

test.use({locale: 'fr-FR'})
test.describe.configure({mode: 'serial'})

const databaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const testEnvPath = path.resolve(process.cwd(), '.env.test')
  const parsed = fs.existsSync(testEnvPath)
    ? dotenv.parse(fs.readFileSync(testEnvPath))
    : {}
  if (!parsed.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL introuvable : les preuves SQL attaquent la base en direct.'
    )
  }
  return parsed.DATABASE_URL
}

/** Une connexion sous le rôle applicatif, soumis à la RLS forcée. */
const withClient = async <T>(
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

const inTransaction = (
  setting: [string, string],
  callback: (client: Client) => Promise<unknown>
) =>
  withClient(async (client) => {
    await client.query('begin')
    try {
      await client.query(`select set_config($1, $2, true)`, setting)
      const result = await callback(client)
      await client.query('commit')
      return result
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  })

const tenantIdOf = (slug: string) =>
  withClient(async (client) => {
    const result = await client.query<{id: string}>(
      `select id from organization where slug = $1`,
      [slug]
    )
    expect(result.rows[0], `le seed doit porter ${slug}`).toBeTruthy()
    return result.rows[0].id
  })

type ImportedRows = {
  profiles: {id: string; pennylane_customer_id: string; mail_only: boolean}[]
  ownerships: {number: string; meter_number: string | null; starts_on: string}[]
}

/** Ce que voit le tenant : fiches et parcelles du fichier, sous sa RLS. */
const importedRowsOf = async (slug: string): Promise<ImportedRows> => {
  const organizationId = await tenantIdOf(slug)
  return (await inTransaction(
    ['app.organization_id', organizationId],
    async (client) => {
      const profiles = await client.query(
        `select id, pennylane_customer_id, mail_only from member_profile
          where pennylane_customer_id like $1
          order by pennylane_customer_id`,
        [`${CUSTOMER_ID_PREFIX}%`]
      )
      const ownerships = await client.query(
        `select p.number, p.meter_number, o.starts_on::text as starts_on
           from parcel_ownership o join parcel p on p.id = o.parcel_id
          where p.number like $1
          order by p.number`,
        [`${PARCEL_PREFIX}%`]
      )
      return {profiles: profiles.rows, ownerships: ownerships.rows}
    }
  )) as ImportedRows
}

/** Remise en état hors scope : le seul `bypass` de la spec. */
const cleanUp = () =>
  inTransaction(['app.bypass_rls', 'on'], async (client) => {
    await client.query(
      `delete from parcel_ownership
        where parcel_id in (select id from parcel where number like $1)
           or member_profile_id in (
             select id from member_profile where pennylane_customer_id like $2)`,
      [`${PARCEL_PREFIX}%`, `${CUSTOMER_ID_PREFIX}%`]
    )
    await client.query(`delete from parcel where number like $1`, [
      `${PARCEL_PREFIX}%`,
    ])
    await client.query(
      `delete from member_profile where pennylane_customer_id like $1`,
      [`${CUSTOMER_ID_PREFIX}%`]
    )
    await client.query(`delete from "user" where email like $1`, [
      `%${EMAIL_DOMAIN}`,
    ])
  })

/** Connexion par `/login/prestataire` (mot de passe). */
const newSession = async (browser: Browser, base: string, email: string) => {
  const context = await browser.newContext({locale: 'fr-FR'})
  await context.addCookies([{name: 'NEXT_LOCALE', value: 'fr', url: base}])
  const page = await context.newPage()
  await page.goto(`${base}/login/prestataire`)
  await expect(page.locator('form')).toBeVisible()
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.toString().includes('/login'), {
    timeout: 15_000,
  })
  return page
}

/** Depuis la fiche de l'association : l'écran 1, association déjà choisie. */
const openImportFromOrganization = async (page: Page, slug: string) => {
  const organizationId = await tenantIdOf(slug)
  await page.goto(`${TENANT_A}/admin/organizations/${organizationId}/edit`)
  await page.getByRole('link', {name: 'Importer des membres'}).click()
  await page.waitForURL(`**/admin/membres-import?association=${organizationId}`)
  await expect(
    page.getByRole('heading', {level: 1, name: 'Importer des membres'})
  ).toBeVisible({timeout: 15_000})
}

/** Dépose le fichier fictif, lance l'import et attend le rapport. */
const importFixture = async (page: Page) => {
  const submit = page.getByRole('button', {name: 'Importer les membres'})
  await expect(submit).toBeDisabled()
  await page.setInputFiles('#member-import-file', FIXTURE)
  await expect(submit).toBeEnabled()
  await submit.click()
  await expect(
    page.getByRole('heading', {level: 1, name: 'Rapport d’import'})
  ).toBeVisible({timeout: 60_000})
}

/** La valeur d'une carte du bilan, par son libellé. */
const figureOf = (page: Page, label: string) =>
  page
    .locator('dl')
    .getByText(label, {exact: true})
    .locator('xpath=..')
    .locator('dd')

const expectFigures = async (page: Page, figures: Record<string, string>) => {
  for (const [label, value] of Object.entries(figures)) {
    await expect(figureOf(page, label), label).toHaveText(value)
  }
}

test.beforeAll(cleanUp)
test.afterAll(cleanUp)

test.describe('s13 — import initial des membres', () => {
  test('le SuperAdmin importe depuis la fiche et lit le rapport (critères 1 à 6)', async ({
    browser,
  }) => {
    const page = await newSession(browser, TENANT_A, SUPER_ADMIN)
    await openImportFromOrganization(page, TENANT_A_SLUG)
    await importFixture(page)

    await expect(page.getByRole('status')).toContainText(
      'Import terminé. 3 membres créés, 2 lignes à relire.'
    )
    await expectFigures(page, {
      'Lignes lues': '6',
      'Membres créés': '3',
      'Comptes de connexion ouverts': '2',
      'Membres « courrier uniquement »': '1',
      'Parcelles rattachées': '4',
      'Lignes rejetées': '2',
    })

    const rejections = page.getByRole('table', {name: 'Lignes rejetées'})
    await expect(rejections.getByRole('row')).toHaveCount(3)
    await expect(rejections).toContainText('Sans Contact s13-e2e')
    await expect(rejections).toContainText(
      'Ni adresse postale ni email : personne ne pourrait la joindre.'
    )
    await expect(rejections).toContainText('Le nom est manquant.')

    const rows = await importedRowsOf(TENANT_A_SLUG)
    expect(rows.profiles.map((row) => row.pennylane_customer_id)).toEqual([
      's13-e2e-001',
      's13-e2e-002',
      's13-e2e-005',
    ])
    expect(rows.profiles.map((row) => row.mail_only)).toEqual([
      false,
      true,
      false,
    ])
    expect(rows.ownerships).toEqual([
      {
        number: 'S13E2E-101',
        meter_number: '00XX000001',
        starts_on: OWNERSHIP_BEFORE_IMPORT_DATE,
      },
      {
        number: 'S13E2E-102',
        meter_number: '00XX000002',
        starts_on: OWNERSHIP_BEFORE_IMPORT_DATE,
      },
      {
        number: 'S13E2E-103',
        meter_number: '00XX000003',
        starts_on: OWNERSHIP_BEFORE_IMPORT_DATE,
      },
      {
        number: 'S13E2E-106',
        meter_number: '00XX000006',
        starts_on: OWNERSHIP_BEFORE_IMPORT_DATE,
      },
    ])

    const accounts = await withClient((client) =>
      client.query(
        `select email from "user" where email like $1 order by email`,
        [`%${EMAIL_DOMAIN}`]
      )
    )
    expect(accounts.rows.map((row) => row.email)).toEqual([
      'lucie@s13-e2e.test',
      'paul@s13-e2e.test',
    ])
    await page.context().close()
  })

  test('le bureau de l’association voit les membres importés, la parcelle « avant l’import »', async ({
    browser,
  }) => {
    const [lucie] = (await importedRowsOf(TENANT_A_SLUG)).profiles
    const page = await newSession(browser, TENANT_A, OWNER_A)
    await page.goto(
      `${TENANT_A}/bureau/proprietaires?q=${encodeURIComponent(MARKER)}`,
      {waitUntil: 'networkidle'}
    )
    await expect(page.getByText('Lucie Fictive s13-e2e').first()).toBeVisible({
      timeout: 15_000,
    })
    await page.goto(`${TENANT_A}/bureau/proprietaires/${lucie.id}`, {
      waitUntil: 'networkidle',
    })
    const current = page.getByRole('table', {name: 'Parcelles actuelles'})
    await expect(current).toContainText('S13E2E-101')
    await expect(current).toContainText('avant l’import')
    await expect(current).not.toContainText('1900')
    await page.context().close()
  })

  test('relancer le même fichier ne crée rien (critère 7)', async ({
    browser,
  }) => {
    const before = await importedRowsOf(TENANT_A_SLUG)
    const page = await newSession(browser, TENANT_A, SUPER_ADMIN)
    await openImportFromOrganization(page, TENANT_A_SLUG)
    await importFixture(page)

    await expect(page.getByRole('status')).toContainText(
      'Rien de nouveau : ce fichier avait déjà été importé.'
    )
    await expectFigures(page, {
      'Membres créés': '0',
      'Comptes de connexion ouverts': '0',
      'Parcelles rattachées': '0',
      'Lignes rejetées': '2',
    })
    await expect(
      page.getByText('Déjà présents : 3 membres, inchangés.')
    ).toBeVisible()
    expect(await importedRowsOf(TENANT_A_SLUG)).toEqual(before)
    await page.context().close()
  })

  test('accès croisé : l’autre association ne voit rien, puis importe ses propres fiches', async ({
    browser,
  }) => {
    expect((await importedRowsOf(TENANT_B_SLUG)).profiles).toEqual([])

    const board = await newSession(browser, TENANT_B, BOARD_B)
    await board.goto(
      `${TENANT_B}/bureau/proprietaires?q=${encodeURIComponent(MARKER)}`,
      {waitUntil: 'networkidle'}
    )
    await expect(
      board.getByText(`Aucun propriétaire ne correspond à « ${MARKER} »`, {
        exact: false,
      })
    ).toBeVisible({timeout: 15_000})
    await board.context().close()

    const page = await newSession(browser, TENANT_A, SUPER_ADMIN)
    await openImportFromOrganization(page, TENANT_B_SLUG)
    await importFixture(page)
    await expectFigures(page, {
      'Membres créés': '3',
      'Parcelles rattachées': '4',
      'Lignes rejetées': '2',
    })
    await page.context().close()

    const inA = await importedRowsOf(TENANT_A_SLUG)
    const inB = await importedRowsOf(TENANT_B_SLUG)
    expect(inB.profiles).toHaveLength(3)
    expect(inB.ownerships).toHaveLength(4)
    const idsOfA = new Set(inA.profiles.map((row) => row.id))
    expect(inB.profiles.some((row) => idsOfA.has(row.id))).toBe(false)
  })
})
