/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {Browser, expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Mise à jour annuelle des coordonnées — s56, critères 1 à 10 et isolation
 * entre associations (ADR 047, 048, 076, 077).
 *
 * Ce que seuls un navigateur, deux associations et une vraie base prouvent :
 * les fiches de départ sont posées par l'import initial du SuperAdmin
 * (`member-annual-import-annee-1.csv`, fictif), une valeur y est modifiée « sur
 * le site », puis la présidente de TechCorp dépose le fichier de l'année
 * (`member-annual-import-annee-2.csv`, fictif) depuis son back-office. Les
 * preuves SQL tournent sous `app.organization_id` (RLS forcée) ; la nouvelle
 * titulaire se connecte par un vrai lien, l'ancienne n'en reçoit aucun ;
 * relancer le fichier ne change rien ; une adresse désactivée qui revient est
 * réactivée. Le Bureau n'a ni le bouton ni l'écran ; le même fichier déposé
 * sur Marketing Pro ne touche aucune fiche de TechCorp.
 *
 * `localhost` sert TechCorp Solutions, `127.0.0.1` Marketing Pro (seed). Les
 * lignes portent le marqueur `s56-e2e`, nettoyé avant et après. Jamais lancée
 * en local : la suite e2e tourne en CI.
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
/** Présidente de Marketing Pro. */
const OWNER_B = 'admin-owner@gmail.com'
/** Membre du bureau de Marketing Pro, pas de la présidence. */
const BOARD_B = 'user-admin@gmail.com'

const YEAR_1 = path.resolve(
  process.cwd(),
  'e2e/fixtures/member-annual-import-annee-1.csv'
)
const YEAR_2 = path.resolve(
  process.cwd(),
  'e2e/fixtures/member-annual-import-annee-2.csv'
)
const CUSTOMER_ID_PREFIX = 's56-e2e-'
const PARCEL_PREFIX = 'S56E2E-'
const EMAIL_DOMAIN = '@s56-e2e.test'
const MARKER = 's56-e2e'
const ANNUAL_ROUTE = '/bureau/proprietaires/mise-a-jour'
const SENT_TITLE = 'Consultez votre boîte mail'

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

const inTransaction = <T>(
  setting: [string, string],
  callback: (client: Client) => Promise<T>
): Promise<T> =>
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

/** Sous la RLS du tenant : une requête, ses lignes. */
const inTenant = async <Row>(
  slug: string,
  sql: string,
  params: unknown[] = []
): Promise<Row[]> => {
  const organizationId = await tenantIdOf(slug)
  return inTransaction(
    ['app.organization_id', organizationId],
    async (client) => (await client.query(sql, params)).rows as Row[]
  )
}

type EmailRow = {
  customer: string
  email: string
  role: string
  status: string
  origin: string
  unsubscribed: boolean
}

/** Les adresses des fiches du fichier, telles que le tenant les voit. */
const emailsOf = (slug: string) =>
  inTenant<EmailRow>(
    slug,
    `select p.pennylane_customer_id as customer, e.email, e.role, e.status,
            e.origin, e.unsubscribed_at is not null as unsubscribed
       from member_profile_email e
       join member_profile p on p.id = e.member_profile_id
      where p.pennylane_customer_id like $1
      order by p.pennylane_customer_id, e.email`,
    [`${CUSTOMER_ID_PREFIX}%`]
  )

type ProfileRow = {
  customer: string
  home_address_line: string | null
  phone: string | null
  name: string
}

const profilesOf = (slug: string) =>
  inTenant<ProfileRow>(
    slug,
    `select pennylane_customer_id as customer, home_address_line, phone, name
       from member_profile
      where pennylane_customer_id like $1
      order by pennylane_customer_id`,
    [`${CUSTOMER_ID_PREFIX}%`]
  )

const ownershipsOf = (slug: string) =>
  inTenant<{number: string; customer: string; ends_on: string | null}>(
    slug,
    `select pa.number, p.pennylane_customer_id as customer,
            o.ends_on::text as ends_on
       from parcel_ownership o
       join parcel pa on pa.id = o.parcel_id
       join member_profile p on p.id = o.member_profile_id
      where pa.number like $1
      order by pa.number`,
    [`${PARCEL_PREFIX}%`]
  )

const emailOf = (rows: EmailRow[], email: string) =>
  rows.find((row) => row.email === email)

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

/** L'import initial (s13) par le SuperAdmin : les fiches de départ. */
const initialImport = async (browser: Browser, fixture: string) => {
  const organizationId = await tenantIdOf(TENANT_A_SLUG)
  const page = await newSession(browser, TENANT_A, SUPER_ADMIN)
  await page.goto(
    `${TENANT_A}/admin/membres-import?association=${organizationId}`,
    {waitUntil: 'networkidle'}
  )
  const submit = page.getByRole('button', {name: 'Importer les membres'})
  await expect(async () => {
    await page.setInputFiles('#member-import-file', fixture)
    await expect(submit).toBeEnabled({timeout: 2000})
  }).toPass({timeout: 30_000})
  await submit.click()
  await expect(
    page.getByRole('heading', {level: 1, name: 'Rapport d’import'})
  ).toBeVisible({timeout: 60_000})
  await page.context().close()
}

/** Depuis la liste des propriétaires : le bouton d'entrée, puis le dépôt. */
const openAnnualImport = async (page: Page, base: string) => {
  await page.goto(`${base}/bureau/proprietaires`, {waitUntil: 'networkidle'})
  await page.getByRole('link', {name: 'Mettre à jour les coordonnées'}).click()
  await page.waitForURL(`**${ANNUAL_ROUTE}`)
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Mettre à jour les coordonnées',
    })
  ).toBeVisible({timeout: 15_000})
}

