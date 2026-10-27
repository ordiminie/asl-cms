/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {Browser, expect, Page, Route, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Rôles d'association — s14, critères 1 à 6 (ADR 039).
 *
 * Ce que seuls un navigateur, deux domaines et une vraie base prouvent : un
 * membre promu Bureau entre au back-office au rechargement suivant, rétrogradé
 * il en est refusé à l'écran **et** sur l'appel serveur, le dernier compte
 * capable ne peut pas se retirer, chaque changement est tracé en base, une
 * fiche d'une autre association et un rôle forgé ne produisent aucune
 * écriture, et la route HTTP du plugin organisation est fermée.
 *
 * `localhost` sert TechCorp Solutions, `127.0.0.1` Marketing Pro (seed). Les
 * comptes et fiches promus sont propres au run. Deux essais touchent la
 * présidence du seed (`user-owner@gmail.com`) : ils la rétablissent dans un
 * `finally`, et le nettoyage final la rétablit encore. La suite e2e tourne sur
 * un seul worker en CI : aucune autre spec ne lit TechCorp pendant ce temps.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
/** TechCorp Solutions dans le seed. */
const TENANT_A = `http://localhost:${PORT}`
/** Marketing Pro dans le seed. */
const TENANT_B = `http://127.0.0.1:${PORT}`
const TENANT_A_SLUG = 'techcorp-solutions'
const TENANT_B_SLUG = 'marketing-pro'

const PASSWORD = 'Azerty123'
/** Présidente de TechCorp Solutions, seul compte capable de TechCorp. */
const OWNER_A = 'user-owner@gmail.com'
/** Membre du bureau (rôle `board`) de Marketing Pro. */
const BOARD_B = 'user-admin@gmail.com'

const LIST_ROUTE = '/bureau/proprietaires'
const NEW_ROUTE = '/bureau/proprietaires/nouveau'
const SENT_TITLE = 'Consultez votre boîte mail'
const DENIED_TITLE = 'Cette page ne vous est pas accessible'
const FORBIDDEN =
  'Seul le bureau de l’association peut gérer les fiches des propriétaires.'

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
const RUN_STARTED_AT = new Date()
const nameOf = (label: string) => `${label} s14-${RUN}`
const emailOf = (label: string) => `${label}-s14-${RUN}@example.test`
const PARCEL_PREFIX = `R${RUN.toUpperCase()}-`
const parcelOf = (suffix: string) => `${PARCEL_PREFIX}${suffix}`
/** La fiche de la présidence du seed, créée par le run, partagée par deux essais. */
const OWNER_PROFILE_NAME = nameOf('Présidence')

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

/** Le rôle d'un compte dans une association, `null` sans ligne `member`. */
const roleOf = (email: string, slug: string) =>
  withClient(async (client) => {
    const result = await client.query<{role: string}>(
      `select m.role
         from member m
         join organization o on o.id = m.organization_id
         join "user" u on u.id = m.user_id
        where lower(u.email) = lower($1) and o.slug = $2`,
      [email, slug]
    )
    return result.rows[0]?.role ?? null
  })

/** Comptes capables (D3) : `owner` ou `board`, SuperAdmin exclus. */
const capableCountOf = (slug: string) =>
  withClient(async (client) => {
    const result = await client.query<{total: string}>(
      `select count(*) as total
         from member m
         join organization o on o.id = m.organization_id
         join "user" u on u.id = m.user_id
        where o.slug = $1 and m.role in ('owner', 'board')
          and u.role <> 'super_admin'`,
      [slug]
    )
    return Number(result.rows[0].total)
  })

type RoleEvent = {
  reason: string
  from_role: string | null
  to_role: string | null
  author_user_id: string | null
  author_name: string | null
  target_user_id: string | null
  target_name: string | null
  member_profile_id: string | null
}

/** La trace d'un compte, lue sous le scope de l'association (critère 4). */
const roleEventsOf = (slug: string, userId: string) =>
  inTenant(slug, async (client) => {
    const result = await client.query<RoleEvent>(
      `select reason, from_role, to_role, author_user_id, author_name,
              target_user_id, target_name, member_profile_id
         from member_role_event
        where target_user_id = $1
        order by created_at, reason`,
      [userId]
    )
    return result.rows
  })

const phoneOf = (slug: string, memberProfileId: string) =>
  inTenant(slug, async (client) => {
    const result = await client.query<{phone: string | null}>(
      `select phone from member_profile where id = $1`,
      [memberProfileId]
    )
    return result.rows[0]?.phone ?? null
  })

const profileIdByName = (slug: string, name: string) =>
  inTenant(slug, async (client) => {
    const result = await client.query<{id: string}>(
      `select id from member_profile where name = $1`,
      [name]
    )
    return result.rows[0]?.id
  })

/** Rend la présidence du seed à `user-owner@gmail.com`, quoi qu'il arrive. */
const restoreSeedPresidency = () =>
  asMaintenance((client) =>
    client.query(
      `update member set role = 'owner'
        where organization_id = (select id from organization where slug = $1)
          and user_id = (select id from "user" where email = $2)`,
      [TENANT_A_SLUG, OWNER_A]
    )
  )

/** Retire la présidence du seed le temps d'un essai (critère 3). */
const withoutSeedPresidency = () =>
  asMaintenance((client) =>
    client.query(
      `update member set role = 'board'
        where organization_id = (select id from organization where slug = $1)
          and user_id = (select id from "user" where email = $2)`,
      [TENANT_A_SLUG, OWNER_A]
    )
  )

/** Remet à zéro les compteurs du jour : chaque essai part de rien. */
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
    await client.query(
      `update member set role = 'owner'
        where organization_id = (select id from organization where slug = $1)
          and user_id = (select id from "user" where email = $2)`,
      [TENANT_A_SLUG, OWNER_A]
    )
    await client.query(
      `delete from member_role_event
        where created_at >= $1
          and organization_id in (select id from organization where slug = any($2))`,
      [RUN_STARTED_AT, [TENANT_A_SLUG, TENANT_B_SLUG]]
    )
    await client.query(
      `delete from parcel_ownership
        where member_profile_id in (select id from member_profile where name like $1)
           or parcel_id in (select id from parcel where number like $2)`,
      [`% s14-${RUN}`, `${PARCEL_PREFIX}%`]
    )
    await client.query(`delete from parcel where number like $1`, [
      `${PARCEL_PREFIX}%`,
    ])
    await client.query(`delete from member_profile where name like $1`, [
      `% s14-${RUN}`,
    ])
    await client.query(`delete from "user" where email like $1`, [
      `%-s14-${RUN}@example.test`,
    ])
  })

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
      'x-forwarded-for': `198.51.100.${(nextClientIp % 250) + 1}`,
    },
  })
  return context.newPage()
}

