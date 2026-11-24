/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import {spawnSync} from 'node:child_process'
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
 * portent. Ces listes sont posées **par l'application**, dans l'enregistrement
 * qui active la relance : le serveur sert les réglages depuis son cache, et le
 * formulaire renvoie toutes les clés enregistrées ; une écriture SQL serait
 * écrasée par la copie en cache au premier enregistrement. Les réglages
 * d'origine sont rétablis de même à la fin ; les campagnes, tâches, fiches et
 * parcelles de l'essai sont effacées en SQL.
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
const DELIVER_PART_JOB_KIND = 'campaign.deliver_part'

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
    name: `Brunet ${MARKER}`,
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

/**
 * Un passage du script ne prend que 20 tâches par association, les plus
 * anciennes d'abord (`SCHEDULED_JOBS_BATCH_SIZE`) : des tâches de TechCorp
 * laissées dues par les specs précédents peuvent passer avant celle de
 * l'essai, enfilée la dernière. Les passages sont répétés, bornés, jusqu'à la
 * clôture. Leur durée cumulée reste sous le timeout du test, avec une marge
 * pour le reste du test : le diagnostic s'affiche avant que Playwright coupe.
 */
const MAX_SCHEDULER_PASSES = 3
const SCHEDULER_PASS_TIMEOUT_MS = 90_000
const SCHEDULER_TEST_TIMEOUT_MS =
  MAX_SCHEDULER_PASSES * SCHEDULER_PASS_TIMEOUT_MS + 60_000

type SchedulerPass = {status: number | null; output: string[]}

const runSchedulerPass = (): SchedulerPass => {
  const result = spawnSync('pnpm', ['tsx', SCHEDULER_SCRIPT], {
    env: {...process.env, DATABASE_URL: databaseUrl()},
    encoding: 'utf8',
    timeout: SCHEDULER_PASS_TIMEOUT_MS,
  })
  return {
    status: result.status,
    output:
      `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? String(result.error) : ''}`
        .trim()
        .split('\n')
        .slice(-20),
  }
}

type JobState = {
  id: string
  idempotency_key: string
  attempts: number
  run_after: Date
  locked_at: Date | null
  completed_at: Date | null
  failed_at: Date | null
}

const jobsOf = (jobIds: readonly string[], kind: string) =>
  inTenantScope(async (client) => {
    const result = await client.query<JobState>(
      `select id, idempotency_key, attempts, run_after, locked_at, completed_at, failed_at
         from scheduled_job
        where id = any($1::uuid[]) and kind = $2
        order by run_after`,
      [[...jobIds], kind]
    )
    return result.rows
  })

/** Les tâches de TechCorp dues et ouvertes, par type : ce qui passe avant. */
const dueJobsByKind = () =>
  inTenantScope(async (client) => {
    const result = await client.query<{
      kind: string
      count: number
      oldest: Date
    }>(
      `select kind, count(*)::int as count, min(run_after) as oldest
         from scheduled_job
        where completed_at is null and failed_at is null and run_after <= now()
        group by kind order by kind`
    )
    return result.rows
  })

const isStillDue = (job: JobState) =>
  job.completed_at === null &&
  job.failed_at === null &&
  new Date(job.run_after).getTime() <= Date.now()

/**
 * Passe le planificateur jusqu'à la clôture des tâches données, au plus
 * `MAX_SCHEDULER_PASSES` fois, et prouve qu'elles sont closes. Rend le
 * diagnostic (tâches dues avant, état des tâches, sortie des passages) : de
 * quoi lire un échec en CI sans relancer.
 */
const runSchedulerUntilClosed = async (
  jobIds: readonly string[],
  kind: string = JOB_KIND
): Promise<string> => {
  const dueBefore = await dueJobsByKind()
  const passes: SchedulerPass[] = []
  let jobs = await jobsOf(jobIds, kind)
  const diagnosis = () => JSON.stringify({dueBefore, jobs, passes}, null, 2)

  while (passes.length < MAX_SCHEDULER_PASSES && jobs.some(isStillDue)) {
    const pass = runSchedulerPass()
    passes.push(pass)
    expect(pass.status, diagnosis()).toBe(0)
    jobs = await jobsOf(jobIds, kind)
  }

  expect(jobs, diagnosis()).toHaveLength(jobIds.length)
  expect(
    jobs.every((job) => job.completed_at !== null),
    diagnosis()
  ).toBe(true)
  return diagnosis()
}

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
/** Instantané des réglages touchés ; `null` tant qu'il n'est pas pris. */
let originalSettings: Record<string, string> | null = null
/** La tâche du jour enfilée par l'activation de l'essai (critère 1). */
let todayJobId = ''
/** Horloge de la base au début de l'essai : borne du nettoyage des rangs. */
let runStartedAt: Date | null = null

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