/** Dépose le fichier, lance la mise à jour et attend le rapport. */
const annualImport = async (page: Page, fixture: string) => {
  const submit = page.getByRole('button', {name: 'Mettre à jour les fiches'})
  await expect(submit).toBeDisabled()
  await expect(async () => {
    await page.setInputFiles('#member-annual-import-file', fixture)
    await expect(submit).toBeEnabled({timeout: 2000})
  }).toPass({timeout: 30_000})
  await submit.click()
  await expect(
    page.getByRole('heading', {level: 1, name: 'Rapport de mise à jour'})
  ).toBeVisible({timeout: 60_000})
}

/** La valeur d'une paire du bilan, par son libellé. */
const figureOf = (page: Page, label: string) =>
  page
    .getByRole('region', {name: 'Bilan'})
    .getByText(label, {exact: true})
    .locator('xpath=..')
    .locator('dd')

const expectFigures = async (page: Page, figures: Record<string, string>) => {
  for (const [label, value] of Object.entries(figures)) {
    await expect(figureOf(page, label), label).toHaveText(value)
  }
}

type OutboxMessage = {to: string; text: string}

const outboxDir = () =>
  process.env.EMAIL_OUTBOX_DIR ?? path.join(os.tmpdir(), 'asl-cms-email-outbox')

const outboxFiles = (): Set<string> => {
  const dir = outboxDir()
  return new Set(
    fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((file) => file.endsWith('.json'))
      : []
  )
}

const newMessagesTo = (before: Set<string>, to: string): OutboxMessage[] =>
  [...outboxFiles()]
    .filter((file) => !before.has(file))
    .map(
      (file) =>
        JSON.parse(
          fs.readFileSync(path.join(outboxDir(), file), 'utf8')
        ) as OutboxMessage
    )
    .filter((message) => message.to.toLowerCase() === to.toLowerCase())

/**
 * Chaque contexte sort par une adresse IP à lui : Better Auth limite le débit
 * de `/magic-link/verify` par IP (voir `magic-link.spec.ts`).
 */
