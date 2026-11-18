/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {Browser, expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Cible d'une campagne — s27, critères 1 à 8 (ADR 060).
 *
 * Ce que seuls un navigateur, deux domaines et une vraie base prouvent : un
 * groupe se crée, se compose depuis la liste des propriétaires et sert de
 * cible ; seules ses adresses non désinscrites reçoivent la campagne (outbox
 * `file`) ; la cible « impayés » ne retient que les fiches dont une facture
 * est impayée, jamais une facture « à classer » ; supprimer le groupe laisse
 * l'archive intacte ; la RLS forcée isole les nouvelles tables. Une adresse
 * partagée avec une fiche réglée ne cite, à l'envoi « impayés », que la
 * parcelle de la fiche ciblée (ADR 061).
 *
 * `localhost` sert TechCorp Solutions, `127.0.0.1` Marketing Pro (seed). La
 * spec crée ses fiches, sa parcelle et ses factures chez TechCorp et les
 * efface à la fin, avec ses groupes et ses campagnes. Les fiches du seed en
 * impayé reçoivent aussi la campagne « impayés » : les assertions portent sur
 * les fiches de l'essai.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
const TENANT_A = `http://localhost:${PORT}`
const TENANT_B = `http://127.0.0.1:${PORT}`
const PASSWORD = 'Azerty123'
const OWNER_A = 'user-owner@gmail.com'
const BOARD_B = 'user-admin@gmail.com'

const GROUPS_ROUTE = '/bureau/groupes'
const NEW_CAMPAIGN_ROUTE = '/bureau/campagnes/nouvelle'
const NOT_FOUND_TITLE = 'Page non trouvée'

/** Le classement de démonstration du seed (TechCorp). */
const UNPAID_STATUS = 'En attente'
const UNCLASSIFIED_STATUS = 'Partiellement payée'
const SETTLED_STATUS = 'Payée'

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
const MARKER = `s27-${RUN}`
const subjectOf = (label: string) => `${label} ${MARKER}`
const GROUP_NAME = `Riverains ${MARKER}`
const UNPAID_PARCEL = `P-${RUN}`
const SETTLED_PARCEL = `R-${RUN}`

const FICHES = {
  first: {name: `Fiche groupe un ${MARKER}`, email: `g1-${RUN}@example.test`},
  second: {
    name: `Fiche groupe deux ${MARKER}`,
    email: `g2-${RUN}@example.test`,
  },
  unsubscribed: {
    name: `Fiche groupe désinscrite ${MARKER}`,
    email: `g3-${RUN}@example.test`,
  },
  outside: {
    name: `Fiche hors groupe ${MARKER}`,
    email: `hors-${RUN}@example.test`,
  },
  unpaid: {name: `Fiche impayée ${MARKER}`, email: `imp-${RUN}@example.test`},
  unclassified: {
    name: `Fiche à classer ${MARKER}`,
    email: `acl-${RUN}@example.test`,
  },
  /** Même adresse que la fiche impayée, facture réglée (ADR 061). */
  settledSameAddress: {
    name: `Fiche réglée même adresse ${MARKER}`,
    email: `imp-${RUN}@example.test`,
  },
} as const

type FicheKey = keyof typeof FICHES

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

const ficheIds = {} as Record<FicheKey, string>

/** La campagne « impayés » de l'essai, relue par l'accès croisé. */
let unpaidCampaignId: string | undefined

/**
 * Les fiches de l'essai, chacune avec son adresse titulaire active ; une
 * parcelle de l'essai et deux factures saisies : l'une impayée, l'autre à un
 * statut que le classement ne range nulle part. La fiche impayée possède la
 * parcelle ; une fiche réglée qui partage son adresse en possède une autre.
 */
const createFixtures = async () => {
  const {a} = await tenantIds()
  await inTenantScope(a, async (client) => {
    for (const key of Object.keys(FICHES) as FicheKey[]) {
      const fiche = FICHES[key]
      const {rows} = await client.query<{id: string}>(
        `insert into member_profile (organization_id, name)
         values ($1, $2) returning id`,
        [a, fiche.name]
      )
      ficheIds[key] = rows[0].id
      await client.query(
        `insert into member_profile_email
           (organization_id, member_profile_id, email, role, status, origin, unsubscribed_at)
         values ($1, $2, $3, 'holder', 'active', 'site', $4)`,
        [a, rows[0].id, fiche.email, key === 'unsubscribed' ? new Date() : null]
      )
    }
    const parcelIdOf = {} as Record<string, string>
    for (const number of [UNPAID_PARCEL, SETTLED_PARCEL]) {
      const {rows: parcels} = await client.query<{id: string}>(
        `insert into parcel (organization_id, number) values ($1, $2) returning id`,
        [a, number]
      )
      parcelIdOf[number] = parcels[0].id
    }
    for (const [key, number] of [
      ['unpaid', UNPAID_PARCEL],
      ['settledSameAddress', SETTLED_PARCEL],
    ] as const) {
      await client.query(
        `insert into parcel_ownership (organization_id, parcel_id, member_profile_id, starts_on)
         values ($1, $2, $3, '2020-01-01')`,
        [a, parcelIdOf[number], ficheIds[key]]
      )
    }
    for (const [key, status, number] of [
      ['unpaid', UNPAID_STATUS, UNPAID_PARCEL],
      ['unclassified', UNCLASSIFIED_STATUS, UNPAID_PARCEL],
      ['settledSameAddress', SETTLED_STATUS, SETTLED_PARCEL],
    ] as const) {
      await client.query(
        `insert into member_invoice
           (organization_id, member_profile_id, parcel_id, source, year, issued_on, due_on, amount_cents, status)
         values ($1, $2, $3, 'site', 2026, '2026-03-15', '2026-04-15', 4200, $4)`,
        [a, ficheIds[key], parcelIdOf[number], status]
      )
    }
  })
}

/** Chaque essai efface ses campagnes, ses groupes, ses factures et ses fiches. */
const cleanUpRun = () =>
  asMaintenance(async (client) => {
    await client.query(`delete from campaign where subject like $1`, [
      `%${MARKER}%`,
    ])
    await client.query(`delete from recipient_group where name like $1`, [
      `%${MARKER}%`,
    ])
    await client.query(
      `delete from member_invoice where member_profile_id in
         (select id from member_profile where name like $1)`,
      [`%${MARKER}%`]
    )
    await client.query(
      `delete from parcel_ownership where parcel_id in
         (select id from parcel where number = any($1))`,
      [[UNPAID_PARCEL, SETTLED_PARCEL]]
    )
    await client.query(`delete from parcel where number = any($1)`, [
      [UNPAID_PARCEL, SETTLED_PARCEL],
    ])
    await client.query(`delete from member_profile where name like $1`, [
      `%${MARKER}%`,
    ])
  })

/** Les statuts « impayés » du classement en vigueur du tenant, un par ligne. */
const unpaidStatusesOf = async (
  client: Client,
  organizationId: string
): Promise<string[]> => {
  const {rows} = await client.query<{value: string}>(
    `select value from organization_setting
      where organization_id = $1 and key = 'billing.unpaid_statuses'`,
    [organizationId]
  )
  const statuses = (rows[0]?.value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
  expect(statuses, 'le seed classe des statuts impayés').toContain(
    UNPAID_STATUS
  )
  return statuses
}

const groupIdOfRun = async (): Promise<string | undefined> => {
  const {a} = await tenantIds()
  return inTenantScope(a, async (client) => {
    const {rows} = await client.query<{id: string}>(
      `select id from recipient_group where name = $1`,
      [GROUP_NAME]
    )
    return rows[0]?.id
  })
}

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

/** Session du bureau ; le cookie `NEXT_LOCALE` fait répondre les actions en français. */
const newSession = async (browser: Browser, base: string, email: string) => {
  const context = await browser.newContext({locale: 'fr-FR'})
  await context.addCookies([{name: 'NEXT_LOCALE', value: 'fr', url: base}])
  const page = await context.newPage()
  await login(page, base, email)
  return page
}

type OutboxMessage = {to: string; subject: string; text: string}

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

const messagesTo = (before: Set<string>, to: string): OutboxMessage[] =>
  [...outboxFiles()]
    .filter((file) => !before.has(file))
    .map(
      (file) =>
        JSON.parse(
          fs.readFileSync(path.join(outboxDir(), file), 'utf8')
        ) as OutboxMessage
    )
    .filter((message) => message.to === to)

/** Choisit une option d'un `select` du socle (Radix), par son libellé. */
const choose = async (page: Page, field: string, option: RegExp | string) => {
  await page.getByRole('combobox', {name: field, exact: true}).click()
  await page.getByRole('option', {name: option}).click()
}

/**
 * Compose en mode libre pour la cible choisie, ouvre l'aperçu, envoie ;
 * rend l'id de la campagne.
 */
const composeAndSend = async (
  page: Page,
  input: {
    subject: string
    target: RegExp
    group?: RegExp
    expectedRecipients: number
    body?: string
  }
): Promise<string> => {
  await page.goto(`${TENANT_A}${NEW_CAMPAIGN_ROUTE}`, {
    waitUntil: 'networkidle',
  })
  await page.getByRole('radio', {name: input.target}).click()
  if (input.group) await choose(page, 'Groupe', input.group)
  await page.getByRole('textbox', {name: /^Objet/}).fill(input.subject)
  await page
    .getByRole('textbox', {name: 'Message', exact: true})
    .fill(input.body ?? 'Bonjour {nom},\n\nUn message pour vous.')
  await page.getByRole('button', {name: 'Voir l’aperçu'}).click()
  await expect(
    page.getByRole('heading', {level: 1, name: 'Aperçu avant l’envoi'})
  ).toBeVisible({timeout: 15_000})

  const sendLabel = new RegExp(
    `^Envoyer à ${input.expectedRecipients} membres?$`
  )
  await page.getByRole('button', {name: sendLabel}).click()
  const dialog = page.getByRole('alertdialog', {name: 'Envoyer la campagne ?'})
  await dialog.getByRole('button', {name: sendLabel}).click()

  await page.waitForURL(/\/bureau\/campagnes\/[0-9a-f-]{36}\?envoi=1$/, {
    timeout: 20_000,
  })
  return new URL(page.url()).pathname.split('/').pop() as string
}

const CAP_KEY = 'campaign.daily_send_cap'
const RAISED_CAP = '100000'

/**
 * Le plafond quotidien de TechCorp lu avant l'essai : `null` si la clé
 * n'existait pas, `undefined` tant qu'il n'a pas été relevé.
 */
let previousCap: string | null | undefined

/**
 * Les specs précédentes du même run consomment le plafond quotidien de
 * campagnes de TechCorp : sans le relever, la campagne de l'essai serait
 * planifiée au lendemain et l'outbox resterait vide le jour même.
 */
const raiseDailyCap = async () => {
  const {a} = await tenantIds()
  await inTenantScope(a, async (client) => {
    const current = await client.query<{value: string}>(
      `select value from organization_setting
        where organization_id = $1 and key = $2`,
      [a, CAP_KEY]
    )
    previousCap = current.rows[0]?.value ?? null
    await client.query(
      `insert into organization_setting (organization_id, key, value)
       values ($1, $2, $3)
       on conflict (organization_id, key) do update set value = $3`,
      [a, CAP_KEY, RAISED_CAP]
    )
  })
}

/** Rend le plafond d'avant l'essai, ou retire la clé si elle n'existait pas. */
const restoreDailyCap = async () => {
  if (previousCap === undefined) return
  const {a} = await tenantIds()
  const value = previousCap
  await inTenantScope(a, (client) =>
    value === null
      ? client.query(
          `delete from organization_setting
            where organization_id = $1 and key = $2`,
          [a, CAP_KEY]
        )
      : client.query(
          `update organization_setting set value = $3
            where organization_id = $1 and key = $2`,
          [a, CAP_KEY, value]
        )
  )
  previousCap = undefined
}

test.describe('Cible d’une campagne — groupes et impayés (s27)', () => {
  test.beforeAll(async () => {
    await cleanUpRun()
    await createFixtures()
    await raiseDailyCap()
  })

  test.afterAll(async () => {
    try {
      await cleanUpRun()
    } finally {
      await restoreDailyCap()
    }
  })

  test('critères 3 à 7 — créer un groupe, le composer depuis la liste, lui envoyer, le supprimer', async ({
    browser,
  }) => {
    test.setTimeout(180_000)
    const bureau = await newSession(browser, TENANT_A, OWNER_A)
    try {
      await bureau.goto(`${TENANT_A}${GROUPS_ROUTE}`, {
        waitUntil: 'networkidle',
      })
      await bureau.getByRole('button', {name: 'Créer un groupe'}).click()
      const create = bureau.getByRole('dialog', {name: 'Créer un groupe'})
      await create
        .getByRole('textbox', {name: 'Nom du groupe'})
        .fill(GROUP_NAME)
      await create.getByRole('button', {name: 'Créer le groupe'}).click()
      await bureau.waitForURL(/\/bureau\/groupes\/[0-9a-f-]{36}$/, {
        timeout: 20_000,
      })
      await expect(
        bureau.getByRole('heading', {level: 1, name: GROUP_NAME})
      ).toBeVisible()

      // Critère 3 : depuis la liste des propriétaires, cocher puis ajouter.
      await bureau.goto(
        `${TENANT_A}/bureau/proprietaires?q=${encodeURIComponent(MARKER)}`,
        {waitUntil: 'networkidle'}
      )
      const table = bureau.getByRole('table')
      for (const key of ['first', 'second', 'unsubscribed'] as const) {
        await table
          .getByRole('checkbox', {name: `Sélectionner ${FICHES[key].name}`})
          .click()
      }
      await expect(bureau.getByText('3 fiches sélectionnées')).toBeVisible()
      await choose(bureau, 'Ajouter au groupe', GROUP_NAME)
      await bureau.getByRole('button', {name: 'Ajouter au groupe'}).click()
      await expect(
        bureau.getByText(
          `3 fiches ajoutées au groupe « ${GROUP_NAME} ». Le groupe compte 3 fiches.`
        )
      ).toBeVisible({timeout: 15_000})

      // Critères 4, 5 et 7 : le groupe comme cible, compté en fiches puis en
      // adresses ; l'adresse désinscrite ne reçoit rien.
      await bureau.goto(`${TENANT_A}${NEW_CAMPAIGN_ROUTE}`, {
        waitUntil: 'networkidle',
      })
      await bureau.getByRole('radio', {name: /Un groupe/}).click()
      await choose(bureau, 'Groupe', new RegExp(GROUP_NAME))
      const recipients = bureau
        .getByRole('heading', {name: '3 · Destinataires'})
        .locator('xpath=..')
      await expect(
        recipients.getByRole('group', {name: 'Fiches'})
      ).toContainText('Fiches de la cible3', {timeout: 15_000})
      await expect(
        recipients.getByRole('group', {name: 'Adresses'})
      ).toContainText('ne reçoit qu’un message.2')

      const before = outboxFiles()
      const subject = subjectOf('Travaux du chemin')
      const campaignId = await composeAndSend(bureau, {
        subject,
        target: /Un groupe/,
        group: new RegExp(GROUP_NAME),
        expectedRecipients: 2,
      })
      await expect
        .poll(
          () =>
            [FICHES.first.email, FICHES.second.email].filter(
              (email) => messagesTo(before, email).length === 1
            ).length,
          {timeout: 30_000}
        )
        .toBe(2)
      for (const key of ['unsubscribed', 'outside', 'unpaid'] as const) {
        expect(messagesTo(before, FICHES[key].email), key).toHaveLength(0)
      }

      // Critère 6 : supprimer le groupe ne touche ni les fiches ni l'archive.
      const groupId = await groupIdOfRun()
      await bureau.goto(`${TENANT_A}${GROUPS_ROUTE}/${groupId}`, {
        waitUntil: 'networkidle',
      })
      await bureau.getByRole('button', {name: 'Supprimer le groupe'}).click()
      await bureau
        .getByRole('alertdialog')
        .getByRole('button', {name: 'Supprimer le groupe'})
        .click()
      await expect(
        bureau.getByText('Groupe supprimé. Ses fiches n’ont pas changé.')
      ).toBeVisible({timeout: 15_000})
      expect(bureau.url()).not.toContain(encodeURIComponent(GROUP_NAME))
      expect(await groupIdOfRun()).toBeUndefined()

      const {a} = await tenantIds()
      const archive = await inTenantScope(a, async (client) => ({
        campaign: await client.query<{
          target_kind: string
          target_group_id: string | null
          target_group_name: string
        }>(
          `select target_kind, target_group_id, target_group_name from campaign where id = $1`,
          [campaignId]
        ),
        recipients: await client.query(
          `select id from campaign_recipient where campaign_id = $1`,
          [campaignId]
        ),
        fiches: await client.query(
          `select id from member_profile where id = any($1)`,
          [[ficheIds.first, ficheIds.second, ficheIds.unsubscribed]]
        ),
      }))
      expect(archive.campaign.rows[0]).toEqual({
        target_kind: 'group',
        target_group_id: null,
        target_group_name: GROUP_NAME,
      })
      expect(archive.recipients.rowCount).toBe(2)
      expect(archive.fiches.rowCount).toBe(3)

      await bureau.goto(`${TENANT_A}/bureau/campagnes/${campaignId}`, {
        waitUntil: 'networkidle',
      })
      await expect(
        bureau.getByText(`Groupe « ${GROUP_NAME} » (supprimé)`)
      ).toBeVisible({timeout: 15_000})
    } finally {
      await bureau.context().close()
    }
  })

  test('critères 1 et 2 — « impayés » : une facture impayée retient la fiche, une facture « à classer » non', async ({
    browser,
  }) => {
    test.setTimeout(150_000)
    const bureau = await newSession(browser, TENANT_A, OWNER_A)
    try {
      const before = outboxFiles()
      const {a} = await tenantIds()
      const expected = await inTenantScope(a, async (client) => {
        const {rows} = await client.query<{addresses: number}>(
          `select count(distinct lower(trim(e.email)))::int as addresses
             from member_profile_email e
            where e.organization_id = $1 and e.status = 'active'
              and e.member_profile_id in (
                select i.member_profile_id from member_invoice i
                 where i.status = any($2))
              and lower(trim(e.email)) not in (
                select lower(trim(x.email)) from member_profile_email x
                 where x.organization_id = $1 and x.status = 'active'
                   and x.unsubscribed_at is not null)`,
          [a, await unpaidStatusesOf(client, a)]
        )
        return rows[0].addresses
      })

      unpaidCampaignId = await composeAndSend(bureau, {
        subject: subjectOf('Rappel de facture'),
        target: /Les membres en impayé/,
        expectedRecipients: expected,
        body: 'Bonjour {nom}, parcelle {parcelle}.',
      })
      await expect
        .poll(() => messagesTo(before, FICHES.unpaid.email).length, {
          timeout: 30_000,
        })
        .toBe(1)
      expect(messagesTo(before, FICHES.unclassified.email)).toHaveLength(0)
      expect(messagesTo(before, FICHES.outside.email)).toHaveLength(0)

      // ADR 061 : l'adresse est partagée avec une fiche réglée ; l'envoi ne
      // cite que la parcelle et le nom de la fiche ciblée.
      const [reminder] = messagesTo(before, FICHES.unpaid.email)
      expect(reminder.text).toContain(
        `Bonjour ${FICHES.unpaid.name}, parcelle ${UNPAID_PARCEL}.`
      )
      expect(reminder.text).not.toContain(SETTLED_PARCEL)
      expect(reminder.text).not.toContain(FICHES.settledSameAddress.name)
    } finally {
      await bureau.context().close()
    }
  })

  test('critère 8 — accès croisé : les tables de s27 invisibles depuis B, un id forgé introuvable, une fiche étrangère refusée par l’action', async ({
    browser,
  }) => {
    test.setTimeout(180_000)
    const ids = await tenantIds()
    const groupId = await inTenantScope(ids.a, async (client) => {
      const {rows} = await client.query<{id: string}>(
        `insert into recipient_group (organization_id, name)
         values ($1, $2) returning id`,
        [ids.a, `Isolation ${MARKER}`]
      )
      await client.query(
        `insert into recipient_group_member (organization_id, group_id, member_profile_id)
         values ($1, $2, $3)`,
        [ids.a, rows[0].id, ficheIds.first]
      )
      return rows[0].id
    })

    const seenFromB = await inTenantScope(ids.b, async (client) => ({
      groups: await client.query(
        `select id from recipient_group where id = $1`,
        [groupId]
      ),
      members: await client.query(
        `select group_id from recipient_group_member where group_id = $1`,
        [groupId]
      ),
    }))
    expect(seenFromB.groups.rowCount, 'un oubli de scope ne fuite pas').toBe(0)
    expect(seenFromB.members.rowCount).toBe(0)

    const withoutScope = await withAppRoleClient(async (client) => ({
      groups: await client.query(`select id from recipient_group`),
      members: await client.query(
        `select group_id from recipient_group_member`
      ),
    }))
    expect(withoutScope.groups.rowCount).toBe(0)
    expect(withoutScope.members.rowCount).toBe(0)

    await expect(
      inTenantScope(ids.b, (client) =>
        client.query(
          `insert into recipient_group (organization_id, name) values ($1, $2)`,
          [ids.a, `Intrus ${MARKER}`]
        )
      )
    ).rejects.toThrow(/row-level security/)

    // ADR 061 : les fiches figées de la campagne « impayés » de A.
    expect(
      unpaidCampaignId,
      'la campagne « impayés » a été envoyée'
    ).toBeTruthy()
    const frozenOfRun = `select crp.member_profile_id from campaign_recipient_profile crp
       join campaign_recipient cr on cr.id = crp.campaign_recipient_id
      where cr.campaign_id = $1`
    const frozenFromA = await inTenantScope(ids.a, (client) =>
      client.query<{member_profile_id: string}>(frozenOfRun, [unpaidCampaignId])
    )
    expect(frozenFromA.rows.map((row) => row.member_profile_id)).toContain(
      ficheIds.unpaid
    )
    expect(frozenFromA.rows.map((row) => row.member_profile_id)).not.toContain(
      ficheIds.settledSameAddress
    )
    const frozenFromB = await inTenantScope(ids.b, (client) =>
      client.query(`select member_profile_id from campaign_recipient_profile`)
    )
    expect(
      frozenFromB.rows.filter((row) =>
        [ficheIds.unpaid, ficheIds.settledSameAddress].includes(
          row.member_profile_id
        )
      )
    ).toHaveLength(0)
    const frozenWithoutScope = await withAppRoleClient((client) =>
      client.query(`select member_profile_id from campaign_recipient_profile`)
    )
    expect(frozenWithoutScope.rowCount).toBe(0)

    // Le service refuse une fiche illisible sous le tenant : une fiche de B
    // n'existe pas sous le scope de A.
    const profileOfB = await inTenantScope(ids.b, async (client) => {
      const {rows} = await client.query<{id: string}>(
        `select id from member_profile limit 1`
      )
      return rows[0]?.id
    })
    expect(profileOfB, 'le seed porte des fiches chez B').toBeTruthy()
    const readFromA = await inTenantScope(ids.a, (client) =>
      client.query(`select id from member_profile where id = $1`, [profileOfB])
    )
    expect(readFromA.rowCount).toBe(0)

    // Revue m3 : par l'action elle-même, un id de fiche de B forgé dans la
    // requête est refusé, et rien n'est ajouté au groupe.
    const bureauA = await newSession(browser, TENANT_A, OWNER_A)
    try {
      await bureauA.goto(
        `${TENANT_A}/bureau/proprietaires?q=${encodeURIComponent(MARKER)}`,
        {waitUntil: 'networkidle'}
      )
      await bureauA
        .getByRole('table')
        .getByRole('checkbox', {name: `Sélectionner ${FICHES.outside.name}`})
        .click()
      await choose(bureauA, 'Ajouter au groupe', `Isolation ${MARKER}`)
      let forged = false
      await bureauA.route(/\/bureau\/proprietaires/, async (route) => {
        const request = route.request()
        const body = request.postDataBuffer()?.toString('utf8') ?? ''
        if (
          request.method() !== 'POST' ||
          !request.headers()['next-action'] ||
          !body.includes(ficheIds.outside)
        ) {
          return route.continue()
        }
        forged = true
        return route.continue({
          postData: body.replaceAll(ficheIds.outside, profileOfB as string),
        })
      })
      await bureauA.getByRole('button', {name: 'Ajouter au groupe'}).click()
      await expect(
        bureauA.getByText(
          'Les fiches n’ont pas été ajoutées au groupe. Rien n’a changé. Réessayez.'
        )
      ).toBeVisible({timeout: 15_000})
      expect(forged, 'la requête de l’action a bien été forgée').toBe(true)
    } finally {
      await bureauA.context().close()
    }
    const membersAfter = await asMaintenance((client) =>
      client.query<{member_profile_id: string}>(
        `select member_profile_id from recipient_group_member where group_id = $1`,
        [groupId]
      )
    )
    expect(membersAfter.rows.map((row) => row.member_profile_id)).toEqual([
      ficheIds.first,
    ])

    const boardB = await newSession(browser, TENANT_B, BOARD_B)
    try {
      await boardB.goto(`${TENANT_B}${GROUPS_ROUTE}/${groupId}`, {
        waitUntil: 'networkidle',
      })
      await expect(boardB.getByText(NOT_FOUND_TITLE)).toBeVisible({
        timeout: 15_000,
      })
      await boardB.goto(`${TENANT_B}${GROUPS_ROUTE}`, {
        waitUntil: 'networkidle',
      })
      await expect(
        boardB.getByRole('heading', {
          level: 1,
          name: 'Groupes de destinataires',
        })
      ).toBeVisible({timeout: 15_000})
      await expect(boardB.getByText(MARKER)).toHaveCount(0)
    } finally {
      await boardB.context().close()
    }
  })
})