const SETTINGS_SAVED = /Réglages enregistrés/

const reminderEnabledField = (page: Page) =>
  page.getByRole('checkbox', {name: /Relancer automatiquement les impayés/})

/** Les champs texte des réglages touchés, par clé. */
const TEXT_FIELDS = {
  'billing.unpaid_statuses': (page: Page) =>
    page.getByLabel(/Statuts qui valent « impayé »/),
  'billing.settled_statuses': (page: Page) =>
    page.getByLabel(/Statuts qui valent « réglé »/),
  'billing.reminder.body': (page: Page) =>
    page.getByLabel(/Texte de la relance/),
} as const

/**
 * Le corps `multipart/form-data` de l'enregistrement convertit les fins de
 * ligne LF en CRLF, et le serveur ne fait que rogner : un texte multiligne
 * est stocké en CRLF. Les comparaisons se font fins de ligne normalisées.
 */
const normalizeLineEndings = (value: string) => value.replace(/\r\n/g, '\n')

const normalizedSettings = (settings: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(settings).map(([key, value]) => [
      key,
      normalizeLineEndings(value),
    ])
  )

/** Les réglages touchés tels qu'enregistrés en base pour TechCorp. */
const storedTouchedSettings = () =>
  inTenantScope(async (client) => {
    const result = await client.query<{key: string; value: string}>(
      `select key, value from organization_setting
        where organization_id = $1 and key = any($2::text[])`,
      [await techCorpId(), [...TOUCHED_KEYS]]
    )
    return normalizedSettings(
      Object.fromEntries(result.rows.map((row) => [row.key, row.value]))
    )
  })

/**
 * Remet les réglages touchés à leur valeur d'origine **par l'application** :
 * l'action du bureau invalide le cache des réglages (`updateTag`). Une
 * écriture SQL laisserait le serveur servir les valeurs de l'essai aux specs
 * suivantes, et le premier enregistrement venu les réécrirait. Un texte sans
 * valeur d'origine est vidé, donc supprimé par l'action.
 */
const restoreOriginalSettings = async (
  browser: Browser,
  original: Record<string, string>
) => {
  const page = await newSession(browser, OWNER_A)
  try {
    await page.goto(`${TENANT_A}${SETTINGS_ROUTE}`, {waitUntil: 'load'})
    for (const [key, field] of Object.entries(TEXT_FIELDS)) {
      await field(page).fill(original[key] ?? '')
    }
    await reminderEnabledField(page).setChecked(
      original['billing.reminder.enabled'] === 'true'
    )
    await saveSettings(page)
    await expect(page.getByText(SETTINGS_SAVED)).toBeVisible({
      timeout: 15_000,
    })
  } finally {
    await page.context().close()
  }
}

/**
 * Une case décochée s'enregistre `'false'` : l'application ne sait pas
 * supprimer un booléen. Une clé absente au départ et encore présente après la
 * restauration (seule `billing.reminder.enabled` peut l'être) est supprimée
 * en SQL. Le cache du serveur peut encore la porter à `'false'`, la valeur
 * par défaut : la valeur résolue reste celle d'origine.
 */
const deleteSettingsAbsentFrom = async (original: Record<string, string>) => {
  const absent = TOUCHED_KEYS.filter((key) => !(key in original))
  if (absent.length === 0) return
  await inTenantScope(async (client) =>
    client.query(
      `delete from organization_setting
        where organization_id = $1 and key = any($2::text[])`,
      [await techCorpId(), absent]
    )
  )
}

/**
 * Efface en SQL les lignes de l'essai. Les rangs de TechCorp créés depuis
 * son début, quelle que soit l'échéance, et leurs campagnes : un passage
 * peut relancer une autre échéance que `DUE_ON`.
 */