let nextClientIp = 100
const freshPage = async (browser: Browser) => {
  nextClientIp += 1
  const context = await browser.newContext({
    locale: 'fr-FR',
    extraHTTPHeaders: {
      'x-forwarded-for': `203.0.113.${(nextClientIp % 250) + 1}`,
    },
  })
  return context.newPage()
}

const requestLink = async (page: Page, origin: string, address: string) => {
  const before = outboxFiles()
  await page.goto(`${origin}/login`)
  await page.waitForLoadState('networkidle')
  const field = page.getByLabel('Adresse email')
  await field.fill(address)
  await expect(field).toHaveValue(address)
  await page
    .getByRole('button', {name: 'Recevoir mon lien de connexion'})
    .click()
  await expect(
    page.getByRole('heading', {level: 1, name: SENT_TITLE})
  ).toBeVisible({timeout: 15_000})
  return before
}

const linkOf = (message: OutboxMessage) => {
  const link = message.text.match(
    /https?:\/\/\S+\/magic-link\/verify\?\S+/
  )?.[0]
  expect(link, 'la version texte porte l’URL en clair').toBeTruthy()
  return link as string
}

test.beforeAll(cleanUp)
test.afterAll(cleanUp)

test.describe('s56 — mise à jour annuelle des coordonnées', () => {
  test('fiches de départ : import initial, puis une valeur et une adresse ajoutées sur le site', async ({
    browser,
  }) => {
    await initialImport(browser, YEAR_1)
    const organizationId = await tenantIdOf(TENANT_A_SLUG)
    await inTransaction(
      ['app.organization_id', organizationId],
      async (client) => {
        await client.query(
          `update member_profile
              set home_address_line = '2 bis rue du Test', updated_at = now()
            where pennylane_customer_id = $1`,
          [`${CUSTOMER_ID_PREFIX}002`]
        )
        await client.query(
          `insert into member_profile_email
             (organization_id, member_profile_id, email, role, status, origin)
           select organization_id, id, $2, 'additional', 'active', 'site'
             from member_profile where pennylane_customer_id = $1`,
          [`${CUSTOMER_ID_PREFIX}001`, `site${EMAIL_DOMAIN}`]
        )
      }
    )

    expect(
      (await profilesOf(TENANT_A_SLUG)).map((row) => row.customer)
    ).toEqual([
      `${CUSTOMER_ID_PREFIX}001`,
      `${CUSTOMER_ID_PREFIX}002`,
      `${CUSTOMER_ID_PREFIX}003`,
    ])
  })

  test('un membre du Bureau n’a ni le bouton ni l’écran (1f)', async ({
    browser,
  }) => {
    const page = await newSession(browser, TENANT_B, BOARD_B)
    await page.goto(`${TENANT_B}/bureau/proprietaires`, {
      waitUntil: 'networkidle',
    })
    await expect(
      page.getByRole('heading', {level: 1, name: 'Propriétaires'})
    ).toBeVisible({timeout: 15_000})
    await expect(
      page.getByRole('link', {name: 'Mettre à jour les coordonnées'})
    ).toHaveCount(0)

    await page.goto(`${TENANT_B}${ANNUAL_ROUTE}`, {waitUntil: 'networkidle'})
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Cette page ne vous est pas accessible',
      })
    ).toBeVisible({timeout: 15_000})
    await expect(
      page.getByRole('button', {name: 'Mettre à jour les fiches'})
    ).toHaveCount(0)
    await page.context().close()
  })

  test('la présidente met à jour depuis son back-office et lit le rapport (critères 1 à 10)', async ({
    browser,
  }) => {
    const ownershipsBefore = await ownershipsOf(TENANT_A_SLUG)
    const page = await newSession(browser, TENANT_A, OWNER_A)
    await openAnnualImport(page, TENANT_A)
    await annualImport(page, YEAR_2)

    await expect(
      page
        .getByRole('status')
        .filter({hasText: 'Mise à jour terminée : 3 fiches mises à jour.'})
    ).toBeVisible()
    await expectFigures(page, {
      'Lignes lues': '5',
      'Fiches inchangées': '0',
      'Membres à créer à la main': '1',
      'Lignes rejetées': '1',
      'Valeurs conservées': '1',
      'Titulaires remplacées': '1',
      'Titulaires désignées par le site': '1',
      'Adresses plus actives': '1',
    })
    await expect(
      page.getByRole('table', {name: 'Membres à créer à la main'})
    ).toContainText(`${CUSTOMER_ID_PREFIX}999`)
    await expect(
      page.getByRole('table', {name: 'Lignes rejetées'})
    ).toContainText('Le nom est manquant.')
    await expect(
      page.getByRole('table', {
        name: 'Valeurs conservées, modifiées sur le site',
      })
    ).toContainText('2 bis rue du Test')

    const emails = await emailsOf(TENANT_A_SLUG)
    // Critère 3 : la nouvelle titulaire remplace l'ancienne, désactivée.
    expect(emailOf(emails, `lucie${EMAIL_DOMAIN}`)).toMatchObject({
      role: 'additional',
      status: 'disabled_by_import',
    })
    expect(emailOf(emails, `nouvelle${EMAIL_DOMAIN}`)).toMatchObject({
      role: 'holder',
      status: 'active',
      origin: 'file',
    })
    // Critère 5 : la supplémentaire du fichier précédent n'est plus active.
    expect(emailOf(emails, `extra${EMAIL_DOMAIN}`)?.status).toBe(
      'disabled_by_import'
    )
    // Critère 9 : l'adresse ajoutée sur le site reste active.
    expect(emailOf(emails, `site${EMAIL_DOMAIN}`)).toMatchObject({
      status: 'active',
      origin: 'site',
    })
    // Critère 4 : la titulaire absente est désactivée, le site en désigne une.
    expect(emailOf(emails, `nora${EMAIL_DOMAIN}`)?.status).toBe(
      'disabled_by_import'
    )
    expect(emailOf(emails, `claire${EMAIL_DOMAIN}`)).toMatchObject({
      role: 'holder',
      status: 'active',
    })

    const profiles = await profilesOf(TENANT_A_SLUG)
    // Critère 2 : la valeur du site gardée, le téléphone du fichier écrit.
    expect(profiles[1]).toMatchObject({
      home_address_line: '2 bis rue du Test',
      phone: '06 00 00 00 22',
      name: 'Marc Inventé s56-e2e',
    })
    // Critère 7 : aucune fiche créée.
    expect(profiles.map((row) => row.customer)).not.toContain(
      `${CUSTOMER_ID_PREFIX}999`
    )
    // Critère 8 : la propriété des parcelles ne change pas.
    expect(await ownershipsOf(TENANT_A_SLUG)).toEqual(ownershipsBefore)
    await page.context().close()
  })

  test('la nouvelle titulaire se connecte, l’ancienne ne reçoit aucun lien (critère 3)', async ({
    browser,
  }) => {
    const page = await freshPage(browser)
    const before = await requestLink(page, TENANT_A, `nouvelle${EMAIL_DOMAIN}`)
    await expect
      .poll(() => newMessagesTo(before, `nouvelle${EMAIL_DOMAIN}`).length, {
        timeout: 10_000,
      })
      .toBe(1)
    await page.goto(linkOf(newMessagesTo(before, `nouvelle${EMAIL_DOMAIN}`)[0]))
    await expect(page).toHaveURL(`${TENANT_A}/dashboard`, {timeout: 15_000})
    await page.context().close()

    const old = await freshPage(browser)
    const oldBefore = await requestLink(old, TENANT_A, `lucie${EMAIL_DOMAIN}`)
    await old.waitForTimeout(3_000)
    expect(newMessagesTo(oldBefore, `lucie${EMAIL_DOMAIN}`)).toHaveLength(0)
    await old.context().close()
  })

  test('relancer le même fichier ne change rien (critère 10)', async ({
    browser,
  }) => {
    const emailsBefore = await emailsOf(TENANT_A_SLUG)
    const profilesBefore = await profilesOf(TENANT_A_SLUG)
    const page = await newSession(browser, TENANT_A, OWNER_A)
    await page.goto(`${TENANT_A}${ANNUAL_ROUTE}`, {waitUntil: 'networkidle'})
    await annualImport(page, YEAR_2)

    await expect(
      page.getByRole('status').filter({
        hasText:
          'Rien n’a changé : les fiches ont déjà les coordonnées de ce fichier.',
      })
    ).toBeVisible()
    await expectFigures(page, {
      'Fiches mises à jour': '0',
      'Fiches inchangées': '3',
      'Membres à créer à la main': '1',
    })
    expect(await emailsOf(TENANT_A_SLUG)).toEqual(emailsBefore)
    expect(await profilesOf(TENANT_A_SLUG)).toEqual(profilesBefore)
    await page.context().close()
  })

  test('l’année suivante, une adresse désactivée qui revient est réactivée, sa désinscription gardée (décision D)', async ({
    browser,
  }) => {
    const organizationId = await tenantIdOf(TENANT_A_SLUG)
    await inTransaction(['app.organization_id', organizationId], (client) =>
      client.query(
        `update member_profile_email set unsubscribed_at = now()
            where email = $1`,
        [`nora${EMAIL_DOMAIN}`]
      )
    )
    const page = await newSession(browser, TENANT_A, OWNER_A)
    await page.goto(`${TENANT_A}${ANNUAL_ROUTE}`, {waitUntil: 'networkidle'})
    await annualImport(page, YEAR_1)

    const emails = await emailsOf(TENANT_A_SLUG)
    expect(emailOf(emails, `nora${EMAIL_DOMAIN}`)).toMatchObject({
      role: 'additional',
      status: 'active',
      unsubscribed: true,
    })
    expect(emailOf(emails, `claire${EMAIL_DOMAIN}`)?.role).toBe('holder')
    await page.context().close()
  })

  test('accès croisé : déposé sur Marketing Pro, le fichier ne touche aucune fiche de TechCorp', async ({
    browser,
  }) => {
    const emailsBefore = await emailsOf(TENANT_A_SLUG)
    const profilesBefore = await profilesOf(TENANT_A_SLUG)
    expect(await profilesOf(TENANT_B_SLUG)).toEqual([])

    const page = await newSession(browser, TENANT_B, OWNER_B)
    await openAnnualImport(page, TENANT_B)
    await annualImport(page, YEAR_2)
    await expect(
      page
        .getByRole('alert')
        .filter({hasText: 'Aucune fiche n’a été mise à jour.'})
    ).toBeVisible()
    await expectFigures(page, {
      'Fiches mises à jour': '0',
      'Membres à créer à la main': '4',
      'Lignes rejetées': '1',
    })
    await page.context().close()

    expect(await profilesOf(TENANT_B_SLUG)).toEqual([])
    expect(await emailsOf(TENANT_A_SLUG)).toEqual(emailsBefore)
    expect(await profilesOf(TENANT_A_SLUG)).toEqual(profilesBefore)
  })

  test('la présidente de TechCorp n’a pas l’écran sur Marketing Pro', async ({
    browser,
  }) => {
    const page = await newSession(browser, TENANT_B, OWNER_A)
    await page.goto(`${TENANT_B}${ANNUAL_ROUTE}`, {waitUntil: 'networkidle'})
    await expect(page.getByRole('heading', {level: 1}).first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      page.getByRole('button', {name: 'Mettre à jour les fiches'})
    ).toHaveCount(0)
    await expect(page.getByText(MARKER)).toHaveCount(0)
    await page.context().close()
  })
})
