/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {Browser, expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

import {addProfileEmail, emailsCard} from './support/member-email-card'

/**
 * Invitation individuelle — s42a (ADR 071).
 *
 * Ce que seuls un navigateur, deux domaines et une vraie base prouvent : le
 * bureau invite une fiche à deux adresses, deux emails partent (transport
 * `file`) avec deux liens distincts, chaque lien ouvre la session **sur le
 * domaine de son association** ; la fiche dit « Connectée le » et « Invitée
 * le » ; réinviter rend l'ancien lien inopérant (page du lien invalide,
 * variante invitation) ; une fiche « courrier uniquement » n'a pas de bouton ;
 * le bureau de A n'invite aucune fiche de B, même par l'appel direct de
 * l'action ; une session ouverte à la place du membre (s48) ne compte pas ; la
 * RLS forcée isole `member_invitation_state`.
 *
 * L'invitation reportée puis rejouée hors requête n'est pas jouée ici : la
 * spec du budget (s52) ne déclenche pas le planificateur. La preuve hors
 * requête est celle des tests unitaires (vrai Better Auth, rejeu du report).
 *
 * `localhost` sert TechCorp Solutions, `127.0.0.1` Marketing Pro (seed). Les
 * écritures portent un marqueur d'essai, nettoyé à la fin, comptes compris.
 * Jamais lancée en local : CI seulement.
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
/** Membre du bureau (rôle `board`) de Marketing Pro. */
const BOARD_B = 'user-admin@gmail.com'

const NEW_ROUTE = '/bureau/proprietaires/nouveau'
const INVITATION_SUBJECT = 'Votre espace membre vous attend'
const INVALID_INVITATION =
  "Un lien d'invitation ne sert qu'une fois et reste valable"

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
const nameOf = (label: string) => `${label} s42a-${RUN}`
const emailOf = (label: string) => `${label}-${RUN}@example.test`

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
  callback: (client: Client, organizationId: string) => Promise<T>
) => {
  const organizationId = await tenantIdOf(slug)
  return inTransaction(['app.organization_id', organizationId], (client) =>
    callback(client, organizationId)
  )
}

/** Nettoyage hors scope : le seul `bypass` de la spec. */
const asMaintenance = <T>(callback: (client: Client) => Promise<T>) =>
  inTransaction(['app.bypass_rls', 'on'], callback)

const userIdOf = (email: string) =>
  withClient(async (client) => {
    const result = await client.query<{id: string}>(
      `select id from "user" where lower(email) = lower($1)`,
      [email]
    )
    return result.rows[0]?.id
  })

type InvitationState = {
  last_invited_at: Date | null
  first_signed_in_at: Date | null
}

/** Les traces d'une adresse, lues sous le scope de l'association. */
const invitationStateOf = (slug: string, email: string) =>
  inTenant(slug, async (client) => {
    const result = await client.query<InvitationState>(
      `select s.last_invited_at, s.first_signed_in_at
         from member_invitation_state s
         join "user" u on u.id = s.user_id
        where lower(u.email) = lower($1)`,
      [email]
    )
    return result.rows[0]
  })

const resetRateLimits = () =>
  asMaintenance((client) =>
    client.query(
      `delete from rate_limit_event
        where organization_id in (select id from organization where slug = any($1))`,
      [[TENANT_A_SLUG, TENANT_B_SLUG]]
    )
  )

const cleanUpRun = () =>
  asMaintenance(async (client) => {
    await client.query(`delete from member_profile where name like $1`, [
      `% s42a-${RUN}`,
    ])
    await client.query(`delete from "user" where email like $1`, [
      `%-${RUN}@example.test`,
    ])
  })

type OutboxMessage = {to: string; subject?: string; text: string}

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

/** L'unique invitation reçue par l'adresse depuis `before`. */
const invitationTo = async (before: Set<string>, to: string) => {
  await expect
    .poll(() => newMessagesTo(before, to).length, {timeout: 15_000})
    .toBe(1)
  const [message] = newMessagesTo(before, to)
  expect(message.subject ?? '').toContain(INVITATION_SUBJECT)
  return message
}

const linkOf = (message: OutboxMessage) => {
  const link = message.text.match(
    /https?:\/\/\S+\/magic-link\/verify\?\S+/
  )?.[0]
  expect(link, 'la version texte porte l’URL en clair').toBeTruthy()
  return link as string
}

/**
 * Chaque contexte sort par une adresse IP à lui : Better Auth limite le débit
 * de `/magic-link/verify` par IP (voir `magic-link.spec.ts`).
 */
let nextClientIp = 0
const freshPage = async (browser: Browser) => {
  nextClientIp += 1
  const context = await browser.newContext({
    locale: 'fr-FR',
    extraHTTPHeaders: {
      'x-forwarded-for': `198.51.100.${(nextClientIp % 250) + 1}`,
    },
  })
  return context.newPage()
}

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

/** Le groupe « Adresse de domicile » du formulaire d'une fiche (s55). */
const homeGroup = (page: Page) =>
  page.getByRole('group', {name: /Adresse de domicile/})

