/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import path from 'node:path'

import {Browser, expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Agir à la place d'un compte — s48, critères 1 à 7 (ADR 041, ADR 042).
 *
 * Ce que seuls un navigateur, deux domaines et une vraie base prouvent : le
 * SuperAdmin ouvre une session à la place d'un membre depuis l'écran des
 * membres, voit la barre sur le site public, l'espace membre et le bureau, et
 * en sort vers l'écran des membres ; chaque ouverture et chaque sortie sont
 * tracées dans `impersonation_event`, isolée par la RLS ; un compte `user`,
 * Bureau compris, est refusé par la Server Action **et** par la route HTTP du
 * plugin (404) ; une écriture faite à la place d'un compte est attribuée au
 * SuperAdmin, pour le compte du compte vu ; le mot de passe est verrouillé.
 *
 * `localhost` sert TechCorp Solutions, `127.0.0.1` Marketing Pro (seed). La
 * suite e2e tourne sur un seul worker en CI. Jamais lancée en local.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
/** TechCorp Solutions dans le seed. */
const TENANT_A = `http://localhost:${PORT}`
const TENANT_A_SLUG = 'techcorp-solutions'
const TENANT_B_SLUG = 'marketing-pro'

const PASSWORD = 'Azerty123'
const SUPER_ADMIN = 'superadmin@gmail.com'
/** Président(e) de TechCorp Solutions. */
const OWNER_A = {email: 'user-owner@gmail.com', name: 'Julien'}
/** Membre simple de TechCorp Solutions. */
const MEMBER_A = {email: 'moderator-member@gmail.com', name: 'Julie'}

const BAR_EXIT = 'Revenir à mon compte'
const RETURNED = 'Vous êtes revenu à votre compte SuperAdmin.'

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
const RUN_STARTED_AT = new Date()
const markerOf = (label: string) => `${label} s48-${RUN}`

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

const inTransaction = async <T>(
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

/** Sous le scope d'une association, comme le produit. */
const inTenant = async <T>(
  slug: string,
  callback: (client: Client) => Promise<T>
) => {
  const organizationId = await tenantIdOf(slug)
  return inTransaction(['app.organization_id', organizationId], callback)
}

/** Remise en état hors scope : le seul `bypass` de la spec. */
const asMaintenance = <T>(callback: (client: Client) => Promise<T>) =>
  inTransaction(['app.bypass_rls', 'on'], callback)

const userOf = (email: string) =>
  withClient(async (client) => {
    const result = await client.query<{id: string; name: string}>(
      `select id, name from "user" where lower(email) = lower($1)`,
      [email]
    )
    expect(result.rows[0], `un compte doit exister pour ${email}`).toBeTruthy()
    return result.rows[0]
  })

type ImpersonationEvent = {
  kind: string
  admin_user_id: string | null
  admin_name: string | null
  target_user_id: string | null
  target_name: string | null
  session_id: string | null
  reason: string | null
}

/** La trace des sessions à la place d'un compte, depuis le début du run. */
const impersonationEventsOf = (slug: string, targetUserId: string) =>
  inTenant(slug, async (client) => {
    const result = await client.query<ImpersonationEvent>(
      `select kind, admin_user_id, admin_name, target_user_id, target_name,
              session_id, reason
         from impersonation_event
        where target_user_id = $1 and created_at >= $2
        order by created_at, kind desc`,
      [targetUserId, RUN_STARTED_AT]
    )
    return result.rows
  })

/** Sessions à la place d'un compte ouvertes depuis le début du run. */
const impersonatedSessionsSince = () =>
  withClient(async (client) => {
    const result = await client.query<{total: string}>(
      `select count(*) as total from session
        where impersonated_by is not null and created_at >= $1`,
      [RUN_STARTED_AT]
    )
    return Number(result.rows[0].total)
  })

const cleanUpRun = () =>
  asMaintenance(async (client) => {
    await client.query(
      `delete from impersonation_event where created_at >= $1`,
      [RUN_STARTED_AT]
    )
    await client.query(
      `delete from incident_report_event
        where report_id in (select id from incident_report where location like $1)`,
      [`% s48-${RUN}`]
    )
    await client.query(`delete from incident_report where location like $1`, [
      `% s48-${RUN}`,
    ])
    await client.query(
      `delete from session where impersonated_by is not null and created_at >= $1`,
      [RUN_STARTED_AT]
    )
  })

/** Connexion par `/login/prestataire` (mot de passe), comme le SuperAdmin. */
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

const membersScreenOf = async (page: Page, organizationId: string) => {
  await page.goto(`${TENANT_A}/admin/organizations/${organizationId}/edit`, {
    waitUntil: 'networkidle',
  })
  await expect(page.getByRole('table')).toBeVisible({timeout: 15_000})
}

const rowOf = (page: Page, email: string) =>
  page.getByRole('row').filter({hasText: email})

/** « Agir à sa place » sur la ligne du compte, puis la confirmation. */
const actAs = async (
  page: Page,
  account: {email: string; name: string},
  reason?: string
) => {
  await rowOf(page, account.email)
    .getByRole('button', {name: 'Agir à sa place'})
    .click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  if (reason) await dialog.getByLabel(/Motif/).fill(reason)
  await dialog
    .getByRole('button', {name: `Agir à la place de ${account.name}`})
    .click()
}

const bar = (page: Page) => page.locator('[data-slot="impersonation-bar"]')

test.describe('Agir à la place d’un compte — s48', () => {
  test.afterAll(async () => {
    await cleanUpRun()
  })

  test('critères 1, 2 et 5 — ouverture depuis l’écran des membres, barre partout, sortie vers l’écran des membres, deux traces', async ({
    browser,
  }) => {
    test.setTimeout(180_000)
    const organizationId = await tenantIdOf(TENANT_A_SLUG)
    const admin = await userOf(SUPER_ADMIN)
    const member = await userOf(MEMBER_A.email)
    const reason = markerOf('Support')

    const page = await passwordSession(browser, TENANT_A, SUPER_ADMIN)
    try {
      await membersScreenOf(page, organizationId)
      await actAs(page, MEMBER_A, reason)

      await expect(page).toHaveURL(`${TENANT_A}/dashboard`, {timeout: 15_000})
      await expect(bar(page)).toContainText(
        `Vous agissez à la place de ${MEMBER_A.name}`
      )
      await expect(
        bar(page).getByRole('button', {name: BAR_EXIT})
      ).toBeVisible()

      // Site public : la barre est là aussi.
      await page.goto(`${TENANT_A}/`, {waitUntil: 'networkidle'})
      await expect(bar(page)).toContainText(
        `Vous agissez à la place de ${MEMBER_A.name}`
      )

      // Critère 7 : le mot de passe est verrouillé sur /account.
      await page.goto(`${TENANT_A}/account`, {waitUntil: 'networkidle'})
      await expect(
        page
          .getByText(
            `Indisponible pendant que vous agissez à la place de ${MEMBER_A.name}.`,
            {exact: false}
          )
          .first()
      ).toBeVisible({timeout: 15_000})
      await expect(page.locator('input[type="password"]')).toHaveCount(0)

      await bar(page).getByRole('button', {name: BAR_EXIT}).click()
      await expect(page).toHaveURL(
        `${TENANT_A}/admin/organizations/${organizationId}/edit?retour=1`,
        {timeout: 15_000}
      )
      await expect(
        page.getByRole('status').filter({hasText: RETURNED})
      ).toBeVisible()
      await expect(bar(page)).toHaveCount(0)

      const events = await impersonationEventsOf(TENANT_A_SLUG, member.id)
      expect(events.map((event) => event.kind)).toEqual(['opened', 'closed'])
      for (const event of events) {
        expect(event).toMatchObject({
          admin_user_id: admin.id,
          admin_name: admin.name,
          target_user_id: member.id,
          target_name: member.name,
        })
      }
      expect(events[0].reason).toBe(reason)
      expect(events[1].reason).toBeNull()
      expect(events[0].session_id).toBeTruthy()
      expect(events[1].session_id).toBe(events[0].session_id)
    } finally {
      await page.context().close()
    }
  })

  test('critère 6 — un changement de statut fait à la place du bureau est attribué au SuperAdmin, pour le compte du compte vu', async ({
    browser,
  }) => {
    test.setTimeout(180_000)
    const organizationId = await tenantIdOf(TENANT_A_SLUG)
    const admin = await userOf(SUPER_ADMIN)
    const owner = await userOf(OWNER_A.email)
    const location = markerOf('Statut en imitation')

    const reportId = await inTenant(TENANT_A_SLUG, async (client) => {
      const category = await client.query<{id: string}>(
        `select id from association_category
          where name = 'Fuite d''eau' and deleted_at is null`
      )
      const report = await client.query<{id: string}>(
        `insert into incident_report
           (organization_id, category_id, location, description)
         values ($1, $2, $3, 'Fuite') returning id`,
        [organizationId, category.rows[0]?.id ?? null, location]
      )
      await client.query(
        `insert into incident_report_event (organization_id, report_id, status)
         values ($1, $2, 'reported')`,
        [organizationId, report.rows[0].id]
      )
      return report.rows[0].id
    })

    const page = await passwordSession(browser, TENANT_A, SUPER_ADMIN)
    try {
      await membersScreenOf(page, organizationId)
      await actAs(page, OWNER_A)
      await expect(page).toHaveURL(`${TENANT_A}/bureau/pages`, {
        timeout: 15_000,
      })
      await expect(bar(page)).toContainText(
        `Vous agissez à la place de ${OWNER_A.name}`
      )

      await page.goto(`${TENANT_A}/bureau/signalements/${reportId}`, {
        waitUntil: 'networkidle',
      })
      await expect(bar(page)).toBeVisible()
      await page.getByRole('button', {name: 'Passer en cours'}).click()
      await expect(
        page
          .getByRole('status')
          .filter({hasText: 'Signalement passé en cours.'})
      ).toBeVisible({timeout: 15_000})

      const event = await inTenant(TENANT_A_SLUG, async (client) => {
        const result = await client.query<{
          author_user_id: string | null
          author_name: string | null
          on_behalf_of_user_id: string | null
          on_behalf_of_name: string | null
        }>(
          `select author_user_id, author_name, on_behalf_of_user_id,
                  on_behalf_of_name
             from incident_report_event
            where report_id = $1 and status = 'in_progress'`,
          [reportId]
        )
        return result.rows[0]
      })
      expect(event).toEqual({
        author_user_id: admin.id,
        author_name: admin.name,
        on_behalf_of_user_id: owner.id,
        on_behalf_of_name: owner.name,
      })

      await bar(page).getByRole('button', {name: BAR_EXIT}).click()
      await expect(page).toHaveURL(/\?retour=1$/, {timeout: 15_000})
    } finally {
      await page.context().close()
    }
  })

  test('critère 3 — un compte user, Bureau compris, est refusé par la Server Action et par la route HTTP du plugin', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const organizationId = await tenantIdOf(TENANT_A_SLUG)
    const member = await userOf(MEMBER_A.email)
    const before = await impersonatedSessionsSince()
    const eventsBefore = (await impersonationEventsOf(TENANT_A_SLUG, member.id))
      .length

    const superAdmin = await passwordSession(browser, TENANT_A, SUPER_ADMIN)
    const board = await passwordSession(browser, TENANT_A, OWNER_A.email)
    try {
      // La requête de la Server Action est capturée chez le SuperAdmin, sans
      // partir, puis rejouée telle quelle avec la session du bureau.
      await membersScreenOf(superAdmin, organizationId)
      const captured = new Promise<{
        url: string
        headers: Record<string, string>
        body: string
      }>((resolve) => {
        void superAdmin.route('**/admin/organizations/**', async (route) => {
          const request = route.request()
          if (
            request.method() !== 'POST' ||
            !request.headers()['next-action']
          ) {
            await route.continue()
            return
          }
          resolve({
            url: request.url(),
            headers: request.headers(),
            body: request.postData() ?? '',
          })
          await route.abort()
        })
      })
      await actAs(superAdmin, MEMBER_A)
      const action = await captured

      const replayed = await board.request.post(action.url, {
        headers: {
          'next-action': action.headers['next-action'],
          'content-type': action.headers['content-type'] ?? 'text/plain',
          accept: 'text/x-component',
          origin: TENANT_A,
        },
        data: action.body,
      })
      expect(replayed.ok()).toBe(true)
      expect(await impersonatedSessionsSince()).toBe(before)
      expect(
        await impersonationEventsOf(TENANT_A_SLUG, member.id)
      ).toHaveLength(eventsBefore)

      for (const page of [board, superAdmin]) {
        for (const route of [
          '/api/auth/admin/impersonate-user',
          '/api/auth/admin/stop-impersonating',
        ]) {
          const response = await page.request.post(`${TENANT_A}${route}`, {
            headers: {origin: TENANT_A},
            data: {userId: member.id},
          })
          expect(response.status(), route).toBe(404)
        }
      }
      expect(await impersonatedSessionsSince()).toBe(before)
    } finally {
      await superAdmin.context().close()
      await board.context().close()
    }
  })

  test('critère 5 — la RLS refuse de lire et d’écrire la trace depuis le scope de l’autre association', async () => {
    const tenantA = await tenantIdOf(TENANT_A_SLUG)
    const marker = markerOf('Trace RLS')

    const insertedId = await inTenant(TENANT_A_SLUG, async (client) => {
      const result = await client.query<{id: string}>(
        `insert into impersonation_event
           (organization_id, kind, admin_name, target_name)
         values ($1, 'opened', 'Zourite Studio', $2)
         returning id`,
        [tenantA, marker]
      )
      return result.rows[0].id
    })

    const seenFromA = await inTenant(TENANT_A_SLUG, (client) =>
      client.query(`select id from impersonation_event where id = $1`, [
        insertedId,
      ])
    )
    expect(seenFromA.rowCount, 'la trace existe chez TechCorp').toBe(1)

    const seenFromB = await inTenant(TENANT_B_SLUG, async (client) => ({
      byId: await client.query(
        `select id from impersonation_event where id = $1`,
        [insertedId]
      ),
      ofA: await client.query(
        `select id from impersonation_event where organization_id = $1`,
        [tenantA]
      ),
    }))
    expect(seenFromB.byId.rowCount, 'un oubli de scope ne fuite pas').toBe(0)
    expect(seenFromB.ofA.rowCount).toBe(0)

    const withoutScope = await withClient((client) =>
      client.query(`select id from impersonation_event where id = $1`, [
        insertedId,
      ])
    )
    expect(withoutScope.rowCount).toBe(0)

    // Écrire chez l'autre association depuis son propre scope est refusé.
    await expect(
      inTenant(TENANT_B_SLUG, (client) =>
        client.query(
          `insert into impersonation_event
             (organization_id, kind, admin_name, target_name)
           values ($1, 'opened', 'Zourite Studio', $2)`,
          [tenantA, marker]
        )
      )
    ).rejects.toThrow(/row-level security/i)
  })
})
