/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'

import {Browser, expect, Page, test} from '@playwright/test'
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs'

import {
  asMaintenance,
  inTenant,
  PARIS_DAY_SQL,
  tenantIdOf,
} from './support/database'
import {addProfileEmail} from './support/member-email-card'
import {
  loginLinkOf,
  newMessagesTo,
  outboxFiles,
  unsubscribeTokenOf,
} from './support/outbox'
import {runSchedulerProcess} from './support/scheduler'

/**
 * Lancement des invitations — s42b (ADR 072).
 *
 * Ce que seuls un navigateur, deux domaines, le vrai planificateur et une
 * vraie base prouvent : le bureau lance les invitations depuis
 * `/bureau/invitations` ; une part **reportée au lendemain** (plafond des
 * campagnes abaissé à 2) part par le script du planificateur, hors requête,
 * et son lien ouvre la session sur le domaine de son association (C10), sur
 * deux associations ; une fiche à deux adresses reçoit deux liens distincts,
 * une adresse sur deux fiches un seul email (C6) ; le courrier du lancement
 * ne porte aucun lien de connexion (C2, C5) ; un second lancement ne repart
 * pas ; la relance atteint un désinscrit en `statutaire` (TechCorp, seed) et
 * l'exclut en `facultative` (Marketing Pro), n'atteint pas l'adresse
 * connectée, atteint l'adresse ajoutée après le lancement (C3, C8) ; le
 * bureau de A ne lance rien sur B.
 *
 * Comptes et adresses **propres à chaque association** (revue s42a, m4 : la
 * révocation des liens n'est pas bornée à l'association). Le lancement est
 * unique par association : la spec efface ses campagnes, tâches, traces,
 * plafond et budget du jour à la fin. Jamais lancée en local : CI seulement.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
const TENANT_A = `http://localhost:${PORT}`
const TENANT_B = `http://127.0.0.1:${PORT}`
const TENANT_A_SLUG = 'techcorp-solutions'
const TENANT_B_SLUG = 'marketing-pro'

const PASSWORD = 'Azerty123'
/** Présidente de TechCorp Solutions. */
const OWNER_A = 'user-owner@gmail.com'
/** Membre du bureau de Marketing Pro. */
const BOARD_B = 'user-admin@gmail.com'

const PAGE_ROUTE = '/bureau/invitations'
const NEW_ROUTE = '/bureau/proprietaires/nouveau'
const CAP_KEY = 'campaign.daily_send_cap'
const LAUNCH_KIND = 'member_invitation_launch'
const REMINDER_KIND = 'member_invitation_reminder'
const INVITATION_SUBJECT = 'Votre espace membre vous attend'

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
const MARKER = `s42b-${RUN}`
const nameOf = (label: string) => `${label} ${MARKER}`
const emailOf = (label: string) => `${label}-${RUN}@example.test`

test.use({locale: 'fr-FR'})
test.describe.configure({mode: 'serial'})

type Key = 'a' | 'b'

const TENANTS = {
  a: {base: TENANT_A, slug: TENANT_A_SLUG, bureau: OWNER_A},
  b: {base: TENANT_B, slug: TENANT_B_SLUG, bureau: BOARD_B},
} as const

/** Les adresses d'une association, toutes propres à elle (m4). */
const addressesOf = (key: Key) => ({
  holder: emailOf(`titulaire-${key}`),
  close: emailOf(`proche-${key}`),
  shared: emailOf(`partagee-${key}`),
  added: emailOf(`ajoutee-${key}`),
})

type Prepared = {familyId: string; launchId: string; holderLink: string}
const prepared: Record<Key, Prepared | undefined> = {a: undefined, b: undefined}
let capturedLaunch:
  {nextAction: string; contentType: string; body: Buffer} | undefined