const linkOf = (message: OutboxMessage) => {
  const link = message.text.match(
    /https?:\/\/\S+\/magic-link\/verify\?\S+/
  )?.[0]
  expect(link, 'la version texte porte l’URL en clair').toBeTruthy()
  return link as string
}

/**
 * Se connecte par un vrai lien reçu. La destination dépend du rôle :
 * `/dashboard` pour un membre, `/bureau/pages` pour le bureau.
 */
const loginByLink = async (
  page: Page,
  origin: string,
  address: string,
  destination: string
) => {
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
  await expect
    .poll(() => newMessagesTo(before, address).length, {timeout: 10_000})
    .toBe(1)
  await page.goto(linkOf(newMessagesTo(before, address)[0]))
  await expect(page).toHaveURL(`${origin}${destination}`, {timeout: 15_000})
}

const bureauSession = async (browser: Browser, base: string, email: string) => {
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
  await page.getByLabel('Adresse', {exact: true}).fill('3 rue du Lavoir')
  await page.getByLabel('Code postal').fill('33680')
  await page.getByLabel('Commune').fill('Lacanau')
  await page.getByRole('button', {name: 'Enregistrer le propriétaire'}).click()
  await expect(
    page.getByRole('heading', {level: 1, name: input.name})
  ).toBeVisible({timeout: 15_000})
  return new URL(page.url()).pathname.split('/').at(-1) as string
}

const attachParcel = async (page: Page, number: string, startsOn: string) => {
  await page.getByRole('button', {name: 'Rattacher une parcelle'}).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Numéro de parcelle').fill(number)
  await dialog.getByLabel('Propriétaire depuis le').fill(startsOn)
  await dialog.getByRole('button', {name: 'Rattacher la parcelle'}).click()
  await expect(dialog).toBeHidden({timeout: 15_000})
}

const openProfile = async (page: Page, base: string, id: string) => {
  await page.goto(`${base}${LIST_ROUTE}/${id}`, {waitUntil: 'networkidle'})
  await expect(roleCard(page)).toBeVisible({timeout: 15_000})
}

const roleCard = (page: Page) =>
  page.getByRole('region', {name: 'Rôle dans l’association'})

