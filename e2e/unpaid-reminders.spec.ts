/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import {Browser, expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Relances des impayés — s29, critères 1, 3, 4, 7, 9 et 10 (ADR 070).
 *
 * Ce que seuls un navigateur, le vrai planificateur et une vraie base
 * prouvent : le bureau active la relance (refusée sans texte), un passage du
 * script `run-scheduled-jobs` crée la relance 1 d'une échéance passée sous
 * forme de campagne, ses destinataires ne sont que les impayés, la fiche sans
 * email est au courrier ; un passage rejoué ne crée rien de plus ; la page de
 * suivi liste nom, parcelle, date et relances ; un membre réglé en sort ; un
 * membre simple n'y entre pas.
 *
 * L'essai est isolé du seed : le temps de la spec, la liste « impayé » de
 * TechCorp ne contient qu'un statut propre à l'essai, que seules ses factures
 * portent. Les réglages d'origine sont rétablis à la fin, et les campagnes,
 * tâches, fiches et parcelles de l'essai effacées.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
/** TechCorp Solutions dans le seed. */
const TENANT_A = `http://localhost:${PORT}`

const PASSWORD = 'Azerty123'
/** Présidente de TechCorp Solutions. */
const OWNER_A = 'user-owner@gmail.com'
/** Compte `member` de TechCorp (seed), sans droit sur les campagnes. */
const MEMBER_A = 'moderator-member@gmail.com'

const SETTINGS_ROUTE = '/bureau/reglages'
const REMINDERS_ROUTE = '/bureau/relances'
const DENIED_TITLE = 'Cette page ne vous est pas accessible'
const SCHEDULER_SCRIPT = 'src/db/scripts/run-scheduled-jobs.ts'
const JOB_KIND = 'billing.unpaid_reminders'

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
const MARKER = `s29-${RUN}`
const UNPAID_STATUS = `Impayé ${MARKER}`
const SETTLED_STATUS = `Réglé ${MARKER}`

const DAY_MS = 24 * 60 * 60 * 1000
const isoDayOf = (time: number) => new Date(time).toISOString().slice(0, 10)
const frenchDayOf = (iso: string) => iso.split('-').reverse().join('/')
/** Une échéance passée : la relance 1 (échéance + 3 semaines) est due. */
const DUE_ON = isoDayOf(Date.now() - 30 * DAY_MS)
const ISSUED_ON = isoDayOf(Date.now() - 60 * DAY_MS)

const FICHES = {
  unpaid: {
    name: `Aubert ${MARKER}`,
    email: `aubert-${RUN}@example.test`,
    parcel: `R29-${RUN}-1`,
    status: UNPAID_STATUS,
  },
  settled: {
    name: `Renaud ${MARKER}`,
    email: `renaud-${RUN}@example.test`,
    parcel: `R29-${RUN}-2`,
    status: SETTLED_STATUS,
  },
  withoutEmail: {
    name: `Courrier ${MARKER}`,
    email: null,
    parcel: `R29-${RUN}-3`,
    status: UNPAID_STATUS,
  },
} as const
type FicheKey = keyof typeof FICHES

/** Les réglages que la spec touche, rétablis à la fin. */
const TOUCHED_KEYS = [
  'billing.unpaid_statuses',
  'billing.settled_statuses',
  'billing.reminder.enabled',
  'billing.reminder.body',
] as const

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

/** Sous le scope de TechCorp, comme le produit. */
const inTenantScope = async <T>(callback: (client: Client) => Promise<T>) => {
  const organizationId = await techCorpId()
  return withAppRoleClient((client) =>
    inTransaction(client, ['app.organization_id', organizationId], () =>
      callback(client)
    )
  )
}

let techCorp = ''
const techCorpId = async (): Promise<string> => {
  if (techCorp) return techCorp
  techCorp = await withAppRoleClient(async (client) => {
    const result = await client.query<{id: string}>(
      `select id from organization where slug = 'techcorp-solutions'`
    )
    expect(result.rows[0]?.id, 'le seed doit porter TechCorp').toBeTruthy()
    return result.rows[0].id
  })
  return techCorp
}

const runScheduler = (): string =>
  execFileSync('pnpm', ['tsx', SCHEDULER_SCRIPT], {
    env: {...process.env, DATABASE_URL: databaseUrl()},
    encoding: 'utf8',
    timeout: 90_000,
  })

const login = async (page: Page, email: string) => {
  await page.goto(`${TENANT_A}/login/prestataire`)
  await expect(page.locator('form')).toBeVisible()
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.toString().includes('/login'), {
    timeout: 15_000,
  })
}