const passwordSession = async (
  browser: Browser,
  base: string,
  email: string
) => {
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

/** Une adresse IP par contexte : Better Auth limite `/magic-link/verify` par IP. */
let nextClientIp = 0
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

/** Crée une fiche à l'écran, son compte compris ; rend son identifiant. */
const createProfile = async (
  page: Page,
  base: string,
  input: {name: string; email?: string}
): Promise<string> => {
  await page.goto(`${base}${NEW_ROUTE}`, {waitUntil: 'networkidle'})
  await expect(
    page.getByRole('heading', {level: 1, name: 'Ajouter un propriétaire'})
  ).toBeVisible({timeout: 15_000})
  await page.getByLabel('Nom', {exact: true}).fill(input.name)
  if (input.email) await page.getByLabel(/^Adresse email/).fill(input.email)
  const home = page.getByRole('group', {name: /Adresse de domicile/})
  await home.getByLabel('Adresse', {exact: true}).fill('5 allée des Pins')
  await home.getByLabel('Code postal').fill('33680')
  await home.getByLabel('Commune').fill('Lacanau')
  await page.getByRole('button', {name: 'Enregistrer le propriétaire'}).click()
  await expect(
    page.getByRole('heading', {level: 1, name: input.name})
  ).toBeVisible({timeout: 15_000})
  return new URL(page.url()).pathname.split('/').at(-1) as string
}

/**
 * Deux fiches de remplissage, triées en tête : elles occupent la première
 * part (plafond 2), et les fiches de l'essai partent dans une part suivante.
 * Sans compte, leur ligne passe en échec seule (ADR 072 §4).
 */
const insertFillers = (slug: string, key: Key) =>
  inTenant(slug, async (client, organizationId) => {
    for (const index of [1, 2]) {
      const profile = await client.query<{id: string}>(
        `insert into member_profile (organization_id, name)
         values ($1, $2) returning id`,
        [organizationId, nameOf(`Aaa Remplissage ${index} ${key}`)]
      )
      await client.query(
        `insert into member_profile_email
           (organization_id, member_profile_id, email, role, status, origin)
         values ($1, $2, $3, 'holder', 'active', 'site')`,
        [
          organizationId,
          profile.rows[0].id,
          emailOf(`remplissage-${index}-${key}`),
        ]
      )
    }
  })

type Saved = {cap: string | null; reportable: number | null}
const saved: Record<Key, Saved> = {
  a: {cap: null, reportable: null},
  b: {cap: null, reportable: null},
}

/** Plafond abaissé à 2 et budget du jour remis à zéro, valeurs gardées. */
const lowerCapAndResetBudget = (key: Key) =>
  inTenant(TENANTS[key].slug, async (client, organizationId) => {
    const cap = await client.query<{value: string}>(
      `select value from organization_setting where organization_id = $1 and key = $2`,
      [organizationId, CAP_KEY]
    )
    const budget = await client.query<{reportable_count: number}>(
      `select reportable_count from email_send_budget
        where organization_id = $1 and day = ${PARIS_DAY_SQL}`,
      [organizationId]
    )
    saved[key] = {
      cap: cap.rows[0]?.value ?? null,
      reportable: budget.rows[0]?.reportable_count ?? null,
    }
    await client.query(
      `insert into organization_setting (organization_id, key, value)
       values ($1, $2, '2')
       on conflict (organization_id, key) do update set value = '2'`,
      [organizationId, CAP_KEY]
    )
    await client.query(
      `update email_send_budget set reportable_count = 0
        where organization_id = $1 and day = ${PARIS_DAY_SQL}`,
      [organizationId]
    )
  })

const restoreCapAndBudget = (key: Key) =>
  inTenant(TENANTS[key].slug, async (client, organizationId) => {
    const {cap, reportable} = saved[key]
    if (cap === null) {
      await client.query(
        `delete from organization_setting where organization_id = $1 and key = $2`,
        [organizationId, CAP_KEY]
      )
    } else {
      await client.query(
        `update organization_setting set value = $3
          where organization_id = $1 and key = $2`,
        [organizationId, CAP_KEY, cap]
      )
    }
    if (reportable === null) {
      await client.query(
        `delete from email_send_budget where organization_id = $1 and day = ${PARIS_DAY_SQL}`,
        [organizationId]
      )
    } else {
      await client.query(
        `update email_send_budget set reportable_count = $2
          where organization_id = $1 and day = ${PARIS_DAY_SQL}`,
        [organizationId, reportable]
      )
    }
  })

/** La relance des impayés du seed ne doit pas consommer le plafond de l'essai. */
const dropUnpaidReminderJobs = async () => {
  const a = await tenantIdOf(TENANT_A_SLUG)
  await asMaintenance((client) =>
    client.query(
      `delete from scheduled_job
        where organization_id = $1 and kind = 'billing.unpaid_reminders'`,
      [a]
    )
  )
}

const campaignIdsOf = (slug: string, kind: string) =>
  inTenant(slug, async (client) => {
    const result = await client.query<{id: string}>(
      `select id from campaign where template_id = $1 order by created_at`,
      [kind]
    )
    return result.rows.map((row) => row.id)
  })

const campaignStatusOf = (slug: string, campaignId: string) =>
  inTenant(slug, async (client) => {
    const result = await client.query<{status: string}>(
      `select status from campaign where id = $1`,
      [campaignId]
    )
    return result.rows[0]?.status
  })

/**
 * Rend dues les parts encore ouvertes, comme un passage de minuit, puis lance
 * le vrai planificateur, jusqu'à la fin de la campagne.
 */
const deliverAll = async (slug: string, campaignId: string) => {
  for (let pass = 0; pass < 20; pass += 1) {
    if ((await campaignStatusOf(slug, campaignId)) !== 'sending') return
    await inTenant(slug, (client) =>
      client.query(
        `update scheduled_job sj
            set run_after = now() - interval '1 minute', locked_at = null,
                completed_at = null
           from campaign_part cp
          where sj.kind = 'campaign.deliver_part'
            and sj.idempotency_key = cp.id::text
            and cp.campaign_id = $1
            and cp.status not in ('sent', 'failed')`,
        [campaignId]
      )
    )
    await dropUnpaidReminderJobs()
    runSchedulerProcess()
  }
  expect(await campaignStatusOf(slug, campaignId)).not.toBe('sending')
}

/** Le numéro de la part qui porte cette adresse. */
const partNumberOf = (slug: string, campaignId: string, email: string) =>
  inTenant(slug, async (client) => {
    const result = await client.query<{number: number}>(
      `select cp.number from campaign_recipient r
         join campaign_part cp on cp.id = r.part_id
        where r.campaign_id = $1 and lower(r.email) = lower($2)`,
      [campaignId, email]
    )
    return result.rows[0]?.number
  })

const firstSignedInOf = (slug: string, email: string) =>
  inTenant(slug, async (client) => {
    const result = await client.query<{first_signed_in_at: Date | null}>(
      `select s.first_signed_in_at from member_invitation_state s
         join "user" u on u.id = s.user_id
        where lower(u.email) = lower($1)`,
      [email]
    )
    return result.rows[0]?.first_signed_in_at ?? null
  })

/** L'unique invitation reçue par l'adresse depuis `before`. */
const invitationTo = async (before: Set<string>, to: string) => {
  await expect
    .poll(() => newMessagesTo(before, to).length, {timeout: 15_000})
    .toBe(1)
  const [message] = newMessagesTo(before, to)
  expect(message.subject ?? '').toContain(INVITATION_SUBJECT)
  return message
}

const launchCard = (page: Page) =>
  page
    .getByRole('heading', {level: 2, name: 'Lancement'})
    .locator('xpath=ancestor::*[@data-slot="card"][1]')

const reminderCard = (page: Page) =>
  page
    .getByRole('heading', {level: 2, name: 'Relancer les jamais connectés'})
    .locator('xpath=ancestor::*[@data-slot="card"][1]')

/** Le texte de toutes les pages de « Adresses jamais connectées ». */
const neverSignedInText = async (page: Page, base: string) => {
  let text = ''
  for (let number = 1; number <= 30; number += 1) {
    await page.goto(`${base}${PAGE_ROUTE}?page=${number}`, {
      waitUntil: 'networkidle',
    })
    const card = page
      .getByRole('heading', {level: 2, name: 'Adresses jamais connectées'})
      .locator('xpath=ancestor::*[@data-slot="card"][1]')
    text += (await card.textContent()) ?? ''
    const pagination = card.getByRole('navigation')
    const position =
      (await pagination.count()) > 0 ? await pagination.textContent() : null
    const total = Number(position?.match(/Page \d+ sur (\d+)/)?.[1] ?? 1)
    if (number >= total) break
  }
  return text
}

const pdfTextOf = async (pdf: Buffer): Promise<string> => {
  const document = await getDocument({data: new Uint8Array(pdf)}).promise
  let text = ''
  for (let number = 1; number <= document.numPages; number += 1) {
    const content = await (await document.getPage(number)).getTextContent()
    text += content.items
      .flatMap((item) =>
        'str' in item && item.str.trim() !== '' ? [item.str] : []
      )
      .join(' ')
  }
  return text
}

const cleanUp = () =>
  asMaintenance(async (client) => {
    const organizations = await client.query<{id: string}>(
      `select id from organization where slug = any($1)`,
      [[TENANT_A_SLUG, TENANT_B_SLUG]]
    )
    const ids = organizations.rows.map((row) => row.id)
    const campaigns = await client.query<{id: string}>(
      `select id from campaign
        where organization_id = any($1) and template_id = any($2)`,
      [ids, [LAUNCH_KIND, REMINDER_KIND]]
    )
    const campaignIds = campaigns.rows.map((row) => row.id)
    await client.query(
      `delete from scheduled_job
        where kind = 'campaign.deliver_part' and payload->>'campaignId' = any($1)`,
      [campaignIds]
    )
    await client.query(`delete from campaign where id = any($1)`, [campaignIds])
    await client.query(
      `delete from member_invitation_state
        where user_id in (select id from "user" where email like $1)`,
      [`%-${RUN}@example.test`]
    )
    await client.query(`delete from member_profile where name like $1`, [
      `% ${MARKER}`,
    ])
    await client.query(`delete from "user" where email like $1`, [
      `%-${RUN}@example.test`,
    ])
  })

test.describe('Lancement des invitations — s42b', () => {
  test.beforeAll(async () => {
    await cleanUp()
    await lowerCapAndResetBudget('a')
    await lowerCapAndResetBudget('b')
    await asMaintenance((client) =>
      client.query(
        `delete from rate_limit_event
          where organization_id in (select id from organization where slug = any($1))`,
        [[TENANT_A_SLUG, TENANT_B_SLUG]]
      )
    )
  })

  test.afterAll(async () => {
    await cleanUp()
    await restoreCapAndBudget('a')
    await restoreCapAndBudget('b')
  })

  const launchOn = (key: Key) =>
    test(`critères 1, 6, 9 et 10 — association ${key.toUpperCase()} : une part reportée part par le planificateur, son lien ouvre la session sur son domaine`, async ({
      browser,
    }) => {
      test.setTimeout(360_000)
      const {base, slug, bureau: bureauEmail} = TENANTS[key]
      const emails = addressesOf(key)

      const bureau = await passwordSession(browser, base, bureauEmail)
      const member = await freshPage(browser)
      try {
        await insertFillers(slug, key)
        const familyId = await createProfile(bureau, base, {
          name: nameOf(`Zz Famille ${key}`),
          email: emails.holder,
        })
        await addProfileEmail(bureau, emails.close)
        await createProfile(bureau, base, {
          name: nameOf(`Zz Voisin ${key}`),
          email: emails.shared,
        })
        await createProfile(bureau, base, {
          name: nameOf(`Zz Voisin bis ${key}`),
        })
        // Fiche sans adresse : la fenêtre ne propose aucun rôle, l'adresse
        // partagée y devient titulaire d'office (règle de la première adresse).
        await addProfileEmail(bureau, emails.shared, {role: 'additional'})
        await createProfile(bureau, base, {name: nameOf(`Zz Courrier ${key}`)})

        await bureau.goto(`${base}${PAGE_ROUTE}`, {waitUntil: 'networkidle'})
        const card = launchCard(bureau)
        await card.getByRole('button', {name: 'Lancer les invitations'}).click()
        const dialog = bureau.getByRole('alertdialog')
        await expect(dialog).toContainText('Le lancement part en')
        const before = outboxFiles()
        const request = bureau.waitForRequest(
          (candidate) =>
            candidate.method() === 'POST' &&
            Boolean(candidate.headers()['next-action'])
        )
        await dialog.getByRole('button', {name: 'Envoyer le lancement'}).click()
        const sent = await request
        if (key === 'a') {
          capturedLaunch = {
            nextAction: sent.headers()['next-action'],
            contentType: sent.headers()['content-type'] ?? '',
            body: sent.postDataBuffer() ?? Buffer.alloc(0),
          }
        }
        await expect(card.getByRole('status')).toContainText(
          'Lancement parti.',
          {timeout: 15_000}
        )

        const [launchId] = await campaignIdsOf(slug, LAUNCH_KIND)
        expect(launchId, 'le lancement est créé').toBeTruthy()
        expect(
          await partNumberOf(slug, launchId, emails.holder),
          'l’adresse de l’essai part dans une part du lendemain'
        ).toBeGreaterThan(1)

        await deliverAll(slug, launchId)

        // C6 : deux adresses, deux liens distincts ; une adresse sur deux
        // fiches, un seul email.
        const holderLink = loginLinkOf(
          await invitationTo(before, emails.holder)
        )
        const closeLink = loginLinkOf(await invitationTo(before, emails.close))
        expect(holderLink).not.toBe(closeLink)
        await invitationTo(before, emails.shared)

        // C10 : le lien d'une part reportée, émis hors requête, ouvre la
        // session sur le domaine de l'association.
        expect(new URL(holderLink).origin).toBe(base)
        await member.goto(holderLink)
        await expect(member).toHaveURL(`${base}/dashboard`, {timeout: 15_000})
        expect(await firstSignedInOf(slug, emails.holder)).toBeTruthy()

        // C7 : le suivi par adresse.
        const listed = await neverSignedInText(bureau, base)
        expect(listed).not.toContain(emails.holder)
        expect(listed).toContain(emails.close)
        expect(listed).toContain(emails.shared)
        expect(listed).toContain('Même adresse sur 2 fiches : un seul état')

        prepared[key] = {familyId, launchId, holderLink}
      } finally {
        await bureau.close()
        await member.close()
      }
    })

  launchOn('a')

  test('critères 2 et 5 — le courrier du lancement compte la fiche sans email et ne porte aucun lien de connexion', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const launch = prepared.a
    expect(launch, 'le lancement de A est parti').toBeTruthy()
    if (!launch) return

    const bureau = await passwordSession(browser, TENANT_A, OWNER_A)
    try {
      await bureau.goto(`${TENANT_A}/bureau/campagnes/${launch.launchId}`, {
        waitUntil: 'networkidle',
      })
      const card = bureau
        .getByRole('heading', {level: 2, name: 'Courrier postal'})
        .locator('xpath=ancestor::*[@data-slot="card"][1]')
      await expect(card).toContainText(
        'il annonce le site, sans lien de connexion',
        {timeout: 15_000}
      )
      const perLand = card.getByLabel('Une lettre par terrain')
      if (await perLand.count()) await perLand.check()
      const [download] = await Promise.all([
        bureau.waitForEvent('download', {timeout: 30_000}),
        card
          .getByRole('button', {name: 'Télécharger le PDF du courrier'})
          .click(),
      ])
      const pdf = fs.readFileSync(await download.path())
      const text = await pdfTextOf(pdf)

      expect(text).toContain(nameOf('Zz Courrier a'))
      expect(text).toContain('Adresse du site :')
      expect(text).not.toContain('/login')
      expect(text).not.toContain('magic-link')
      expect(text).not.toContain('Ouvrir mon espace')
    } finally {
      await bureau.close()
    }
  })

  test('Q7 — un second lancement est refusé : plus de bouton, l’appel direct ne fait rien repartir', async ({
    browser,
  }) => {
    const launch = prepared.a
    expect(launch && capturedLaunch, 'le lancement de A est parti').toBeTruthy()
    if (!launch || !capturedLaunch) return

    const before = outboxFiles()
    const bureau = await passwordSession(browser, TENANT_A, OWNER_A)
    try {
      await bureau.goto(`${TENANT_A}${PAGE_ROUTE}`, {waitUntil: 'networkidle'})
      await expect(launchCard(bureau).getByText(/^Lancement — /)).toBeVisible({
        timeout: 15_000,
      })
      await expect(
        bureau.getByRole('button', {name: 'Lancer les invitations'})
      ).toHaveCount(0)

      const replay = await bureau.request.post(`${TENANT_A}${PAGE_ROUTE}`, {
        headers: {
          'next-action': capturedLaunch.nextAction,
          'content-type': capturedLaunch.contentType,
          accept: 'text/x-component',
          origin: TENANT_A,
        },
        data: capturedLaunch.body,
      })
      expect(replay.status()).toBeLessThan(500)
      await bureau.waitForTimeout(3_000)

      expect(await campaignIdsOf(TENANT_A_SLUG, LAUNCH_KIND)).toEqual([
        launch.launchId,
      ])
      expect(newMessagesTo(before, addressesOf('a').close)).toHaveLength(0)
    } finally {
      await bureau.close()
    }
  })

  test('isolation — le bureau de A n’atteint pas la page de B et n’y lance rien par l’appel direct de l’action', async ({
    browser,
  }) => {
    expect(capturedLaunch, 'l’action de A est capturée').toBeTruthy()
    if (!capturedLaunch) return

    const bureau = await passwordSession(browser, TENANT_A, OWNER_A)
    try {
      await bureau.goto(`${TENANT_B}${PAGE_ROUTE}`, {waitUntil: 'networkidle'})
      await expect(
        bureau.getByRole('heading', {level: 1, name: 'Invitations des membres'})
      ).toHaveCount(0)

      const replay = await bureau.request.post(`${TENANT_B}${PAGE_ROUTE}`, {
        headers: {
          'next-action': capturedLaunch.nextAction,
          'content-type': capturedLaunch.contentType,
          accept: 'text/x-component',
          origin: TENANT_B,
        },
        data: capturedLaunch.body,
      })
      expect(replay.status()).toBeLessThan(500)
      await bureau.waitForTimeout(3_000)

      expect(await campaignIdsOf(TENANT_B_SLUG, LAUNCH_KIND)).toEqual([])
    } finally {
      await bureau.close()
    }
  })

  launchOn('b')

  const remindOn = (key: Key, nature: 'statutaire' | 'facultative') =>
    test(`critères 3 et 8 — association ${key.toUpperCase()} (${nature}) : la relance atteint l’adresse ajoutée, jamais l’adresse connectée ; le désinscrit ${nature === 'statutaire' ? 'la reçoit' : 'ne la reçoit pas'}`, async ({
      browser,
    }) => {
      test.setTimeout(360_000)
      const {base, slug, bureau: bureauEmail} = TENANTS[key]
      const emails = addressesOf(key)
      const launch = prepared[key]
      expect(launch, 'le lancement est parti').toBeTruthy()
      if (!launch) return

      const bureau = await passwordSession(browser, base, bureauEmail)
      const visitor = await freshPage(browser)
      try {
        // Le proche se désinscrit depuis l'email de lancement.
        const launchMail = newMessagesTo(new Set(), emails.close).find((m) =>
          (m.subject ?? '').includes(INVITATION_SUBJECT)
        )
        expect(launchMail, 'le proche a reçu le lancement').toBeTruthy()
        if (!launchMail) return
        await visitor.goto(
          `${base}/desinscription/${unsubscribeTokenOf(launchMail)}`,
          {waitUntil: 'networkidle'}
        )
        await visitor.getByRole('button', {name: 'Me désinscrire'}).click()
        await expect(visitor.getByText(/C’est enregistré/)).toBeVisible({
          timeout: 15_000,
        })

        // Une adresse ajoutée après le lancement.
        await bureau.goto(`${base}/bureau/proprietaires/${launch.familyId}`, {
          waitUntil: 'networkidle',
        })
        await addProfileEmail(bureau, emails.added)

        await bureau.goto(`${base}${PAGE_ROUTE}`, {waitUntil: 'networkidle'})
        const card = reminderCard(bureau)
        await card
          .getByRole('button', {name: 'Relancer les jamais connectés'})
          .click()
        const before = outboxFiles()
        await bureau
          .getByRole('alertdialog')
          .getByRole('button', {name: 'Envoyer la relance'})
          .click()
        await expect(card.getByRole('status')).toContainText(
          'Relance partie.',
          {timeout: 15_000}
        )

        const [reminderId] = await campaignIdsOf(slug, REMINDER_KIND)
        expect(reminderId, 'la relance est créée').toBeTruthy()
        await deliverAll(slug, reminderId)

        await invitationTo(before, emails.added)
        expect(newMessagesTo(before, emails.holder)).toHaveLength(0)
        expect(newMessagesTo(before, emails.close)).toHaveLength(
          nature === 'statutaire' ? 1 : 0
        )
      } finally {
        await bureau.close()
        await visitor.close()
      }
    })

  remindOn('a', 'statutaire')
  remindOn('b', 'facultative')
})