/** « Modifier le rôle », choix, « Enregistrer le rôle ». */
const chooseRole = async (page: Page, label: string) => {
  const card = roleCard(page)
  await card.getByRole('button', {name: 'Modifier le rôle'}).click()
  await card.getByRole('radio', {name: label, exact: true}).click()
  await card.getByRole('button', {name: 'Enregistrer le rôle'}).click()
}

/** Passation : le choix « Président(e) » puis l'`alert-dialog`. */
const transferPresidency = async (page: Page, name: string) => {
  await chooseRole(page, 'Président(e)')
  const dialog = page.getByRole('alertdialog', {
    name: `Transmettre la présidence à ${name} ?`,
  })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', {name: 'Transmettre la présidence'}).click()
}

const confirmation = (page: Page, text: string) =>
  page.getByRole('status').filter({hasText: text})

/**
 * Réécrit le corps de la prochaine Server Action de la page : l'appel part tel
 * qu'un client forgé l'enverrait, l'écran n'y est pour rien.
 */
const forgeNextServerAction = async (
  page: Page,
  rewrite: (body: string) => string
) => {
  const handler = async (route: Route) => {
    const request = route.request()
    if (request.method() !== 'POST' || !request.headers()['next-action']) {
      await route.continue()
      return
    }
    await route.continue({postData: rewrite(request.postData() ?? '')})
  }
  await page.route(`**${LIST_ROUTE}/**`, handler)
  return () => page.unroute(`**${LIST_ROUTE}/**`, handler)
}

/** La fiche de la présidence du seed : créée une fois par le run. */
const ownerProfileId = async (bureau: Page) =>
  (await profileIdByName(TENANT_A_SLUG, OWNER_PROFILE_NAME)) ??
  createProfile(bureau, TENANT_A, {name: OWNER_PROFILE_NAME, email: OWNER_A})

