/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {Browser, expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Comptes des membres — s12d, critères 1 à 6 (ADR 037, ADR 038).
 *
 * Ce que seuls un navigateur, deux domaines et une vraie base prouvent : une
 * adresse saisie par le bureau ouvre un compte **connectable** (un vrai lien
 * reçu, une vraie session), la retirer le referme sans toucher la fiche, un
 * compte partagé entre deux associations ne se ferme que sur l'une, « Mes
 * parcelles » ne montre que la fiche de l'association du domaine, et une
 * session ouverte est coupée au **rechargement réel** suivant.
 *
 * `localhost` sert TechCorp Solutions, `127.0.0.1` Marketing Pro (seed). Les
 * fiches du seed ne sont jamais modifiées : les écritures portent un marqueur
 * d'essai, nettoyé à la fin, comptes compris.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
/** TechCorp Solutions dans le seed. */
const TENANT_A = `http://localhost:${PORT}`
/** Marketing Pro dans le seed. */
const TENANT_B = `http://127.0.0.1:${PORT}`
const TENANT_A_SLUG = 'techcorp-solutions'
const TENANT_B_SLUG = 'marketing-pro'

const PASSWORD = 'Azerty123'
/** Présidente de TechCorp Solutions. */
const OWNER_A = 'user-owner@gmail.com'
/** Membre du bureau (rôle `board`) de Marketing Pro. */
const BOARD_B = 'user-admin@gmail.com'

/** Fiches du seed (`tenant-member-profiles-seed.ts`). */
const SEED_MEUNIER_EMAIL = 'claire.meunier@techcorp-solutions.test'
const SEED_MOREAU_EMAIL = 'lucie.moreau@example.test'
const SEED_POMMIER_EMAIL = 'gerard.pommier@example.test'
const SEED_DUBOIS = 'a1200000-0000-4000-8000-000000000002'

const LIST_ROUTE = '/bureau/proprietaires'
const NEW_ROUTE = '/bureau/proprietaires/nouveau'
const SENT_TITLE = 'Consultez votre boîte mail'

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
const nameOf = (label: string) => `${label} s12d-${RUN}`
const emailOf = (label: string) => `${label}-${RUN}@example.test`
const PARCEL_PREFIX = `M${RUN.toUpperCase()}-`
const parcelOf = (suffix: string) => `${PARCEL_PREFIX}${suffix}`

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

/** Les comptes d'une adresse et leurs appartenances, par association. */
const accountOf = (email: string) =>
  withClient(async (client) => {
    const users = await client.query<{id: string; email: string}>(
      `select id, email from "user" where lower(email) = lower($1)`,
      [email]
    )
    const members = await client.query<{slug: string; role: string}>(
      `select o.slug, m.role
         from member m
         join organization o on o.id = m.organization_id
         join "user" u on u.id = m.user_id
        where lower(u.email) = lower($1)
        order by o.slug`,
      [email]
    )
    return {users: users.rows, members: members.rows}
  })

type StoredProfile = {
  id: string
  name: string
  email: string | null
  user_id: string | null
}

const storedProfileOf = (slug: string, name: string) =>
  inTenant(slug, async (client) => {
    const result = await client.query<StoredProfile>(
      `select id, name, email, user_id from member_profile where name = $1`,
      [name]
    )
    return result.rows[0]
  })

const periodsOf = (slug: string, memberProfileId: string) =>
  inTenant(slug, async (client) => {
    const result = await client.query<{number: string; starts_on: string}>(
      `select p.number, po.starts_on::text as starts_on
         from parcel_ownership po
         join parcel p on p.id = po.parcel_id
        where po.member_profile_id = $1`,
      [memberProfileId]
    )
    return result.rows
  })

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
      `delete from parcel_ownership
        where member_profile_id in (select id from member_profile where name like $1)
           or parcel_id in (select id from parcel where number like $2)`,
      [`% s12d-${RUN}`, `${PARCEL_PREFIX}%`]
    )
    await client.query(`delete from parcel where number like $1`, [
      `${PARCEL_PREFIX}%`,
    ])
    await client.query(`delete from member_profile where name like $1`, [
      `% s12d-${RUN}`,
    ])
    await client.query(`delete from "user" where email like $1`, [
      `%-${RUN}@example.test`,
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

/** Demande un lien de connexion ; rend les messages reçus par l'adresse. */
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

/** Se connecte par un vrai lien reçu et arrive sur « Mes parcelles ». */
const loginByLink = async (page: Page, origin: string, address: string) => {
  const before = await requestLink(page, origin, address)
  await expect
    .poll(() => newMessagesTo(before, address).length, {timeout: 10_000})
    .toBe(1)
  await page.goto(linkOf(newMessagesTo(before, address)[0]))
  await expect(page).toHaveURL(`${origin}/dashboard`, {timeout: 15_000})
}

/** Le même écran qu'une adresse connue, mais aucun lien ne part. */
const expectNoLinkSent = async (
  page: Page,
  origin: string,
  address: string
) => {
  const before = await requestLink(page, origin, address)
  await page.waitForTimeout(3_000)
  expect(newMessagesTo(before, address)).toHaveLength(0)
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

/** Change l'adresse depuis la fiche ouverte et attend la confirmation. */
const saveEmail = async (page: Page, email: string) => {
  await page.getByRole('button', {name: 'Modifier les coordonnées'}).click()
  await page.getByRole('textbox', {name: /^Adresse email/}).fill(email)
  await page.getByRole('button', {name: 'Enregistrer les coordonnées'}).click()
}

const accessCard = (page: Page) =>
  page.getByRole('region', {name: 'Accès à l’espace membre'})

const myParcels = (page: Page) =>
  page.getByRole('region', {name: 'Mes parcelles'})

test.describe('Comptes des membres — s12d', () => {
  test.beforeEach(async () => {
    await resetRateLimits()
  })

  test.afterAll(async () => {
    await cleanUpRun()
  })

  test('critère 1 — une adresse ouvre un compte connectable ; la retirer le referme, fiche et parcelles intactes', async ({
    browser,
  }) => {
    test.setTimeout(180_000)
    const name = nameOf('Ouverture')
    const email = emailOf('ouverture')
    const number = parcelOf('1')

    const bureau = await bureauSession(browser, TENANT_A, OWNER_A)
    const member = await freshPage(browser)
    try {
      const id = await createProfile(bureau, TENANT_A, {name})
      await attachParcel(bureau, number, '03/02/1998')
      await expect(accessCard(bureau)).toContainText(
        'Joignable par courrier uniquement.'
      )

      await saveEmail(bureau, email)
      await expect(bureau.getByRole('status')).toContainText(
        `Compte ouvert : ${name} peut désormais se connecter avec ${email}.`
      )
      await bureau.reload({waitUntil: 'networkidle'})
      await expect(accessCard(bureau)).toContainText(
        `Compte ouvert. ${name} peut se connecter à son espace avec ${email}.`
      )

      const opened = await accountOf(email)
      expect(opened.users).toHaveLength(1)
      expect(opened.users[0].email).toBe(email.toLowerCase())
      expect(opened.members).toEqual([{slug: TENANT_A_SLUG, role: 'member'}])
      expect((await storedProfileOf(TENANT_A_SLUG, name))?.user_id).toBe(
        opened.users[0].id
      )

      await loginByLink(member, TENANT_A, email)
      await expect(
        member.getByRole('heading', {level: 1, name: `Bonjour ${name}`})
      ).toBeVisible()
      await expect(myParcels(member)).toContainText(`Parcelle ${number}`)
      await member.context().close()

      await saveEmail(bureau, '')
      await expect(bureau.getByRole('status')).toContainText(
        'Accès à l’espace fermé.'
      )

      const closed = await accountOf(email)
      expect(closed.users, 'le compte n’est jamais supprimé').toHaveLength(1)
      expect(closed.members).toEqual([])
      expect(await storedProfileOf(TENANT_A_SLUG, name)).toMatchObject({
        id,
        email: null,
        user_id: null,
      })
      expect(await periodsOf(TENANT_A_SLUG, id)).toEqual([
        {number, starts_on: '1998-02-03'},
      ])

      const refused = await freshPage(browser)
      await expectNoLinkSent(refused, TENANT_A, email)
      await refused.context().close()
    } finally {
      await bureau.context().close()
    }
  })

  test('critère 2 — une fiche du seed qui avait déjà une adresse a un compte connectable', async ({
    browser,
  }) => {
    test.setTimeout(90_000)
    expect((await accountOf(SEED_MEUNIER_EMAIL)).members).toEqual([
      {slug: TENANT_A_SLUG, role: 'member'},
    ])

    const member = await freshPage(browser)
    try {
      await loginByLink(member, TENANT_A, SEED_MEUNIER_EMAIL)
      await expect(
        member.getByRole('heading', {level: 1, name: 'Bonjour Claire Meunier'})
      ).toBeVisible()
      await expect(myParcels(member)).toContainText('Parcelle 12')
      await expect(myParcels(member)).toContainText('Parcelle 13')
    } finally {
      await member.context().close()
    }
  })

  test('critère 3 — une même adresse sur deux associations : un seul compte ; fermer sur A laisse B ouvert', async ({
    browser,
  }) => {
    test.setTimeout(180_000)
    const name = nameOf('Partage')
    const email = emailOf('partage')

    const bureauA = await bureauSession(browser, TENANT_A, OWNER_A)
    const bureauB = await bureauSession(browser, TENANT_B, BOARD_B)
    try {
      await createProfile(bureauA, TENANT_A, {name, email})
      await createProfile(bureauB, TENANT_B, {name, email})

      const shared = await accountOf(email)
      expect(shared.users, 'une adresse, un seul compte').toHaveLength(1)
      expect(shared.members).toEqual([
        {slug: TENANT_B_SLUG, role: 'member'},
        {slug: TENANT_A_SLUG, role: 'member'},
      ])

      await saveEmail(bureauA, '')
      await expect(bureauA.getByRole('status')).toContainText(
        'Accès à l’espace fermé.'
      )
      expect((await accountOf(email)).members).toEqual([
        {slug: TENANT_B_SLUG, role: 'member'},
      ])

      const onA = await freshPage(browser)
      await expectNoLinkSent(onA, TENANT_A, email)
      await onA.context().close()

      const onB = await freshPage(browser)
      await loginByLink(onB, TENANT_B, email)
      await expect(
        onB.getByRole('heading', {level: 1, name: `Bonjour ${name}`})
      ).toBeVisible()
      await onB.context().close()
    } finally {
      await bureauA.context().close()
      await bureauB.context().close()
    }
  })

  test('critère 4 — chaque domaine montre la fiche de son association, et seulement elle', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const pommier = await accountOf(SEED_POMMIER_EMAIL)
    expect(pommier.users).toHaveLength(1)
    expect(pommier.members).toEqual([
      {slug: TENANT_B_SLUG, role: 'member'},
      {slug: TENANT_A_SLUG, role: 'member'},
    ])

    const onA = await freshPage(browser)
    const onB = await freshPage(browser)
    try {
      await loginByLink(onA, TENANT_A, SEED_POMMIER_EMAIL)
      await expect(myParcels(onA)).toContainText('Parcelle 33')
      await expect(myParcels(onA)).not.toContainText('Parcelle 21')

      await loginByLink(onB, TENANT_B, SEED_POMMIER_EMAIL)
      await expect(myParcels(onB)).toContainText('Parcelle 21')
      await expect(myParcels(onB)).not.toContainText('Parcelle 33')
    } finally {
      await onA.context().close()
      await onB.context().close()
    }
  })

  test('critère 4 — anciennes parcelles sans acquéreur ; la fiche d’un autre membre est refusée (C4)', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const member = await freshPage(browser)
    try {
      await loginByLink(member, TENANT_A, SEED_MOREAU_EMAIL)
      await expect(myParcels(member)).toContainText('Parcelle 21')
      await expect(myParcels(member)).toContainText(
        'Propriétaire du 14 mai 2003 au 30 septembre 2019'
      )
      await expect(myParcels(member)).not.toContainText('Marcel Laurent')

      await member.goto(`${TENANT_A}${LIST_ROUTE}/${SEED_DUBOIS}`, {
        waitUntil: 'networkidle',
      })
      await expect(
        member.getByRole('heading', {
          level: 1,
          name: 'Cette page ne vous est pas accessible',
        })
      ).toBeVisible({timeout: 15_000})
      await expect(
        member.getByRole('link', {name: 'Revenir à mon espace'})
      ).toHaveAttribute('href', '/dashboard')
      await expect(member.getByText('Jean et Odile Dubois')).toHaveCount(0)
      await expect(member.getByText('Parcelle 47')).toHaveCount(0)
    } finally {
      await member.context().close()
    }
  })

  test('critère 6 — adresse retirée pendant une session ouverte : coupée au rechargement suivant', async ({
    browser,
  }) => {
    test.setTimeout(180_000)
    const name = nameOf('Session')
    const email = emailOf('session')

    const bureau = await bureauSession(browser, TENANT_A, OWNER_A)
    const member = await freshPage(browser)
    try {
      await createProfile(bureau, TENANT_A, {name, email})
      await attachParcel(bureau, parcelOf('S'), '01/03/2020')

      await loginByLink(member, TENANT_A, email)
      await expect(
        member.getByRole('heading', {level: 1, name: `Bonjour ${name}`})
      ).toBeVisible()

      await saveEmail(bureau, '')
      await expect(bureau.getByRole('status')).toContainText(
        'Accès à l’espace fermé.'
      )

      // Un rechargement réel, pas une navigation cliente servie par
      // `staleTimes` : la requête suivante relit l'appartenance (ADR 038).
      await member.reload()
      await expect(member).toHaveURL(`${TENANT_A}/login?acces=ferme`, {
        timeout: 15_000,
      })
      await expect(member.getByRole('status')).toContainText(
        'Votre accès à l’espace membre est fermé.'
      )
      await expect(member.getByRole('status')).toContainText(
        'Pour le rouvrir, écrivez au bureau.'
      )

      await member.goto(`${TENANT_A}/dashboard`)
      await expect(member).toHaveURL(`${TENANT_A}/login`, {timeout: 15_000})
    } finally {
      await member.context().close()
      await bureau.context().close()
    }
  })

  test('fiche du bureau — vider son adresse est refusé, rien n’est écrit', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const name = nameOf('Bureau')

    const bureau = await bureauSession(browser, TENANT_B, BOARD_B)
    try {
      await createProfile(bureau, TENANT_B, {name, email: BOARD_B})
      await expect(accessCard(bureau)).toContainText(
        'Membre du bureau : son adresse peut être modifiée, pas supprimée.'
      )

      await saveEmail(bureau, '')
      await expect(bureau.getByRole('alert')).toContainText(
        `${name} fait partie du bureau : son adresse lui sert à se connecter. Vous pouvez la modifier, pas la supprimer. Rien n’a été enregistré.`
      )

      expect((await storedProfileOf(TENANT_B_SLUG, name))?.email).toBe(BOARD_B)
      expect((await accountOf(BOARD_B)).members).toContainEqual({
        slug: TENANT_B_SLUG,
        role: 'board',
      })
    } finally {
      await bureau.context().close()
    }
  })
})
