/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import path from 'node:path'

import {Browser, expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Courrier postal — s28, critères 1 à 6 et isolation entre associations
 * (ADR 065 à 067).
 *
 * Ce que seuls un navigateur, deux domaines et une vraie base prouvent : une
 * campagne « tous les membres » fige à sa création ses fiches sans adresse
 * email (`campaign_letter_profile`) ; la carte « Courrier postal » signale les
 * homonymes du seed (Yvette Garnier, deux fiches, même domicile) ; le PDF ne
 * se prépare pas sans choix ; il se télécharge, une page par lettre ; la page
 * de calage aussi ; email ∪ courrier = la cible, sans intersection ; la RLS
 * forcée isole la table, et la route d'une campagne d'une autre association
 * rend 404.
 *
 * `localhost` sert TechCorp Solutions, `127.0.0.1` Marketing Pro (seed). La
 * spec n'écrit qu'une campagne, effacée à la fin (ses fiches figées suivent en
 * cascade). Les décomptes attendus sont lus en base.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
/** TechCorp Solutions dans le seed. */
const TENANT_A = `http://localhost:${PORT}`
/** Marketing Pro dans le seed. */
const TENANT_B = `http://127.0.0.1:${PORT}`

const PASSWORD = 'Azerty123'
/** Présidente de TechCorp Solutions. */
const OWNER_A = 'user-owner@gmail.com'
/** Membre du bureau de Marketing Pro. */
const BOARD_B = 'user-admin@gmail.com'

const NEW_CAMPAIGN_ROUTE = '/bureau/campagnes/nouvelle'
const CAMPAIGN_ROUTE = (id: string) => `/bureau/campagnes/${id}`
const LETTERS_ROUTE = (id: string) => `/api/campaigns/${id}/courrier`
const CALIBRATION_ROUTE = '/api/campaigns/calage'

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
const MARKER = `s28-${RUN}`
const SUBJECT = `Travaux de voirie ${MARKER}`
/** Les homonymes du seed : deux fiches sans email, même nom, même domicile. */
const HOMONYM = 'Yvette Garnier'

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

const inTransaction = async <T>(
  client: Client,
  setting: [string, string],
  callback: () => Promise<T>
): Promise<T> => {
  await client.query('begin')
  try {
    await client.query(`select set_config($1, $2, true)`, setting)
    const result = await callback()
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  }
}

/** Sous le scope d'une association, comme le produit. */
const inTenantScope = <T>(
  organizationId: string,
  callback: (client: Client) => Promise<T>
) =>
  withAppRoleClient((client) =>
    inTransaction(client, ['app.organization_id', organizationId], () =>
      callback(client)
    )
  )

/** Nettoyage hors scope : le seul `bypass` de la spec. */
const asMaintenance = <T>(callback: (client: Client) => Promise<T>) =>
  withAppRoleClient((client) =>
    inTransaction(client, ['app.bypass_rls', 'on'], () => callback(client))
  )

const tenantIds = () =>
  withAppRoleClient(async (client) => {
    const result = await client.query<{slug: string; id: string}>(
      `select slug, id from organization where slug in ('techcorp-solutions', 'marketing-pro')`
    )
    const bySlug = new Map(result.rows.map((row) => [row.slug, row.id]))
    const a = bySlug.get('techcorp-solutions')
    const b = bySlug.get('marketing-pro')
    expect(a, 'le seed doit porter les deux associations').toBeTruthy()
    expect(b, 'le seed doit porter les deux associations').toBeTruthy()
    return {a: a as string, b: b as string}
  })

/** Les adresses destinataires de TechCorp : actives, jamais désinscrites. */
const recipientCountInDatabase = async (): Promise<number> => {
  const {a} = await tenantIds()
  return inTenantScope(a, async (client) => {
    const result = await client.query<{recipients: number}>(
      `select count(*)::int as recipients from (
         select lower(trim(e.email))
           from member_profile_email e
          where e.organization_id = $1 and e.status = 'active'
          group by lower(trim(e.email))
         having not bool_or(e.unsubscribed_at is not null)
       ) addresses`,
      [a]
    )
    return result.rows[0].recipients
  })
}

const cleanUpRun = () =>
  asMaintenance(async (client) => {
    await client.query(`delete from campaign where subject like $1`, [
      `%${MARKER}%`,
    ])
  })

const login = async (page: Page, base: string, email: string) => {
  await page.goto(`${base}/login/prestataire`)
  await expect(page.locator('form')).toBeVisible()
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.toString().includes('/login'), {
    timeout: 15_000,
  })
}

const newSession = async (browser: Browser, base: string, email: string) => {
  const context = await browser.newContext({
    locale: 'fr-FR',
    acceptDownloads: true,
  })
  await context.addCookies([{name: 'NEXT_LOCALE', value: 'fr', url: base}])
  const page = await context.newPage()
  await login(page, base, email)
  return page
}