/** Crée une fiche à l'écran ; rend son identifiant. */
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
  const home = homeGroup(page)
  await home.getByLabel('Adresse', {exact: true}).fill('3 rue du Lavoir')
  await home.getByLabel('Code postal').fill('33680')
  await home.getByLabel('Commune').fill('Lacanau')
  await page.getByRole('button', {name: 'Enregistrer le propriétaire'}).click()
  await expect(
    page.getByRole('heading', {level: 1, name: input.name})
  ).toBeVisible({timeout: 15_000})
  return new URL(page.url()).pathname.split('/').at(-1) as string
}

const accessCard = (page: Page) =>
  page.getByRole('region', {name: 'Accès à l’espace membre'})

const emailRow = (page: Page, email: string) =>
  emailsCard(page).getByRole('table').getByRole('row').filter({hasText: email})

/** « Envoyer / Renvoyer l'invitation » ; rend la requête de l'action. */
const invite = async (page: Page) => {
  const actionRequest = page.waitForRequest(
    (request) =>
      request.method() === 'POST' && Boolean(request.headers()['next-action'])
  )
  await accessCard(page)
    .getByRole('button', {name: /(Envoyer|Renvoyer) l’invitation/})
    .click()
  return actionRequest
}

type Family = {
  base: string
  slug: string
  profileId: string
  holder: string
  second: string
  holderLink: string
  secondLink: string
}

const families: Record<'a' | 'b', Family | undefined> = {
  a: undefined,
  b: undefined,
}
let capturedAction:
  {nextAction: string; contentType: string; body: Buffer} | undefined