const deleteRunData = async () => {
  const a = await techCorpId()
  // Ordre imposé par les clés étrangères en `restrict` : factures et
  // propriétés avant les fiches et les parcelles qu'elles référencent. Les
  // lignes de la campagne, son courrier et son rang suivent la campagne en
  // cascade ; les adresses, la fiche.
  const ficheIdsOfRun = `select id from member_profile
    where organization_id = $1 and name like $2`
  await withAppRoleClient((client) =>
    inTransaction(client, ['app.bypass_rls', 'on'], async () => {
      const reminders = await client.query<{campaign_id: string}>(
        `select campaign_id from unpaid_reminder
          where organization_id = $1
            and (due_on = $2 or created_at >= $3::timestamptz)`,
        [a, DUE_ON, runStartedAt ?? 'infinity']
      )
      const campaignIds = reminders.rows.map((reminder) => reminder.campaign_id)
      await client.query(`delete from campaign where id = any($1::uuid[])`, [
        campaignIds,
      ])
      await client.query(
        `delete from scheduled_job
          where organization_id = $1
            and (kind = $2 or payload->>'campaignId' = any($3::text[]))`,
        [a, JOB_KIND, campaignIds]
      )
      await client.query(
        `delete from member_invoice where member_profile_id in (${ficheIdsOfRun})`,
        [a, `%${MARKER}%`]
      )
      await client.query(
        `delete from parcel_ownership where member_profile_id in (${ficheIdsOfRun})`,
        [a, `%${MARKER}%`]
      )
      await client.query(
        `delete from member_profile where organization_id = $1 and name like $2`,
        [a, `%${MARKER}%`]
      )
      await client.query(
        `delete from parcel where organization_id = $1 and number like $2`,
        [a, `R29-${RUN}-%`]
      )
    })
  )
}

/**
 * Livre la R1 de l'essai avant la page de suivi : « 1 sur 3 » exige une ligne
 * `sent`. La part est programmée à 02:00 (heure de Paris) si la R1 naît
 * entre minuit et 02:00 (`partRunAfter`) : ses tâches ouvertes sont rendues
 * dues, puis un passage borné les clôt. La page ne dépend ainsi ni de
 * l'heure ni de ce qu'a livré le passage du test précédent.
 */
const deliverRunReminder = async () => {
  const reminders = await remindersOfRun()
  expect(
    reminders.map((reminder) => reminder.rank),
    'le critère 7 crée R1'
  ).toEqual([1])
  const campaignId = reminders[0].campaign_id
  const partJobIds = await inTenantScope(async (client) => {
    const jobs = await client.query<{id: string}>(
      `select id from scheduled_job
        where kind = $1 and payload->>'campaignId' = $2`,
      [DELIVER_PART_JOB_KIND, campaignId]
    )
    await client.query(
      `update scheduled_job
          set run_after = now() - interval '1 minute', locked_at = null
        where kind = $1 and payload->>'campaignId' = $2
          and completed_at is null and failed_at is null`,
      [DELIVER_PART_JOB_KIND, campaignId]
    )
    return jobs.rows.map((job) => job.id)
  })
  expect(partJobIds.length, 'la R1 a au moins une part').toBeGreaterThan(0)

  const diagnosis = await runSchedulerUntilClosed(
    partJobIds,
    DELIVER_PART_JOB_KIND
  )
  const statuses = await inTenantScope(async (client) => {
    const result = await client.query<{status: string}>(
      `select status from campaign_recipient where campaign_id = $1`,
      [campaignId]
    )
    return result.rows.map((row) => row.status)
  })
  expect(statuses, diagnosis).toEqual(['sent'])
}