/** Compose en mode libre, « tous les membres », envoie ; rend l'id. */
const composeAndSend = async (page: Page): Promise<string> => {
  const recipients = await recipientCountInDatabase()
  await page.goto(`${TENANT_A}${NEW_CAMPAIGN_ROUTE}`, {
    waitUntil: 'networkidle',
  })
  await page.getByRole('textbox', {name: /^Objet/}).fill(SUBJECT)
  await page
    .getByRole('textbox', {name: 'Message', exact: true})
    .fill('Bonjour {nom},\n\nLes travaux de la parcelle {parcelle} commencent.')
  await page.getByRole('button', {name: 'Voir l’aperçu'}).click()
  await expect(
    page.getByRole('heading', {level: 1, name: 'Aperçu avant l’envoi'})
  ).toBeVisible({timeout: 15_000})

  const sendLabel = new RegExp(`^Envoyer à ${recipients} membres?$`)
  await page.getByRole('button', {name: sendLabel}).click()
  const dialog = page.getByRole('alertdialog', {name: 'Envoyer la campagne ?'})
  await dialog.getByRole('button', {name: sendLabel}).click()

  await page.waitForURL(/\/bureau\/campagnes\/[0-9a-f-]{36}\?envoi=1$/, {
    timeout: 20_000,
  })
  return new URL(page.url()).pathname.split('/').pop() as string
}

/** Les pages d'un PDF : ses objets `/Type /Page` (pas `/Pages`). */
const pageCountOf = (pdf: Buffer): number =>
  pdf.toString('latin1').match(/\/Type\s*\/Page(?![a-z])/g)?.length ?? 0

const downloadedPdf = async (page: Page, trigger: () => Promise<void>) => {
  const [download] = await Promise.all([
    page.waitForEvent('download', {timeout: 30_000}),
    trigger(),
  ])
  const file = await download.path()
  return {name: download.suggestedFilename(), pdf: fs.readFileSync(file)}
}

/** Les fiches figées des deux canaux, et ce que la cible devait couvrir. */
const channelsInDatabase = async (campaignId: string) => {
  const {a} = await tenantIds()
  return inTenantScope(a, async (client) => {
    const ids = async (sql: string) =>
      new Set(
        (await client.query<{id: string}>(sql, [campaignId, a])).rows.map(
          (row) => row.id
        )
      )
    return {
      email: await ids(
        `select crp.member_profile_id as id
           from campaign_recipient_profile crp
           join campaign_recipient cr on cr.id = crp.campaign_recipient_id
          where cr.campaign_id = $1 and crp.organization_id = $2`
      ),
      letters: await ids(
        `select member_profile_id as id from campaign_letter_profile
          where campaign_id = $1 and organization_id = $2`
      ),
      // La cible « tous », moins les fiches dont chaque adresse active est
      // désinscrite (envoi facultatif) : leur refus porte sur l'envoi.
      targeted: await ids(
        `select p.id from member_profile p
          where p.organization_id = $2 and $1::uuid is not null
            and not (
              exists (select 1 from member_profile_email e
                       where e.member_profile_id = p.id and e.status = 'active')
              and not exists (
                select 1 from member_profile_email e
                 where e.member_profile_id = p.id and e.status = 'active'
                   and not exists (
                     select 1 from member_profile_email o
                      where o.organization_id = p.organization_id
                        and o.status = 'active'
                        and lower(trim(o.email)) = lower(trim(e.email))
                        and o.unsubscribed_at is not null)))`
      ),
      withoutEmail: await ids(
        `select p.id from member_profile p
          where p.organization_id = $2 and $1::uuid is not null
            and not exists (select 1 from member_profile_email e
                             where e.member_profile_id = p.id
                               and e.status = 'active')`
      ),
    }
  })
}