test.describe('Rôles d’association — s14', () => {
  test.beforeEach(async () => {
    await resetRateLimits()
  })

  test.afterAll(async () => {
    await cleanUpRun()
  })

  test('critères 1, 2 et 4 — promu Bureau il entre au back-office ; rétrogradé il est refusé, à l’écran et sur l’appel serveur ; chaque changement est tracé', async ({
    browser,
  }) => {
    test.setTimeout(240_000)
    const name = nameOf('Promu')
    const email = emailOf('promu')

    const bureau = await bureauSession(browser, TENANT_A, OWNER_A)
    const member = await freshPage(browser)
    try {
      const id = await createProfile(bureau, TENANT_A, {name, email})
      // Sans parcelle, une fiche liée montre l'écran C5 (design s12d).
      await attachParcel(bureau, parcelOf('1'), '03/02/1998')
      await expect(roleCard(bureau)).toContainText(
        `Membre. ${name} accède à son espace personnel.`
      )

      await loginByLink(member, TENANT_A, email, '/dashboard')
      await member.goto(`${TENANT_A}${LIST_ROUTE}`, {waitUntil: 'networkidle'})
      await expect(
        member.getByRole('heading', {level: 1, name: DENIED_TITLE})
      ).toBeVisible({timeout: 15_000})

      await chooseRole(bureau, 'Bureau')
      await expect(confirmation(bureau, 'Rôle enregistré.')).toContainText(
        `${name} fait maintenant partie du bureau`
      )
      expect(await roleOf(email, TENANT_A_SLUG)).toBe('board')

      // Un rechargement réel : la requête suivante relit le rôle (ADR 038).
      await member.reload({waitUntil: 'networkidle'})
      await expect(
        member.getByRole('heading', {level: 1, name: 'Propriétaires'})
      ).toBeVisible({timeout: 15_000})

      // Une page du bureau restée ouverte : son formulaire partira après la
      // rétrogradation, comme un appel serveur direct.
      const stale = await member.context().newPage()
      await openProfile(stale, TENANT_A, id)
      await stale
        .getByRole('button', {name: 'Modifier les coordonnées'})
        .click()
      await stale.getByRole('textbox', {name: /^Téléphone/}).fill('0556000000')

      await openProfile(member, TENANT_A, id)
      await chooseRole(member, 'Membre')
      await expect(member).toHaveURL(`${TENANT_A}/dashboard?role=retire`, {
        timeout: 15_000,
      })
      await expect(
        confirmation(member, 'Vous ne faites plus partie du bureau.')
      ).toContainText('Votre espace personnel reste ouvert.')
      expect(await roleOf(email, TENANT_A_SLUG)).toBe('member')

      await stale
        .getByRole('button', {name: 'Enregistrer les coordonnées'})
        .click()
      await expect(
        stale
          .getByRole('region', {name: 'Coordonnées'})
          .getByRole('alert')
          .filter({hasText: FORBIDDEN})
      ).toBeVisible({timeout: 15_000})
      expect(await phoneOf(TENANT_A_SLUG, id)).toBeNull()

      await member.goto(`${TENANT_A}${LIST_ROUTE}`, {waitUntil: 'networkidle'})
      await expect(
        member.getByRole('heading', {level: 1, name: DENIED_TITLE})
      ).toBeVisible({timeout: 15_000})

      const owner = await userOf(OWNER_A)
      const promoted = await userOf(email)
      expect(await roleEventsOf(TENANT_A_SLUG, promoted.id)).toEqual([
        {
          reason: 'assignment',
          from_role: 'member',
          to_role: 'board',
          author_user_id: owner.id,
          author_name: owner.name,
          target_user_id: promoted.id,
          target_name: name,
          member_profile_id: id,
        },
        {
          reason: 'assignment',
          from_role: 'board',
          to_role: 'member',
          author_user_id: promoted.id,
          author_name: promoted.name,
          target_user_id: promoted.id,
          target_name: name,
          member_profile_id: id,
        },
      ])
    } finally {
      await member.context().close()
      await bureau.context().close()
    }
  })

  test('critère 3 — le dernier compte qui peut désigner le bureau ne peut pas se retirer', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const bureau = await bureauSession(browser, TENANT_A, OWNER_A)
    try {
      const id = await ownerProfileId(bureau)
      const owner = await userOf(OWNER_A)
      const tracedBefore = (await roleEventsOf(TENANT_A_SLUG, owner.id)).length

      await withoutSeedPresidency()
      expect(await capableCountOf(TENANT_A_SLUG)).toBe(1)

      await openProfile(bureau, TENANT_A, id)
      await expect(roleCard(bureau)).toContainText('Bureau.')
      await chooseRole(bureau, 'Membre')
      await expect(
        roleCard(bureau)
          .getByRole('alert')
          .filter({hasText: 'Votre compte est le dernier'})
      ).toHaveText(
        'Votre compte est le dernier qui peut désigner le bureau de l’association. Désignez d’abord une autre personne au bureau. Rien n’a été enregistré.'
      )
      await expect(
        roleCard(bureau).getByRole('radio', {name: 'Membre', exact: true})
      ).toBeChecked()

      expect(await roleOf(OWNER_A, TENANT_A_SLUG)).toBe('board')
      expect(await roleEventsOf(TENANT_A_SLUG, owner.id)).toHaveLength(
        tracedBefore
      )
    } finally {
      await restoreSeedPresidency()
      await bureau.context().close()
    }
  })

  test('passation — la Président(e) transmet la présidence ; le successeur la lui rend', async ({
    browser,
  }) => {
    test.setTimeout(240_000)
    const name = nameOf('Successeur')
    const email = emailOf('successeur')

    const bureau = await bureauSession(browser, TENANT_A, OWNER_A)
    const successor = await freshPage(browser)
    try {
      const ownerProfile = await ownerProfileId(bureau)
      const id = await createProfile(bureau, TENANT_A, {name, email})

      await transferPresidency(bureau, name)
      await expect(confirmation(bureau, 'Rôle enregistré.')).toContainText(
        `${name} est maintenant Président(e). Vous restez membre du bureau.`
      )
      // La requête suivante relit le rôle de la personne connectée (ADR 038) :
      // elle voit désormais la carte comme un membre du Bureau (A5, A8).
      await bureau.reload({waitUntil: 'networkidle'})
      await expect(roleCard(bureau)).toContainText(
        'Seul(e) la Président(e) peut transmettre la présidence.'
      )
      await expect(
        roleCard(bureau).getByRole('button', {name: 'Modifier le rôle'})
      ).toHaveCount(0)
      expect(await roleOf(email, TENANT_A_SLUG)).toBe('owner')
      expect(await roleOf(OWNER_A, TENANT_A_SLUG)).toBe('board')

      const owner = await userOf(OWNER_A)
      const heir = await userOf(email)
      expect(await roleEventsOf(TENANT_A_SLUG, heir.id)).toEqual([
        expect.objectContaining({
          reason: 'presidency_transfer',
          from_role: 'member',
          to_role: 'owner',
          author_user_id: owner.id,
          member_profile_id: id,
        }),
      ])
      expect(await roleEventsOf(TENANT_A_SLUG, owner.id)).toContainEqual(
        expect.objectContaining({
          reason: 'presidency_transfer',
          from_role: 'owner',
          to_role: 'board',
          author_user_id: owner.id,
        })
      )

      await loginByLink(successor, TENANT_A, email, '/bureau/pages')
      await openProfile(successor, TENANT_A, ownerProfile)
      await transferPresidency(successor, OWNER_PROFILE_NAME)
      await expect(confirmation(successor, 'Rôle enregistré.')).toContainText(
        `${OWNER_PROFILE_NAME} est maintenant Président(e).`
      )
      expect(await roleOf(OWNER_A, TENANT_A_SLUG)).toBe('owner')
      expect(await roleOf(email, TENANT_A_SLUG)).toBe('board')
    } finally {
      await restoreSeedPresidency()
      await successor.context().close()
      await bureau.context().close()
    }
  })

  test('critères 5 et 6 — appels forgés : la fiche d’une autre association et le rôle SuperAdmin n’écrivent rien', async ({
    browser,
  }) => {
    test.setTimeout(180_000)
    const neighbourName = nameOf('Voisin')
    const neighbourEmail = emailOf('voisin')
    const targetName = nameOf('Cible')
    const targetEmail = emailOf('cible')

    const bureauB = await bureauSession(browser, TENANT_B, BOARD_B)
    const bureau = await bureauSession(browser, TENANT_A, OWNER_A)
    try {
      const neighbourId = await createProfile(bureauB, TENANT_B, {
        name: neighbourName,
        email: neighbourEmail,
      })
      const targetId = await createProfile(bureau, TENANT_A, {
        name: targetName,
        email: targetEmail,
      })

      await roleCard(bureau)
        .getByRole('button', {name: 'Modifier le rôle'})
        .click()
      const options = roleCard(bureau).getByRole('radio')
      await expect(options).toHaveCount(3)
      expect(
        await options.evaluateAll((radios) =>
          radios.map((radio) => radio.getAttribute('value'))
        )
      ).toEqual(['member', 'board', 'owner'])
      await roleCard(bureau).getByRole('button', {name: 'Annuler'}).click()

      const stopForgingId = await forgeNextServerAction(bureau, (body) =>
        body.replaceAll(targetId, neighbourId)
      )
      await chooseRole(bureau, 'Bureau')
      await expect(
        roleCard(bureau)
          .getByRole('alert')
          .filter({hasText: 'Cette fiche n’existe plus.'})
      ).toBeVisible({timeout: 15_000})
      await stopForgingId()

      expect(await roleOf(neighbourEmail, TENANT_B_SLUG)).toBe('member')
      expect(await roleOf(targetEmail, TENANT_A_SLUG)).toBe('member')
      const neighbour = await userOf(neighbourEmail)
      expect(await roleEventsOf(TENANT_B_SLUG, neighbour.id)).toEqual([])

      await openProfile(bureau, TENANT_A, targetId)
      const stopForgingRole = await forgeNextServerAction(bureau, (body) =>
        body.replace(/(name="[^"]*role"\r\n\r\n)board/, '$1super_admin')
      )
      await chooseRole(bureau, 'Bureau')
      await expect(
        roleCard(bureau)
          .getByRole('alert')
          .filter({hasText: 'Ce rôle ne peut pas être attribué.'})
      ).toBeVisible({timeout: 15_000})
      await stopForgingRole()

      expect(await roleOf(targetEmail, TENANT_A_SLUG)).toBe('member')
      const target = await userOf(targetEmail)
      expect(await roleEventsOf(TENANT_A_SLUG, target.id)).toEqual([])
    } finally {
      await bureau.context().close()
      await bureauB.context().close()
    }
  })

  test('les routes HTTP du plugin organisation qui écrivent des appartenances répondent 404', async ({
    browser,
  }) => {
    test.setTimeout(60_000)
    const bureau = await bureauSession(browser, TENANT_A, OWNER_A)
    try {
      for (const route of [
        '/api/auth/organization/update-member-role',
        '/api/auth/organization/remove-member',
      ]) {
        const response = await bureau.request.post(`${TENANT_A}${route}`, {
          headers: {origin: TENANT_A},
          data: {memberIdOrEmail: BOARD_B, memberId: 'x', role: 'owner'},
        })
        expect(response.status(), route).toBe(404)
      }
      expect(await roleOf(OWNER_A, TENANT_A_SLUG)).toBe('owner')
    } finally {
      await bureau.context().close()
    }
  })
})
