/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {Browser, expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

import {
  ADDED,
  addProfileEmail,
  BOARD_EMAIL_REFUSED,
  emailsCard,
  emailsNotice,
  REMOVED,
  removeProfileEmail,
} from './support/member-email-card'

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
 * fiches du seed ne sont jamais modifiées par s12d : les écritures portent un
 * marqueur d'essai, nettoyé à la fin, comptes compris. Les essais de s16
 * remettent à la fin les coordonnées du seed qu'ils ont corrigées.
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

/**
 * La fiche, son adresse titulaire active (s54, ADR 056) et le compte de
 * cette adresse, lu par la table de liaison (s53, ADR 054).
 */
const storedProfileOf = (slug: string, name: string) =>
  inTenant(slug, async (client) => {
    const result = await client.query<StoredProfile>(
      `select p.id, p.name, e.email,
              (select a.user_id
                 from member_profile_account a
                 join "user" u on u.id = a.user_id
                where a.member_profile_id = p.id
                  and lower(u.email) = lower(e.email)
                limit 1) as user_id
         from member_profile p
         left join member_profile_email e
           on e.member_profile_id = p.id
          and e.role = 'holder' and e.status = 'active'
        where p.name = $1`,
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

/** Se connecte par un vrai lien reçu et arrive sur « Mes terrains ». */
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

const accessCard = (page: Page) =>
  page.getByRole('region', {name: 'Accès à l’espace membre'})

const myParcels = (page: Page) =>
  page.getByRole('region', {name: 'Mes terrains'})

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

      await addProfileEmail(bureau, email)
      await expect(emailsNotice(bureau)).toContainText(ADDED)
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

      await removeProfileEmail(bureau, email)
      await expect(emailsNotice(bureau)).toContainText(REMOVED)

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
    const numberOnB = parcelOf('3')

    const bureauA = await bureauSession(browser, TENANT_A, OWNER_A)
    const bureauB = await bureauSession(browser, TENANT_B, BOARD_B)
    try {
      await createProfile(bureauA, TENANT_A, {name, email})
      await createProfile(bureauB, TENANT_B, {name, email})
      // Sans parcelle, une fiche liée montre l'écran C5 (design s12d) : la
      // salutation attendue sur B suppose une parcelle rattachée.
      await attachParcel(bureauB, numberOnB, '01/03/2020')

      const shared = await accountOf(email)
      expect(shared.users, 'une adresse, un seul compte').toHaveLength(1)
      expect(shared.members).toEqual([
        {slug: TENANT_B_SLUG, role: 'member'},
        {slug: TENANT_A_SLUG, role: 'member'},
      ])
      const userId = shared.users[0].id
      expect((await storedProfileOf(TENANT_A_SLUG, name))?.user_id).toBe(userId)
      expect((await storedProfileOf(TENANT_B_SLUG, name))?.user_id).toBe(userId)

      await removeProfileEmail(bureauA, email)
      await expect(emailsNotice(bureauA)).toContainText(REMOVED)
      expect((await accountOf(email)).members).toEqual([
        {slug: TENANT_B_SLUG, role: 'member'},
      ])
      expect((await storedProfileOf(TENANT_A_SLUG, name))?.user_id).toBeNull()
      expect((await storedProfileOf(TENANT_B_SLUG, name))?.user_id).toBe(userId)

      const onA = await freshPage(browser)
      await expectNoLinkSent(onA, TENANT_A, email)
      await onA.context().close()

      const onB = await freshPage(browser)
      await loginByLink(onB, TENANT_B, email)
      await expect(
        onB.getByRole('heading', {level: 1, name: `Bonjour ${name}`})
      ).toBeVisible()
      await expect(myParcels(onB)).toContainText(`Parcelle ${numberOnB}`)
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

      await removeProfileEmail(bureau, email)
      await expect(emailsNotice(bureau)).toContainText(REMOVED)

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
      await expect(
        emailsCard(bureau).getByRole('table').getByText('Bureau')
      ).toBeVisible()

      const refusal = await removeProfileEmail(bureau, BOARD_B)
      await expect(refusal).toContainText(BOARD_EMAIL_REFUSED, {
        timeout: 15_000,
      })

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

type StoredContact = {
  email: string | null
  phone: string | null
  address_complement: string | null
  postal_code: string | null
}

const storedContactOf = (slug: string, name: string) =>
  inTenant(slug, async (client) => {
    const result = await client.query<StoredContact>(
      `select (select e.email from member_profile_email e
                where e.member_profile_id = p.id
                  and e.role = 'holder' and e.status = 'active') as email,
              p.phone, p.address_complement, p.postal_code
         from member_profile p where p.name = $1`,
      [name]
    )
    return result.rows[0]
  })

const myContact = (page: Page) =>
  page.getByRole('region', {name: 'Mes coordonnées'})

const editMyContact = async (
  page: Page,
  values: {phone?: string; addressComplement?: string; postalCode?: string}
) => {
  const card = myContact(page)
  await card.getByRole('button', {name: 'Modifier mes coordonnées'}).click()
  if (values.phone !== undefined) {
    await card.getByLabel(/^Téléphone/).fill(values.phone)
  }
  if (values.addressComplement !== undefined) {
    await card.getByLabel(/^Complément/).fill(values.addressComplement)
  }
  if (values.postalCode !== undefined) {
    await card.getByLabel(/^Code postal/).fill(values.postalCode)
    await card.getByLabel(/^Code postal/).blur()
  }
  await card.getByRole('button', {name: 'Enregistrer mes coordonnées'}).click()
}

/**
 * Coordonnées du membre — s16, critères 1 à 4 (ADR 040).
 *
 * Seuls une vraie base et deux domaines prouvent que l'écriture vise la fiche
 * du compte connecté (par `member_profile_account` sous RLS, s53), que l'autre association de
 * la personne n'est pas touchée et que l'email ne change jamais. Les fiches
 * du seed modifiées ici sont remises à leurs valeurs à la fin.
 */
test.describe('Coordonnées du membre — s16', () => {
  test.beforeEach(async () => {
    await resetRateLimits()
  })

  test.afterAll(async () => {
    await inTenant(TENANT_A_SLUG, (client) =>
      client.query(
        `update member_profile
            set phone = null, address_complement = null
          where name = any($1)`,
        [['Lucie Moreau', 'Gérard Pommier']]
      )
    )
    await cleanUpRun()
  })

  test('critères 1 et 4 — le membre corrige ses coordonnées, les retrouve au rechargement, et le bureau les voit', async ({
    browser,
  }) => {
    test.setTimeout(150_000)
    const member = await freshPage(browser)
    const bureau = await bureauSession(browser, TENANT_A, OWNER_A)
    try {
      await loginByLink(member, TENANT_A, SEED_MOREAU_EMAIL)
      await expect(myContact(member)).toContainText(SEED_MOREAU_EMAIL)
      await expect(
        myContact(member).getByRole('textbox', {name: /Adresse email/})
      ).toHaveCount(0)

      await editMyContact(member, {
        phone: '07 45 12 89 30',
        addressComplement: 'Bâtiment C',
      })
      await expect(member.getByRole('status')).toContainText(
        'Coordonnées enregistrées.'
      )

      await member.reload({waitUntil: 'networkidle'})
      await expect(myContact(member)).toContainText('07 45 12 89 30')
      await expect(myContact(member)).toContainText('Bâtiment C')
      expect(
        await storedContactOf(TENANT_A_SLUG, 'Lucie Moreau')
      ).toMatchObject({
        email: SEED_MOREAU_EMAIL,
        phone: '07 45 12 89 30',
        address_complement: 'Bâtiment C',
      })

      const {id} = await storedProfileOf(TENANT_A_SLUG, 'Lucie Moreau')
      await bureau.goto(`${TENANT_A}${LIST_ROUTE}/${id}`, {
        waitUntil: 'networkidle',
      })
      const coordinates = bureau.getByRole('region', {name: 'Coordonnées'})
      await expect(coordinates).toContainText('07 45 12 89 30', {
        timeout: 15_000,
      })
      await expect(coordinates).toContainText('Bâtiment C')
    } finally {
      await member.context().close()
      await bureau.context().close()
    }
  })

  test('critère 2 — une saisie invalide est signalée sous le champ et rien n’est enregistré', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const before = await storedContactOf(TENANT_A_SLUG, 'Lucie Moreau')
    const member = await freshPage(browser)
    try {
      await loginByLink(member, TENANT_A, SEED_MOREAU_EMAIL)
      await editMyContact(member, {postalCode: '1310'})

      await expect(myContact(member).getByRole('alert')).toContainText(
        'Vos coordonnées n’ont pas été enregistrées. Corrigez les champs signalés.'
      )
      await expect(myContact(member)).toContainText(
        'Un code postal compte 5 chiffres.'
      )

      await member.reload({waitUntil: 'networkidle'})
      await expect(myContact(member)).toContainText(
        `${before.postal_code} Lacanau`
      )
      expect(await storedContactOf(TENANT_A_SLUG, 'Lucie Moreau')).toEqual(
        before
      )
    } finally {
      await member.context().close()
    }
  })

  test('critère 3 — corriger sur une association ne touche pas l’autre, et l’email ne change jamais', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const onB = await storedContactOf(TENANT_B_SLUG, 'Gérard Pommier')
    const member = await freshPage(browser)
    try {
      await loginByLink(member, TENANT_A, SEED_POMMIER_EMAIL)
      await editMyContact(member, {phone: '06 98 76 54 32'})
      await expect(member.getByRole('status')).toContainText(
        'Coordonnées enregistrées.'
      )

      expect(
        await storedContactOf(TENANT_A_SLUG, 'Gérard Pommier')
      ).toMatchObject({email: SEED_POMMIER_EMAIL, phone: '06 98 76 54 32'})
      expect(await storedContactOf(TENANT_B_SLUG, 'Gérard Pommier')).toEqual(
        onB
      )
      expect(onB.email).toBe(SEED_POMMIER_EMAIL)
      expect((await accountOf(SEED_POMMIER_EMAIL)).users).toHaveLength(1)
    } finally {
      await member.context().close()
    }
  })

  test('C7 — une fiche sans parcelle voit « Mes coordonnées »', async ({
    browser,
  }) => {
    test.setTimeout(150_000)
    const name = nameOf('Coordonnees')
    const email = emailOf('coordonnees')

    const bureau = await bureauSession(browser, TENANT_A, OWNER_A)
    const member = await freshPage(browser)
    try {
      await createProfile(bureau, TENANT_A, {name, email})

      await loginByLink(member, TENANT_A, email)
      await expect(
        member.getByRole('heading', {level: 1, name: 'Votre espace membre'})
      ).toBeVisible()
      await expect(myContact(member)).toContainText(email)
      await expect(myContact(member)).toContainText('3 rue du Lavoir')
      await expect(
        member.getByRole('region', {name: 'Mes terrains'})
      ).toHaveCount(0)
    } finally {
      await member.context().close()
      await bureau.context().close()
    }
  })
})

/**
 * Un accès, plusieurs terrains — s53, critères 1 à 4 et 6 (ADR 054).
 *
 * Le seed porte Bernard Lefèvre : trois fiches chez TechCorp, une adresse, un
 * compte. Les fiches créées ici portent le marqueur de l'essai et partent au
 * nettoyage ; celles du seed ne sont jamais modifiées.
 */
const SEED_LEFEVRE_EMAIL = 'bernard.lefevre@example.test'
/** SCI Les Pins, une fiche de Marketing Pro (seed). */
const SEED_MARKETING_PROFILE = 'b1200000-0000-4000-8000-000000000001'

/** Les liens fiche ↔ compte d'une adresse, sous le scope d'une association. */
const linksOf = (slug: string, email: string) =>
  inTenant(slug, async (client) => {
    const result = await client.query<{
      member_profile_id: string
      user_id: string
    }>(
      `select a.member_profile_id, a.user_id
         from member_profile_account a
         join "user" u on u.id = a.user_id
        where lower(u.email) = lower($1)
        order by a.member_profile_id`,
      [email]
    )
    return result.rows
  })

const sharedConfirmation = (page: Page) =>
  page.getByText(/^Cette adresse est déjà celle du compte de /)

/** Ouvre « Ajouter un propriétaire » et le remplit, sans enregistrer. */
const fillNewProfile = async (
  page: Page,
  base: string,
  input: {name: string; email: string}
) => {
  await page.goto(`${base}${NEW_ROUTE}`, {waitUntil: 'networkidle'})
  await expect(
    page.getByRole('heading', {level: 1, name: 'Ajouter un propriétaire'})
  ).toBeVisible({timeout: 15_000})
  await page.getByLabel('Nom', {exact: true}).fill(input.name)
  await page.getByLabel(/^Adresse email/).fill(input.email)
  await page.getByLabel('Adresse', {exact: true}).fill('2 chemin des Chênes')
  await page.getByLabel('Code postal').fill('33680')
  await page.getByLabel('Commune').fill('Lacanau')
}

/** Crée une fiche dont l'adresse est celle d'un compte : confirme, rend l'id. */
const createLinkedProfile = async (
  page: Page,
  base: string,
  input: {name: string; email: string; accountName: string}
): Promise<string> => {
  await fillNewProfile(page, base, input)
  await page.getByRole('button', {name: 'Enregistrer le propriétaire'}).click()
  await expect(sharedConfirmation(page)).toContainText(input.accountName, {
    timeout: 15_000,
  })
  await page.getByRole('button', {name: 'Oui, relier à son compte'}).click()
  await expect(
    page.getByRole('heading', {level: 1, name: input.name})
  ).toBeVisible({timeout: 15_000})
  return new URL(page.url()).pathname.split('/').at(-1) as string
}

test.describe('Un accès, plusieurs terrains — s53', () => {
  test.beforeEach(async () => {
    await resetRateLimits()
  })

  test.afterAll(async () => {
    await cleanUpRun()
  })

  test('critères 1 et 2 — une adresse sur trois fiches : un compte, une connexion, « Mes terrains » les montre toutes', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const account = await accountOf(SEED_LEFEVRE_EMAIL)
    expect(account.users, 'une adresse, un seul compte').toHaveLength(1)
    expect(account.members).toEqual([{slug: TENANT_A_SLUG, role: 'member'}])
    const links = await linksOf(TENANT_A_SLUG, SEED_LEFEVRE_EMAIL)
    expect(links).toHaveLength(3)
    expect(new Set(links.map((link) => link.user_id))).toEqual(
      new Set([account.users[0].id])
    )

    const member = await freshPage(browser)
    try {
      await loginByLink(member, TENANT_A, SEED_LEFEVRE_EMAIL)
      await expect(
        member.getByRole('heading', {level: 1, name: 'Bonjour Bernard Lefèvre'})
      ).toBeVisible()
      await expect(
        member.getByText('· 3 terrains · Parcelles 61, 62 et 63')
      ).toBeVisible()
      await expect(myParcels(member)).toContainText(
        'Vos 3 terrains sont réunis ici : vous vous connectez une seule fois.'
      )
      for (const number of ['61', '62', '63']) {
        await expect(myParcels(member)).toContainText(`Parcelle ${number}`)
      }
      await expect(myParcels(member)).toContainText('Au nom de SCI Les Chênes')
      await expect(myParcels(member)).toContainText('Compteur non renseigné')
    } finally {
      await member.context().close()
    }
  })

  test('critère 3 — une adresse déjà celle d’un compte : refusée, rien d’écrit ; confirmée, la fiche rejoint le compte', async ({
    browser,
  }) => {
    test.setTimeout(150_000)
    const name = nameOf('Rejoint')
    const [before] = (await accountOf(SEED_LEFEVRE_EMAIL)).users

    const bureau = await bureauSession(browser, TENANT_A, OWNER_A)
    try {
      await fillNewProfile(bureau, TENANT_A, {
        name,
        email: SEED_LEFEVRE_EMAIL,
      })
      await bureau
        .getByRole('button', {name: 'Enregistrer le propriétaire'})
        .click()
      await expect(sharedConfirmation(bureau)).toContainText(
        'Cette adresse est déjà celle du compte de Bernard Lefèvre.',
        {timeout: 15_000}
      )
      await expect(
        bureau.getByText(/Rien n’a encore été enregistré\./)
      ).toBeVisible()
      await bureau
        .getByRole('button', {name: 'Non, corriger l’adresse'})
        .click()
      await expect(sharedConfirmation(bureau)).toHaveCount(0)
      await expect(bureau.getByLabel(/^Adresse email/)).toBeFocused()
      expect(
        await storedProfileOf(TENANT_A_SLUG, name),
        'refusé : aucune fiche écrite'
      ).toBeUndefined()

      const id = await createLinkedProfile(bureau, TENANT_A, {
        name,
        email: SEED_LEFEVRE_EMAIL,
        accountName: 'Bernard Lefèvre',
      })
      await expect(bureau.getByRole('status')).toContainText(
        'Fiche reliée au compte de Bernard Lefèvre : ce terrain apparaît dans son espace.'
      )
      expect(await storedProfileOf(TENANT_A_SLUG, name)).toMatchObject({
        id,
        user_id: before.id,
      })
      const after = await accountOf(SEED_LEFEVRE_EMAIL)
      expect(after.users, 'aucun compte fusionné ni créé').toEqual([before])
      await expect(emailsCard(bureau)).toContainText('Se connecte aussi à :')
    } finally {
      await bureau.context().close()
      await asMaintenance((client) =>
        client.query(`delete from member_profile where name = $1`, [name])
      )
    }
  })

  test('critère 4 — un membre ne voit que ses fiches : celle d’un autre membre et celle d’une autre association sont refusées', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const member = await freshPage(browser)
    try {
      await loginByLink(member, TENANT_A, SEED_LEFEVRE_EMAIL)
      for (const forged of [SEED_DUBOIS, SEED_MARKETING_PROFILE]) {
        await member.goto(`${TENANT_A}${LIST_ROUTE}/${forged}`, {
          waitUntil: 'networkidle',
        })
        await expect(
          member.getByRole('heading', {
            level: 1,
            name: 'Cette page ne vous est pas accessible',
          })
        ).toBeVisible({timeout: 15_000})
        await expect(member.getByText('Jean et Odile Dubois')).toHaveCount(0)
        await expect(member.getByText('SCI Les Pins')).toHaveCount(0)
      }
      await member.goto(`${TENANT_A}/dashboard`, {waitUntil: 'networkidle'})
      await expect(myParcels(member)).not.toContainText('Parcelle 47')
      await expect(myParcels(member)).not.toContainText('Parcelle 21')
    } finally {
      await member.context().close()
    }
  })

  test('critère 4 — RLS forcée : les liens d’une association sont invisibles depuis l’autre et sans scope', async () => {
    expect(await linksOf(TENANT_A_SLUG, SEED_LEFEVRE_EMAIL)).toHaveLength(3)
    expect(await linksOf(TENANT_B_SLUG, SEED_LEFEVRE_EMAIL)).toEqual([])
    const withoutScope = await withClient(async (client) => {
      const result = await client.query(`select id from member_profile_account`)
      return result.rowCount
    })
    expect(withoutScope, 'sans tenant posé, rien ne sort').toBe(0)
  })

  test('critère 4 — « Mes coordonnées » n’écrit que les fiches du compte connecté', async ({
    browser,
  }) => {
    test.setTimeout(150_000)
    const name = nameOf('Coordonnées')
    const email = emailOf('coordonnees')
    const phone = '06 53 00 00 01'

    const bureau = await bureauSession(browser, TENANT_A, OWNER_A)
    const member = await freshPage(browser)
    try {
      await createProfile(bureau, TENANT_A, {name, email})
      await attachParcel(bureau, parcelOf('C1'), '01/03/2020')
      await createLinkedProfile(bureau, TENANT_A, {
        name: nameOf('Coordonnées SCI'),
        email,
        accountName: name,
      })
      await attachParcel(bureau, parcelOf('C2'), '01/03/2020')

      await loginByLink(member, TENANT_A, email)
      const contact = member.getByRole('region', {name: 'Mes coordonnées'})
      await expect(contact).toContainText('Elles valent pour vos 2 terrains.')
      await contact
        .getByRole('button', {name: 'Modifier mes coordonnées'})
        .click()
      await contact.getByLabel(/^Téléphone/).fill(phone)
      await contact
        .getByRole('button', {name: 'Enregistrer mes coordonnées'})
        .click()
      await expect(contact.getByRole('status')).toContainText(
        'Elles valent désormais pour vos 2 terrains.',
        {timeout: 15_000}
      )

      const phones = await inTenant(TENANT_A_SLUG, async (client) => {
        const result = await client.query<{name: string; phone: string | null}>(
          `select name, phone from member_profile
            where name like $1 or id = $2
            order by name`,
          [`% s12d-${RUN}`, SEED_DUBOIS]
        )
        return result.rows
      })
      expect(phones).toHaveLength(3)
      expect(phones).toEqual(
        expect.arrayContaining([
          {name: nameOf('Coordonnées'), phone},
          {name: nameOf('Coordonnées SCI'), phone},
          {name: 'Jean et Odile Dubois', phone: null},
        ])
      )
    } finally {
      await member.context().close()
      await bureau.context().close()
    }
  })

  test('critère 6 — retirer l’adresse d’une fiche laisse l’accès aux autres ; la fiche quitte « Mes terrains »', async ({
    browser,
  }) => {
    test.setTimeout(180_000)
    const name = nameOf('Deux terrains')
    const secondName = nameOf('Deux terrains SCI')
    const email = emailOf('deux-terrains')

    const bureau = await bureauSession(browser, TENANT_A, OWNER_A)
    const member = await freshPage(browser)
    try {
      await createProfile(bureau, TENANT_A, {name, email})
      await attachParcel(bureau, parcelOf('D1'), '01/03/2020')
      await createLinkedProfile(bureau, TENANT_A, {
        name: secondName,
        email,
        accountName: name,
      })
      await attachParcel(bureau, parcelOf('D2'), '01/03/2020')

      await loginByLink(member, TENANT_A, email)
      await expect(myParcels(member)).toContainText(
        `Parcelle ${parcelOf('D1')}`
      )
      await expect(myParcels(member)).toContainText(
        `Parcelle ${parcelOf('D2')}`
      )

      const confirm = await removeProfileEmail(bureau, email)
      await expect(confirm).toBeHidden({timeout: 15_000})
      await expect(emailsNotice(bureau)).toContainText(REMOVED)
      expect((await accountOf(email)).members).toEqual([
        {slug: TENANT_A_SLUG, role: 'member'},
      ])
      expect(
        (await storedProfileOf(TENANT_A_SLUG, secondName))?.user_id
      ).toBeNull()

      // Un rechargement réel : l'accès suit la ligne `member`, toujours là.
      await member.reload()
      await expect(member).toHaveURL(`${TENANT_A}/dashboard`, {timeout: 15_000})
      await expect(
        member.getByRole('heading', {level: 1, name: `Bonjour ${name}`})
      ).toBeVisible()
      await expect(myParcels(member)).toContainText(
        `Parcelle ${parcelOf('D1')}`
      )
      await expect(myParcels(member)).not.toContainText(
        `Parcelle ${parcelOf('D2')}`
      )
    } finally {
      await member.context().close()
      await bureau.context().close()
    }
  })
})

/** Fiches du seed de s54 (`tenant-member-profiles-seed.ts`). */
const SEED_FERRAND_EMAIL = 'p.ferrand@techcorp-solutions.test'
const SEED_MEUNIER_ID = 'a1200000-0000-4000-8000-000000000001'
const SEED_FERRAND_ID = 'a1200000-0000-4000-8000-000000000005'

const myEmails = (page: Page) =>
  page.getByRole('region', {name: 'Mes adresses email'})

/** Le lien de confirmation reçu par l'adresse (s54, écran 2). */
const confirmationLinkOf = (message: OutboxMessage) => {
  const link = message.text.match(/https?:\/\/\S+\/confirmer-adresse\/\S+/)?.[0]
  expect(link, 'la version texte porte l’URL en clair').toBeTruthy()
  return link as string
}

/** Les rôles d'une adresse, fiche par fiche, lus sous le scope du tenant. */
const rolesOf = (slug: string, email: string) =>
  inTenant(slug, async (client) => {
    const result = await client.query<{
      member_profile_id: string
      role: string
      status: string
    }>(
      `select member_profile_id, role, status
         from member_profile_email
        where lower(email) = lower($1)
        order by member_profile_id`,
      [email]
    )
    return result.rows
  })

test.describe('Plusieurs adresses par membre — s54', () => {
  test.beforeEach(async () => {
    await resetRateLimits()
  })

  test.afterAll(async () => {
    await cleanUpRun()
  })

  test('critères 1, 2, 4, 5 et 10 — deux adresses ouvrent le même espace ; une adresse ajoutée par le membre ne sert qu’après le lien ; la retirer ferme cette fiche seulement', async ({
    browser,
  }) => {
    test.setTimeout(300_000)
    const name = nameOf('Multiples')
    const otherName = nameOf('Multiples autre')
    const holder = emailOf('titulaire')
    const relative = emailOf('proche')
    const added = emailOf('ajoutee')
    const number = parcelOf('E1')
    const otherNumber = parcelOf('E2')

    const bureau = await bureauSession(browser, TENANT_A, OWNER_A)
    const first = await freshPage(browser)
    const second = await freshPage(browser)
    try {
      await createProfile(bureau, TENANT_A, {name, email: holder})
      await attachParcel(bureau, number, '01/03/2020')
      await addProfileEmail(bureau, relative)
      await expect(emailsNotice(bureau)).toContainText(ADDED)
      await expect(emailsCard(bureau).getByRole('table')).toContainText(
        'Supplémentaire'
      )

      // Critère 2 : chacune se connecte et ouvre le même espace.
      for (const [page, address] of [
        [first, holder],
        [second, relative],
      ] as const) {
        await loginByLink(page, TENANT_A, address)
        await expect(
          page.getByRole('heading', {level: 1, name: `Bonjour ${name}`})
        ).toBeVisible()
        await expect(myParcels(page)).toContainText(`Parcelle ${number}`)
        await expect(myEmails(page)).toContainText(holder)
        await expect(myEmails(page)).toContainText(relative)
      }

      // Critères 4 et 5 : l'ajout par le membre attend le lien.
      const before = outboxFiles()
      await myEmails(second)
        .getByRole('button', {name: 'Ajouter une adresse'})
        .click()
      await myEmails(second).getByLabel('Nouvelle adresse email').fill(added)
      await myEmails(second)
        .getByRole('button', {name: 'Envoyer le lien de confirmation'})
        .click()
      await expect(myEmails(second).getByRole('status')).toContainText(
        `Lien envoyé à ${added}.`,
        {timeout: 15_000}
      )
      expect((await rolesOf(TENANT_A_SLUG, added))[0]).toMatchObject({
        status: 'pending',
      })
      const pendingLogin = await freshPage(browser)
      await expectNoLinkSent(pendingLogin, TENANT_A, added)
      await pendingLogin.context().close()

      await expect
        .poll(() => newMessagesTo(before, added).length, {timeout: 15_000})
        .toBe(1)
      const link = confirmationLinkOf(newMessagesTo(before, added)[0])
      const visitor = await freshPage(browser)
      await visitor.goto(link, {waitUntil: 'networkidle'})
      await expect(
        visitor.getByRole('heading', {
          level: 1,
          name: 'Confirmer votre adresse',
        })
      ).toBeVisible({timeout: 15_000})
      expect(
        (await rolesOf(TENANT_A_SLUG, added))[0],
        'le chargement du lien ne confirme rien'
      ).toMatchObject({status: 'pending'})
      await visitor
        .getByRole('button', {name: 'Confirmer cette adresse'})
        .click()
      await expect(visitor.getByRole('status')).toContainText(
        'Adresse confirmée.',
        {timeout: 15_000}
      )
      await visitor.context().close()
      expect((await rolesOf(TENANT_A_SLUG, added))[0]).toMatchObject({
        role: 'additional',
        status: 'active',
      })

      const third = await freshPage(browser)
      await loginByLink(third, TENANT_A, added)
      await expect(
        third.getByRole('heading', {level: 1, name: `Bonjour ${name}`})
      ).toBeVisible()
      await third.context().close()

      // Critère 10 : l'adresse retirée perd cette fiche, garde les autres.
      await createLinkedProfile(bureau, TENANT_A, {
        name: otherName,
        email: relative,
        accountName: name,
      })
      await attachParcel(bureau, otherNumber, '01/03/2020')
      const fiche = await storedProfileOf(TENANT_A_SLUG, name)
      await bureau.goto(`${TENANT_A}${LIST_ROUTE}/${fiche?.id}`, {
        waitUntil: 'networkidle',
      })
      await removeProfileEmail(bureau, relative)
      await expect(emailsNotice(bureau)).toContainText(REMOVED)

      await second.reload()
      await expect(second).toHaveURL(`${TENANT_A}/dashboard`, {
        timeout: 15_000,
      })
      await expect(myParcels(second)).toContainText(`Parcelle ${otherNumber}`)
      await expect(myParcels(second)).not.toContainText(`Parcelle ${number}`)

      await first.reload()
      await expect(myParcels(first)).toContainText(`Parcelle ${number}`)
    } finally {
      await first.context().close()
      await second.context().close()
      await bureau.context().close()
    }
  })

  test('critère 8 — une adresse titulaire d’une fiche et supplémentaire d’une autre, lue par le bureau', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    expect(await rolesOf(TENANT_A_SLUG, SEED_FERRAND_EMAIL)).toEqual(
      [
        {
          member_profile_id: SEED_MEUNIER_ID,
          role: 'additional',
          status: 'active',
        },
        {
          member_profile_id: SEED_FERRAND_ID,
          role: 'holder',
          status: 'active',
        },
      ].sort((a, b) => a.member_profile_id.localeCompare(b.member_profile_id))
    )
    const [account] = (await accountOf(SEED_FERRAND_EMAIL)).users
    const links = await linksOf(TENANT_A_SLUG, SEED_FERRAND_EMAIL)
    expect(links.map((link) => link.member_profile_id).sort()).toEqual(
      [SEED_MEUNIER_ID, SEED_FERRAND_ID].sort()
    )
    expect(new Set(links.map((link) => link.user_id))).toEqual(
      new Set([account.id])
    )

    const bureau = await bureauSession(browser, TENANT_A, OWNER_A)
    try {
      for (const [id, role] of [
        [SEED_MEUNIER_ID, 'Supplémentaire'],
        [SEED_FERRAND_ID, 'Titulaire'],
      ] as const) {
        await bureau.goto(`${TENANT_A}${LIST_ROUTE}/${id}`, {
          waitUntil: 'networkidle',
        })
        const row = emailsCard(bureau)
          .getByRole('table')
          .getByRole('row')
          .filter({hasText: SEED_FERRAND_EMAIL})
        await expect(row).toContainText(role, {timeout: 15_000})
        await expect(row).toContainText('Saisie sur le site')
      }
    } finally {
      await bureau.context().close()
    }
  })
})