test.describe('Invitation individuelle — s42a', () => {
  test.beforeEach(async () => {
    await resetRateLimits()
  })

  test.afterAll(async () => {
    await cleanUpRun()
  })

  for (const [key, base, slug, bureauEmail] of [
    ['a', TENANT_A, TENANT_A_SLUG, OWNER_A],
    ['b', TENANT_B, TENANT_B_SLUG, BOARD_B],
  ] as const) {
    test(`critères 1, 2, 5 et 10 — association ${key.toUpperCase()} : deux adresses, deux liens distincts, chacun ouvre la session sur son domaine`, async ({
      browser,
    }) => {
      test.setTimeout(180_000)
      const name = nameOf(`Famille ${key}`)
      const holder = emailOf(`titulaire-${key}`)
      const second = emailOf(`proche-${key}`)

      const bureau = await passwordSession(browser, base, bureauEmail)
      const member = await freshPage(browser)
      try {
        const profileId = await createProfile(bureau, base, {
          name,
          email: holder,
        })
        await addProfileEmail(bureau, second)
        await expect(emailRow(bureau, holder)).toContainText('Jamais invitée')

        const before = outboxFiles()
        const request = await invite(bureau)
        await expect(accessCard(bureau).getByRole('status')).toContainText(
          `Invitation envoyée à ${holder} et ${second}.`,
          {timeout: 15_000}
        )
        if (key === 'a') {
          capturedAction = {
            nextAction: request.headers()['next-action'],
            contentType: request.headers()['content-type'] ?? '',
            body: request.postDataBuffer() ?? Buffer.alloc(0),
          }
        }

        const holderLink = linkOf(await invitationTo(before, holder))
        const secondLink = linkOf(await invitationTo(before, second))
        expect(holderLink).not.toBe(secondLink)
        expect(new URL(holderLink).origin).toBe(base)
        expect(new URL(secondLink).origin).toBe(base)

        await member.goto(holderLink)
        await expect(member).toHaveURL(`${base}/dashboard`, {timeout: 15_000})

        await bureau.reload({waitUntil: 'networkidle'})
        await expect(emailRow(bureau, holder)).toContainText('Connectée le')
        await expect(emailRow(bureau, second)).toContainText('Invitée le')
        expect(
          (await invitationStateOf(slug, holder))?.first_signed_in_at
        ).toBeTruthy()

        families[key] = {
          base,
          slug,
          profileId,
          holder,
          second,
          holderLink,
          secondLink,
        }
      } finally {
        await bureau.close()
        await member.close()
      }
    })
  }

  test('critère 7 — réinviter rend l’ancien lien inopérant : page du lien invalide, variante invitation', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const family = families.a
    expect(family, 'la famille de A est invitée').toBeTruthy()
    if (!family) return

    const bureau = await passwordSession(browser, TENANT_A, OWNER_A)
    const member = await freshPage(browser)
    try {
      await bureau.goto(
        `${TENANT_A}/bureau/proprietaires/${family.profileId}`,
        {waitUntil: 'networkidle'}
      )
      await expect(
        accessCard(bureau).getByRole('button', {name: 'Renvoyer l’invitation'})
      ).toBeVisible({timeout: 15_000})

      const before = outboxFiles()
      await invite(bureau)
      await expect(accessCard(bureau).getByRole('status')).toContainText(
        'Invitation envoyée',
        {timeout: 15_000}
      )
      const renewed = linkOf(await invitationTo(before, family.second))
      expect(renewed).not.toBe(family.secondLink)

      await member.goto(family.secondLink)
      await expect(member).toHaveURL(/\/login\/lien-invalide/, {
        timeout: 15_000,
      })
      await expect(member.getByText(INVALID_INVITATION)).toBeVisible()
    } finally {
      await bureau.close()
      await member.close()
    }
  })

  test('critère 6 — une fiche « courrier uniquement » n’a pas de bouton d’invitation', async ({
    browser,
  }) => {
    const bureau = await passwordSession(browser, TENANT_A, OWNER_A)
    try {
      await createProfile(bureau, TENANT_A, {name: nameOf('Courrier')})
      await expect(accessCard(bureau)).toContainText(
        'Pas d’invitation possible : ce membre reçoit tout par courrier.'
      )
      await expect(accessCard(bureau).getByRole('button')).toHaveCount(0)
    } finally {
      await bureau.close()
    }
  })

  test('critère 9 — le bureau de A n’invite aucune fiche de B, même par l’appel direct de l’action', async ({
    browser,
  }) => {
    const a = families.a
    const b = families.b
    expect(a && b && capturedAction, 'deux familles invitées').toBeTruthy()
    if (!a || !b || !capturedAction) return

    const before = await invitationStateOf(TENANT_B_SLUG, b.second)
    const outbox = outboxFiles()
    const bureau = await passwordSession(browser, TENANT_A, OWNER_A)
    try {
      const body = Buffer.from(
        capturedAction.body
          .toString('latin1')
          .replaceAll(a.profileId, b.profileId),
        'latin1'
      )
      const replay = await bureau.request.post(
        `${TENANT_A}/bureau/proprietaires/${a.profileId}`,
        {
          headers: {
            'next-action': capturedAction.nextAction,
            'content-type': capturedAction.contentType,
            accept: 'text/x-component',
            origin: TENANT_A,
          },
          data: body,
        }
      )
      expect(replay.status()).toBeLessThan(500)
      await bureau.waitForTimeout(3_000)

      expect(newMessagesTo(outbox, b.holder)).toHaveLength(0)
      expect(newMessagesTo(outbox, b.second)).toHaveLength(0)
      expect(await invitationStateOf(TENANT_B_SLUG, b.second)).toEqual(before)
    } finally {
      await bureau.close()
    }
  })

  test('critère 5 — une session ouverte à la place du membre (s48) ne compte pas comme connexion', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const family = families.a
    expect(family, 'la famille de A est invitée').toBeTruthy()
    if (!family) return

    const before = await invitationStateOf(TENANT_A_SLUG, family.second)
    expect(before?.first_signed_in_at ?? null).toBeNull()

    const organizationId = await tenantIdOf(TENANT_A_SLUG)
    const page = await passwordSession(browser, TENANT_A, SUPER_ADMIN)
    try {
      await page.goto(
        `${TENANT_A}/admin/organizations/${organizationId}/edit`,
        {
          waitUntil: 'networkidle',
        }
      )
      await page
        .getByRole('row')
        .filter({hasText: family.second})
        .getByRole('button', {name: 'Agir à sa place'})
        .click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await dialog.getByRole('button', {name: /^Agir à la place de/}).click()
      await expect(page).toHaveURL(`${TENANT_A}/dashboard`, {timeout: 15_000})

      const after = await invitationStateOf(TENANT_A_SLUG, family.second)
      expect(after?.first_signed_in_at ?? null).toBeNull()
    } finally {
      await page.close()
      await asMaintenance((client) =>
        client.query(
          `delete from session
            where impersonated_by is not null
              and user_id = (select id from "user" where lower(email) = lower($1))`,
          [family.second]
        )
      )
    }
  })

  test('RLS — member_invitation_state : B ne lit ni n’écrit les traces de A', async () => {
    const family = families.a
    expect(family, 'la famille de A est invitée').toBeTruthy()
    if (!family) return
    const userId = await userIdOf(family.holder)
    const organizationA = await tenantIdOf(TENANT_A_SLUG)

    expect(await invitationStateOf(TENANT_A_SLUG, family.holder)).toBeTruthy()
    expect(
      await invitationStateOf(TENANT_B_SLUG, family.holder)
    ).toBeUndefined()

    const visibleFromB = await inTenant(TENANT_B_SLUG, async (client) =>
      client.query(
        `select id from member_invitation_state where organization_id = $1`,
        [organizationA]
      )
    )
    expect(visibleFromB.rowCount).toBe(0)

    await expect(
      inTenant(TENANT_B_SLUG, (client) =>
        client.query(
          `insert into member_invitation_state (organization_id, user_id, last_invited_at)
           values ($1, $2, now())`,
          [organizationA, userId]
        )
      )
    ).rejects.toThrow(/row-level security/)

    const withoutScope = await withClient((client) =>
      client.query(`select id from member_invitation_state`)
    )
    expect(withoutScope.rowCount).toBe(0)
  })
})