test.describe('Courrier postal — une lettre par fiche sans email', () => {
  let campaignId = ''

  test.beforeAll(async () => {
    await cleanUpRun()
  })

  test.afterAll(async () => {
    await cleanUpRun()
  })

  test('critères 1, 2, 4, 5 — carte, homonymes signalés, choix obligatoire, PDF et page de calage', async ({
    browser,
  }) => {
    test.setTimeout(180_000)
    const bureau = await newSession(browser, TENANT_A, OWNER_A)
    try {
      campaignId = await composeAndSend(bureau)
      await bureau.goto(`${TENANT_A}${CAMPAIGN_ROUTE(campaignId)}`, {
        waitUntil: 'networkidle',
      })

      const card = bureau
        .getByRole('heading', {level: 2, name: 'Courrier postal'})
        .locator('xpath=..')
      await expect(card).toBeVisible({timeout: 15_000})
      await expect(
        card.getByText('Une même personne semble posséder plusieurs terrains.')
      ).toBeVisible()
      await expect(card.getByText(HOMONYM, {exact: true})).toBeVisible()
      for (const radio of await card.getByRole('radio').all()) {
        await expect(radio).not.toBeChecked()
      }

      // Critère 2 : sans choix, rien n'est préparé.
      const download = card.getByRole('button', {
        name: 'Télécharger le PDF du courrier',
      })
      await download.click()
      const summary = card.getByRole('alert').filter({
        hasText: 'Le PDF n’a pas été préparé.',
      })
      await expect(summary).toBeVisible()
      await expect(summary).toBeFocused()
      const withoutChoice = await bureau.request.get(
        `${TENANT_A}${LETTERS_ROUTE(campaignId)}`
      )
      expect(withoutChoice.status()).toBe(409)

      const {letters} = await channelsInDatabase(campaignId)
      expect(letters.size).toBeGreaterThan(1)

      // Critères 1 et 4 : un seul PDF, une page par fiche figée.
      await card.getByLabel('Une lettre par terrain').check()
      const perLand = await downloadedPdf(bureau, () => download.click())
      expect(perLand.name).toMatch(/^courrier-\d{2}-\d{2}-\d{4}\.pdf$/)
      expect(perLand.name).not.toContain('Garnier')
      expect(perLand.pdf.subarray(0, 5).toString()).toBe('%PDF-')
      expect(pageCountOf(perLand.pdf)).toBe(letters.size)
      await expect(
        card.getByRole('status').filter({hasText: 'PDF prêt'})
      ).toBeVisible()

      // Une seule lettre par personne : les deux fiches Garnier n'en font qu'une.
      const perPerson = await bureau.request.get(
        `${TENANT_A}${LETTERS_ROUTE(campaignId)}?lettres=par-personne`
      )
      expect(perPerson.status()).toBe(200)
      expect(perPerson.headers()['content-type']).toBe('application/pdf')
      expect(perPerson.headers()['cache-control']).toContain('no-store')
      expect(pageCountOf(await perPerson.body())).toBe(letters.size - 1)

      // La page de calage, à part du lot (ADR 067 §4).
      const calibration = await downloadedPdf(bureau, () =>
        card.getByRole('link', {name: 'Télécharger la page de calage'}).click()
      )
      expect(calibration.pdf.subarray(0, 5).toString()).toBe('%PDF-')
      expect(pageCountOf(calibration.pdf)).toBe(1)
    } finally {
      await bureau.context().close()
    }
  })

  test('critère 6 — email ∪ courrier = toute la cible, sans intersection ni oubli', async () => {
    expect(campaignId, 'la campagne de l’essai précédent').toBeTruthy()
    const channels = await channelsInDatabase(campaignId)

    const union = new Set([...channels.email, ...channels.letters])
    const intersection = [...channels.email].filter((id) =>
      channels.letters.has(id)
    )
    expect(intersection).toEqual([])
    expect([...union].sort()).toEqual([...channels.targeted].sort())
    expect([...channels.letters].sort()).toEqual(
      [...channels.withoutEmail].sort()
    )
  })

  test('isolation — la RLS forcée cache les fiches figées, la route d’une autre association rend 404', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    expect(campaignId, 'la campagne de l’essai précédent').toBeTruthy()
    const ids = await tenantIds()

    const seenFromB = await inTenantScope(ids.b, (client) =>
      client.query(
        `select 1 from campaign_letter_profile where campaign_id = $1`,
        [campaignId]
      )
    )
    expect(seenFromB.rowCount).toBe(0)
    const withoutScope = await withAppRoleClient((client) =>
      client.query(
        `select 1 from campaign_letter_profile where campaign_id = $1`,
        [campaignId]
      )
    )
    expect(withoutScope.rowCount).toBe(0)
    const profileOfA = await inTenantScope(ids.a, async (client) => {
      const result = await client.query<{id: string}>(
        `select member_profile_id as id from campaign_letter_profile
          where campaign_id = $1 limit 1`,
        [campaignId]
      )
      return result.rows[0].id
    })
    await expect(
      inTenantScope(ids.b, (client) =>
        client.query(
          `insert into campaign_letter_profile
             (organization_id, campaign_id, member_profile_id)
           values ($1, $2, $3)`,
          [ids.a, campaignId, profileOfA]
        )
      )
    ).rejects.toThrow(/row-level security/)

    const boardB = await newSession(browser, TENANT_B, BOARD_B)
    try {
      for (const query of [
        '',
        '?lettres=par-terrain',
        '?lettres=par-personne',
      ]) {
        const response = await boardB.request.get(
          `${TENANT_B}${LETTERS_ROUTE(campaignId)}${query}`
        )
        expect(response.status(), query).toBe(404)
        expect(response.headers()['content-type'] ?? '').not.toContain(
          'application/pdf'
        )
        expect(await response.text()).not.toContain(HOMONYM)
      }
      const calibration = await boardB.request.get(
        `${TENANT_B}${CALIBRATION_ROUTE}`
      )
      expect(calibration.status()).toBe(200)
    } finally {
      await boardB.context().close()
    }
  })
})