test.describe('Relances des impayés — activation, passage, suivi (s29)', () => {
  test.beforeAll(async () => {
    // Tout enregistrement des réglages de TechCorp, relance activée par le
    // seed, garantit la tâche du jour : une tâche laissée par un autre spec,
    // déjà close par un passage, rendrait sans effet l'activation de l'essai.
    const tenant = await techCorpId()
    await withAppRoleClient(async (client) => {
      const clock = await client.query<{now: Date}>(`select now() as now`)
      runStartedAt = clock.rows[0].now
      await inTransaction(client, ['app.bypass_rls', 'on'], () =>
        client.query(
          `delete from scheduled_job where organization_id = $1 and kind = $2`,
          [tenant, JOB_KIND]
        )
      )
    })
    await inTenantScope(async (client) => {
      const a = await techCorpId()
      const stored = await client.query<{key: string; value: string}>(
        `select key, value from organization_setting
          where organization_id = $1 and key = any($2::text[])`,
        [a, [...TOUCHED_KEYS]]
      )
      originalSettings = Object.fromEntries(
        stored.rows.map((row) => [row.key, row.value])
      )
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

  test.afterAll(async ({browser}) => {
    // Une connexion, un enregistrement et le nettoyage : plus que les 30 s
    // par défaut d'un hook sur un runner lent.
    test.setTimeout(90_000)
    try {
      // Sans instantané (`beforeAll` tombé avant), rien à rétablir : une
      // restauration à vide effacerait les listes et le texte de TechCorp.
      // Avant le nettoyage SQL : l'enregistrement, relance activée, enfile la
      // tâche du jour, que le nettoyage efface avec celles de l'essai.
      const original = originalSettings
      if (original) {
        await restoreOriginalSettings(browser, original)
        await deleteSettingsAbsentFrom(original)
        expect(await storedTouchedSettings()).toEqual(
          normalizedSettings(original)
        )
      }
    } finally {
      await deleteRunData()
    }
  })

  test('critère 1 — le bureau active la relance : refusée sans texte, puis enregistrée', async ({
    browser,
  }) => {
    const page = await newSession(browser, OWNER_A)
    try {
      await page.goto(`${TENANT_A}${SETTINGS_ROUTE}`)
      const enabled = reminderEnabledField(page)
      const body = TEXT_FIELDS['billing.reminder.body'](page)

      if (await enabled.isChecked()) {
        await enabled.uncheck()
        await saveSettings(page)
        await expect(page.getByText(SETTINGS_SAVED)).toBeVisible()
        await page.reload()
      }

      await body.fill('')
      await enabled.check()
      await saveSettings(page)
      await expect(
        page.getByText('Écrivez le texte de la relance avant de l’activer.')
      ).toBeVisible()

      // Les listes de statuts de l'essai partent dans le même enregistrement
      // que la relance : posées en SQL, elles seraient réécrites ici par la
      // copie en cache que le formulaire renvoie.
      await TEXT_FIELDS['billing.unpaid_statuses'](page).fill(UNPAID_STATUS)
      await TEXT_FIELDS['billing.settled_statuses'](page).fill(SETTLED_STATUS)
      const reminderBody = `Bonjour {nom},\n\n{factures}\n\n${MARKER}`
      await body.fill(reminderBody)
      await saveSettings(page)
      await expect(page.getByText(SETTINGS_SAVED)).toBeVisible()

      expect(await storedTouchedSettings()).toEqual({
        'billing.unpaid_statuses': UNPAID_STATUS,
        'billing.settled_statuses': SETTLED_STATUS,
        'billing.reminder.enabled': 'true',
        'billing.reminder.body': normalizeLineEndings(reminderBody),
      })

      const jobs = await inTenantScope((client) =>
        client.query(
          `select id from scheduled_job where kind = $1 and completed_at is null`,
          [JOB_KIND]
        )
      )
      expect(jobs.rowCount).toBeGreaterThan(0)

      // La tâche du jour est enfilée due tout de suite ; celle du lendemain
      // ne l'est qu'à 02:00 (heure de Paris) le lendemain : deux heures plus
      // loin au plus tôt.
      const today = await inTenantScope((client) =>
        client.query<{id: string}>(
          `select id from scheduled_job
            where kind = $1 and completed_at is null
              and run_after < now() + interval '1 hour'`,
          [JOB_KIND]
        )
      )
      expect(today.rowCount).toBe(1)
      todayJobId = today.rows[0].id
    } finally {
      await page.context().close()
    }
  })

  test('critères 7 et 10 — un passage crée R1 : les seuls impayés, la fiche sans email au courrier', async ({
    browser,
  }) => {
    test.setTimeout(SCHEDULER_TEST_TIMEOUT_MS)
    expect(todayJobId, 'le critère 1 enfile la tâche du jour').toBeTruthy()
    const diagnosis = await runSchedulerUntilClosed([todayJobId])

    const reminders = await remindersOfRun()
    expect(
      reminders.map((reminder) => reminder.rank),
      diagnosis
    ).toEqual([1])
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
    test.setTimeout(SCHEDULER_TEST_TIMEOUT_MS)
    const a = await techCorpId()
    const replayed = await inTenantScope((client) =>
      client.query<{id: string}>(
        `update scheduled_job
            set run_after = now() - interval '1 minute', locked_at = null,
                completed_at = null
          where organization_id = $1 and kind = $2
            and run_after <= now() + interval '1 day'
        returning id`,
        [a, JOB_KIND]
      )
    )
    expect(replayed.rows.map((row) => row.id)).toContain(todayJobId)

    const diagnosis = await runSchedulerUntilClosed(
      replayed.rows.map((row) => row.id)
    )

    const reminders = await remindersOfRun()
    expect(
      reminders.map((reminder) => reminder.rank),
      diagnosis
    ).toEqual([1])
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
    test.setTimeout(SCHEDULER_TEST_TIMEOUT_MS)
    await deliverRunReminder()

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
      const headers = await table.getByRole('columnheader').allTextContents()
      const channelColumn = headers.findIndex(
        (header) => header.trim() === 'Envoi'
      )
      expect(channelColumn, JSON.stringify(headers)).toBeGreaterThan(-1)
      await expect(unpaid.getByRole('cell').nth(channelColumn)).toHaveText(
        'Email'
      )
      const letter = table
        .getByRole('row')
        .filter({hasText: FICHES.withoutEmail.name})
      await expect(letter.getByRole('cell').nth(channelColumn)).toHaveText(
        'Courrier'
      )
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