const newSession = async (browser: Browser, email: string) => {
  const context = await browser.newContext({locale: 'fr-FR'})
  await context.addCookies([{name: 'NEXT_LOCALE', value: 'fr', url: TENANT_A}])
  const page = await context.newPage()
  await login(page, email)
  return page
}

const ficheIds: Record<FicheKey, string> = {
  unpaid: '',
  settled: '',
  withoutEmail: '',
}
let originalSettings: {key: string; value: string}[] = []

/** Les rangs de l'échéance de l'essai, et leur campagne. */
const remindersOfRun = () =>
  inTenantScope(async (client) => {
    const result = await client.query<{rank: number; campaign_id: string}>(
      `select rank, campaign_id from unpaid_reminder
        where due_on = $1 order by rank`,
      [DUE_ON]
    )
    return result.rows
  })

const saveSettings = async (page: Page) => {
  await page.getByRole('button', {name: 'Enregistrer les réglages'}).click()
}

test.describe('Relances des impayés — activation, passage, suivi (s29)', () => {
  test.beforeAll(async () => {
    // Tout enregistrement des réglages de TechCorp, relance activée par le
    // seed, garantit la tâche du jour : une tâche laissée par un autre spec,
    // déjà close par un passage, rendrait sans effet l'activation de l'essai.
    const tenant = await techCorpId()
    await withAppRoleClient((client) =>
      inTransaction(client, ['app.bypass_rls', 'on'], () =>
        client.query(
          `delete from scheduled_job where organization_id = $1 and kind = $2`,
          [tenant, JOB_KIND]
        )
      )
    )
    await inTenantScope(async (client) => {
      const a = await techCorpId()
      const stored = await client.query<{key: string; value: string}>(
        `select key, value from organization_setting
          where organization_id = $1 and key = any($2::text[])`,
        [a, [...TOUCHED_KEYS]]
      )
      originalSettings = stored.rows
      for (const [key, value] of [
        ['billing.unpaid_statuses', UNPAID_STATUS],
        ['billing.settled_statuses', SETTLED_STATUS],
      ]) {
        await client.query(
          `insert into organization_setting (organization_id, key, value)
           values ($1, $2, $3)
           on conflict (organization_id, key) do update set value = $3`,
          [a, key, value]
        )
      }
      for (const key of Object.keys(FICHES) as FicheKey[]) {
        const fiche = FICHES[key]
        const profile = await client.query<{id: string}>(
          `insert into member_profile (organization_id, name)
           values ($1, $2) returning id`,
          [a, fiche.name]
        )
        ficheIds[key] = profile.rows[0].id
        if (fiche.email) {
          await client.query(
            `insert into member_profile_email
               (organization_id, member_profile_id, email, role, status, origin)
             values ($1, $2, $3, 'holder', 'active', 'site')`,
            [a, ficheIds[key], fiche.email]
          )
        }
        const parcel = await client.query<{id: string}>(
          `insert into parcel (organization_id, number) values ($1, $2) returning id`,
          [a, fiche.parcel]
        )
        await client.query(
          `insert into parcel_ownership (organization_id, parcel_id, member_profile_id, starts_on)
           values ($1, $2, $3, '2020-01-01')`,
          [a, parcel.rows[0].id, ficheIds[key]]
        )
        await client.query(
          `insert into member_invoice
             (organization_id, member_profile_id, parcel_id, source, year, issued_on, due_on, amount_cents, status)
           values ($1, $2, $3, 'site', $4, $5, $6, 32000, $7)`,
          [
            a,
            ficheIds[key],
            parcel.rows[0].id,
            Number(DUE_ON.slice(0, 4)),
            ISSUED_ON,
            DUE_ON,
            fiche.status,
          ]
        )
      }
    })
  })

  test.afterAll(async () => {
    const a = await techCorpId()
    const reminders = await remindersOfRun()
    await withAppRoleClient((client) =>
      inTransaction(client, ['app.bypass_rls', 'on'], async () => {
        await client.query(`delete from campaign where id = any($1::uuid[])`, [
          reminders.map((reminder) => reminder.campaign_id),
        ])
        await client.query(
          `delete from scheduled_job where organization_id = $1 and kind = $2`,
          [a, JOB_KIND]
        )
        await client.query(`delete from member_profile where name like $1`, [
          `%${MARKER}%`,
        ])
        await client.query(`delete from parcel where number like $1`, [
          `R29-${RUN}-%`,
        ])
        await client.query(
          `delete from organization_setting
            where organization_id = $1 and key = any($2::text[])`,
          [a, [...TOUCHED_KEYS]]
        )
        for (const {key, value} of originalSettings) {
          await client.query(
            `insert into organization_setting (organization_id, key, value)
             values ($1, $2, $3)`,
            [a, key, value]
          )
        }
      })
    )
  })

  test('critère 1 — le bureau active la relance : refusée sans texte, puis enregistrée', async ({
    browser,
  }) => {
    const page = await newSession(browser, OWNER_A)
    try {
      await page.goto(`${TENANT_A}${SETTINGS_ROUTE}`)
      const enabled = page.getByRole('checkbox', {
        name: /Relancer automatiquement les impayés/,
      })
      const body = page.getByLabel(/Texte de la relance/)

      if (await enabled.isChecked()) {
        await enabled.uncheck()
        await saveSettings(page)
        await expect(page.getByText(/Réglages enregistrés/)).toBeVisible()
        await page.reload()
      }

      await body.fill('')
      await enabled.check()
      await saveSettings(page)
      await expect(
        page.getByText('Écrivez le texte de la relance avant de l’activer.')
      ).toBeVisible()

      await body.fill(`Bonjour {nom},\n\n{factures}\n\n${MARKER}`)
      await saveSettings(page)
      await expect(page.getByText(/Réglages enregistrés/)).toBeVisible()

      const jobs = await inTenantScope((client) =>
        client.query(
          `select id from scheduled_job where kind = $1 and completed_at is null`,
          [JOB_KIND]
        )
      )
      expect(jobs.rowCount).toBeGreaterThan(0)
    } finally {
      await page.context().close()
    }
  })

  test('critères 7 et 10 — un passage crée R1 : les seuls impayés, la fiche sans email au courrier', async ({
    browser,
  }) => {
    runScheduler()

    const reminders = await remindersOfRun()
    expect(reminders.map((reminder) => reminder.rank)).toEqual([1])
    const campaignId = reminders[0].campaign_id

    const {recipients, letters, campaign} = await inTenantScope(
      async (client) => ({
        recipients: (
          await client.query<{email: string}>(
            `select email from campaign_recipient where campaign_id = $1`,
            [campaignId]
          )
        ).rows.map((row) => row.email),
        letters: (
          await client.query<{member_profile_id: string}>(
            `select member_profile_id from campaign_letter_profile where campaign_id = $1`,
            [campaignId]
          )
        ).rows.map((row) => row.member_profile_id),
        campaign: (
          await client.query<{template_id: string; nature: string}>(
            `select template_id, nature from campaign where id = $1`,
            [campaignId]
          )
        ).rows[0],
      })
    )
    expect(recipients).toEqual([FICHES.unpaid.email])
    expect(letters).toEqual([ficheIds.withoutEmail])
    expect(campaign.template_id).toBe('unpaid_reminder')

    const page = await newSession(browser, OWNER_A)
    try {
      const response = await page.goto(
        `${TENANT_A}/bureau/campagnes/${campaignId}`
      )
      expect(response?.status()).toBe(200)
      await expect(
        page.getByRole('heading', {level: 2, name: 'Courrier postal'})
      ).toBeVisible()
    } finally {
      await page.context().close()
    }
  })

  test('critère 4 — un passage rejoué ne crée pas de seconde R1', async () => {
    const a = await techCorpId()
    await inTenantScope((client) =>
      client.query(
        `update scheduled_job
            set run_after = now() - interval '1 minute', locked_at = null,
                completed_at = null
          where organization_id = $1 and kind = $2
            and run_after <= now() + interval '1 day'`,
        [a, JOB_KIND]
      )
    )

    runScheduler()

    const reminders = await remindersOfRun()
    expect(reminders.map((reminder) => reminder.rank)).toEqual([1])
    const campaigns = await inTenantScope((client) =>
      client.query(
        `select c.id from campaign c
           join unpaid_reminder r on r.campaign_id = c.id
          where r.due_on = $1`,
        [DUE_ON]
      )
    )
    expect(campaigns.rowCount).toBe(1)
  })

  test('critère 9 — la page de suivi : nom, parcelle, date de facture, relances ; « Courrier » marqué', async ({
    browser,
  }) => {
    const page = await newSession(browser, OWNER_A)
    try {
      await page.goto(`${TENANT_A}${REMINDERS_ROUTE}`)
      await expect(
        page.getByRole('heading', {level: 1, name: 'Relances des impayés'})
      ).toBeVisible()
      await expect(
        page.getByRole('heading', {
          level: 2,
          name: `Échéance du ${frenchDayOf(DUE_ON)}`,
        })
      ).toBeVisible()

      const table = page.getByRole('table')
      const unpaid = table
        .getByRole('row')
        .filter({hasText: FICHES.unpaid.name})
      await expect(unpaid).toContainText(FICHES.unpaid.parcel)
      await expect(unpaid).toContainText(frenchDayOf(ISSUED_ON))
      await expect(unpaid).toContainText('1 sur 3')
      const letter = table
        .getByRole('row')
        .filter({hasText: FICHES.withoutEmail.name})
      await expect(letter).toContainText('Courrier')
      await expect(
        table.getByRole('row').filter({hasText: FICHES.settled.name})
      ).toHaveCount(0)
    } finally {
      await page.context().close()
    }
  })

  test('critère 3 — un membre réglé n’apparaît plus', async ({browser}) => {
    await inTenantScope((client) =>
      client.query(
        `update member_invoice set status = $1 where member_profile_id = $2`,
        [SETTLED_STATUS, ficheIds.unpaid]
      )
    )

    const page = await newSession(browser, OWNER_A)
    try {
      await page.goto(`${TENANT_A}${REMINDERS_ROUTE}`)
      await expect(
        page.getByRole('heading', {level: 1, name: 'Relances des impayés'})
      ).toBeVisible()
      await expect(
        page.getByText(FICHES.withoutEmail.name).first()
      ).toBeVisible()
      await expect(page.getByText(FICHES.unpaid.name)).toHaveCount(0)
    } finally {
      await page.context().close()
    }
  })

  test('un membre simple ne peut pas ouvrir la page', async ({browser}) => {
    const page = await newSession(browser, MEMBER_A)
    try {
      await page.goto(`${TENANT_A}${REMINDERS_ROUTE}`, {waitUntil: 'load'})
      await expect(
        page.getByRole('heading', {level: 1, name: DENIED_TITLE})
      ).toBeVisible()
      await expect(page.getByText(MARKER)).toHaveCount(0)
    } finally {
      await page.context().close()
    }
  })
})
