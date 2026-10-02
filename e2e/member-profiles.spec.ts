/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import path from 'node:path'

import {Browser, expect, Locator, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Propriétaires et parcelles — s12, critères 1 à 8 et isolation entre
 * associations (ADR 029).
 *
 * Ce que seuls un navigateur, deux domaines et une vraie base prouvent : la
 * lecture datée **réelle** du propriétaire d'une parcelle (la requête du DAO,
 * rejouée en SQL sous le scope du tenant), l'immuabilité d'une période close
 * (instantané SQL avant / après une vente faite à l'écran), l'absence de tout
 * compte créé par une fiche, et la RLS forcée sur les trois tables.
 *
 * `localhost` sert TechCorp Solutions, `127.0.0.1` Marketing Pro (seed). Le
 * seed porte la parcelle 47 de TechCorp vendue : Dubois du 03/02/1998, Roy à
 * partir du 15/06/2026. La spec ne modifie **jamais** les lignes du seed : ses
 * écritures portent un marqueur d'essai, nettoyé à la fin.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
/** TechCorp Solutions dans le seed. */
const TENANT_A = `http://localhost:${PORT}`
/** Marketing Pro dans le seed. */
const TENANT_B = `http://127.0.0.1:${PORT}`

const PASSWORD = 'Azerty123'
/** Présidente de TechCorp Solutions. */
const OWNER_A = 'user-owner@gmail.com'
/** Membre du bureau (rôle `board`) de Marketing Pro. */
const BOARD_B = 'user-admin@gmail.com'

const LIST_ROUTE = '/fr/bureau/proprietaires'
const NEW_ROUTE = '/fr/bureau/proprietaires/nouveau'

/** Fiches du seed de TechCorp (`tenant-member-profiles-seed.ts`). */
const SEED_DUBOIS = 'a1200000-0000-4000-8000-000000000002'
const SEED_ROY = 'a1200000-0000-4000-8000-000000000003'

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
const nameOf = (label: string) => `${label} s12-${RUN}`
/**
 * Un numéro de parcelle propre à cet essai (30 caractères au plus), en
 * majuscules : c'est sous cette forme que le service l'enregistre.
 */
const PARCEL_PREFIX = `E${RUN.toUpperCase()}-`
const parcelOf = (suffix: string) => `${PARCEL_PREFIX}${suffix}`

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

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

type StoredProfile = {
  id: string
  name: string
  email: string | null
  phone: string | null
  address_line: string | null
  postal_code: string | null
  city: string | null
  mail_only: boolean
}

/** La fiche de TechCorp qui porte ce nom, lue sous son scope. */
const storedProfileOfTenantA = async (
  name: string
): Promise<StoredProfile | undefined> => {
  const {a} = await tenantIds()
  return inTenantScope(a, async (client) => {
    const result = await client.query<StoredProfile>(
      `select id, name, email, phone, address_line, postal_code, city, mail_only
         from member_profile where name = $1`,
      [name]
    )
    return result.rows[0]
  })
}

type StoredPeriod = {
  id: string
  parcel_id: string
  member_profile_id: string
  starts_on: string
  ends_on: string | null
  created_at: string
}

/** Les périodes d'une parcelle de TechCorp, de la plus ancienne à la plus récente. */
const periodsOfParcelA = async (number: string): Promise<StoredPeriod[]> => {
  const {a} = await tenantIds()
  return inTenantScope(a, async (client) => {
    const result = await client.query<StoredPeriod>(
      `select po.id, po.parcel_id, po.member_profile_id,
              po.starts_on::text as starts_on, po.ends_on::text as ends_on,
              po.created_at::text as created_at
         from parcel_ownership po
         join parcel p on p.id = po.parcel_id
        where p.number = $1
        order by po.starts_on, po.id`,
      [number]
    )
    return result.rows
  })
}

/**
 * Le propriétaire d'une parcelle à une date : **la requête de
 * `getParcelOwnerAtDao`**, rejouée telle quelle sous le scope du tenant —
 * période demi-ouverte `[starts_on, ends_on)`.
 */
const ownerAt = async (
  organizationId: string,
  parcelId: string,
  date: string
): Promise<string | undefined> =>
  inTenantScope(organizationId, async (client) => {
    const result = await client.query<{id: string}>(
      `select mp.id
         from parcel_ownership po
         join member_profile mp on mp.id = po.member_profile_id
        where po.parcel_id = $1
          and po.starts_on <= $2
          and (po.ends_on is null or po.ends_on > $2)`,
      [parcelId, date]
    )
    expect(
      result.rowCount,
      'une parcelle n’a jamais deux propriétaires le même jour'
    ).toBeLessThanOrEqual(1)
    return result.rows[0]?.id
  })

/**
 * Les comptes et les appartenances qu'une fiche aurait pu faire naître : un
 * `user` portant son nom ou son email, et ses lignes `member`. s12 n'en crée
 * aucun. La recherche est ciblée, pour ne pas dépendre des comptes que
 * d'autres specs créent en parallèle.
 */
const accountsBornFrom = (input: {name: string; email?: string}) =>
  withAppRoleClient(async (client) => {
    const result = await client.query<{users: number; members: number}>(
      `select count(distinct u.id)::int as users, count(m.id)::int as members
         from "user" u
         left join member m on m.user_id = u.id
        where u.name = $1 or lower(u.email) = lower($2)`,
      [input.name, input.email ?? '']
    )
    return result.rows[0]
  })

/** Chaque essai nettoie ce qu'il a écrit : une base locale se relit deux fois. */
const cleanUpRun = () =>
  asMaintenance(async (client) => {
    await client.query(
      `delete from parcel_ownership
        where member_profile_id in (select id from member_profile where name like $1)
           or parcel_id in (select id from parcel where number like $2)`,
      [`% s12-${RUN}`, `${PARCEL_PREFIX}%`]
    )
    await client.query(`delete from parcel where number like $1`, [
      `${PARCEL_PREFIX}%`,
    ])
    await client.query(`delete from member_profile where name like $1`, [
      `% s12-${RUN}`,
    ])
  })

const login = async (page: Page, base: string, email: string) => {
  await page.goto(`${base}/fr/login/prestataire`)
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

const openList = async (page: Page, base: string, search?: string) => {
  const query = search ? `?q=${encodeURIComponent(search)}` : ''
  await page.goto(`${base}${LIST_ROUTE}${query}`, {waitUntil: 'networkidle'})
  await expect(
    page.getByRole('heading', {level: 1, name: 'Propriétaires'})
  ).toBeVisible({timeout: 15_000})
}

type ProfileInput = {
  name: string
  email?: string
  phone?: string
  addressLine?: string
  postalCode?: string
  city?: string
}

/** Crée une fiche à l'écran et attend sa fiche ; rend son identifiant. */
const createProfile = async (
  page: Page,
  input: ProfileInput
): Promise<string> => {
  await page.goto(`${TENANT_A}${NEW_ROUTE}`, {waitUntil: 'networkidle'})
  await expect(
    page.getByRole('heading', {level: 1, name: 'Ajouter un propriétaire'})
  ).toBeVisible({timeout: 15_000})

  await page.getByLabel('Nom', {exact: true}).fill(input.name)
  if (input.email) await page.getByLabel(/^Adresse email/).fill(input.email)
  if (input.phone) await page.getByLabel(/^Téléphone/).fill(input.phone)
  if (input.addressLine) {
    await page.getByLabel('Adresse', {exact: true}).fill(input.addressLine)
  }
  if (input.postalCode) {
    await page.getByLabel('Code postal').fill(input.postalCode)
  }
  if (input.city) await page.getByLabel('Commune').fill(input.city)

  await page.getByRole('button', {name: 'Enregistrer le propriétaire'}).click()

  await expect(
    page.getByRole('heading', {level: 1, name: input.name})
  ).toBeVisible({timeout: 15_000})
  await expect(page.getByRole('status')).toContainText(
    'Propriétaire enregistré.'
  )

  const id = new URL(page.url()).pathname.split('/').at(-1) as string
  expect(id).toMatch(UUID_PATTERN)
  return id
}

const openProfile = async (page: Page, base: string, id: string) => {
  await page.goto(`${base}${LIST_ROUTE}/${id}`, {waitUntil: 'networkidle'})
}

const attachDialog = (page: Page) => page.getByRole('dialog')

/** Ouvre le `dialog` de rattachement, le remplit et le soumet. */
const submitAttachment = async (
  page: Page,
  input: {number: string; startsOn: string}
) => {
  await page.getByRole('button', {name: 'Rattacher une parcelle'}).click()
  const dialog = attachDialog(page)
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Numéro de parcelle').fill(input.number)
  await dialog.getByLabel('Propriétaire depuis le').fill(input.startsOn)
  await dialog.getByRole('button', {name: 'Rattacher la parcelle'}).click()
}

const attachParcel = async (
  page: Page,
  input: {number: string; startsOn: string}
) => {
  await submitAttachment(page, input)
  await expect(attachDialog(page)).toBeHidden({timeout: 15_000})
  await expect(page.getByRole('status')).toContainText(
    `Parcelle ${input.number}`
  )
}

const currentParcels = (page: Page): Locator =>
  page.getByRole('table', {name: 'Parcelles actuelles'})

const formerParcels = (page: Page): Locator =>
  page.getByRole('table', {name: 'Anciennes parcelles'})

const listRowOf = (page: Page, name: string): Locator =>
  page.getByRole('row').filter({hasText: name})

test.describe('Propriétaires — fiches, parcelles et ventes', () => {
  test.afterAll(async () => {
    await cleanUpRun()
  })

  test('critères 1 et 5 — une fiche créée, deux parcelles rattachées, une seule ligne ; identifiant sans rapport avec l’email ni les numéros', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const name = nameOf('Deux parcelles')
    const email = `deux-parcelles-${RUN}@example.test`
    const first = parcelOf('1')
    const second = parcelOf('2')

    const bureau = await newSession(browser, TENANT_A, OWNER_A)
    try {
      const id = await createProfile(bureau, {
        name,
        email,
        addressLine: '14 allée des Aulnes',
        postalCode: '33680',
        city: 'Lacanau',
      })

      await attachParcel(bureau, {number: first, startsOn: '03/02/1998'})
      await attachParcel(bureau, {number: second, startsOn: '11/09/2009'})
      await expect(bureau.getByRole('status')).toContainText(
        `Parcelle ${second} ajoutée et rattachée à ${name} depuis le 11/09/2009.`
      )

      await bureau.reload({waitUntil: 'networkidle'})
      const rows = currentParcels(bureau).getByRole('row')
      await expect(rows.filter({hasText: first})).toContainText('03/02/1998')
      await expect(rows.filter({hasText: second})).toContainText('11/09/2009')

      const stored = await storedProfileOfTenantA(name)
      expect(stored?.id).toBe(id)
      expect(stored?.id).toMatch(UUID_PATTERN)
      expect(stored?.id).not.toContain(RUN)
      expect(stored?.id).not.toContain(email.split('@')[0])
      expect(stored?.email).toBe(email)
      expect(stored?.mail_only).toBe(false)

      const firstPeriods = await periodsOfParcelA(first)
      const secondPeriods = await periodsOfParcelA(second)
      expect(firstPeriods).toHaveLength(1)
      expect(secondPeriods).toHaveLength(1)
      expect(firstPeriods[0]).toMatchObject({
        member_profile_id: id,
        starts_on: '1998-02-03',
        ends_on: null,
      })
      expect(secondPeriods[0]).toMatchObject({
        member_profile_id: id,
        starts_on: '2009-09-11',
        ends_on: null,
      })

      await openList(bureau, TENANT_A, name)
      const row = listRowOf(bureau, name)
      await expect(row).toHaveCount(1)
      await expect(row).toContainText(`${first}, ${second}`)
      await expect(row).toContainText(email)
    } finally {
      await bureau.context().close()
    }
  })

  test('critère 3 — la parcelle 47 du seed : la veille de la vente rend le vendeur, le jour même et après rendent l’acquéreur', async () => {
    const {a} = await tenantIds()
    const periods = await periodsOfParcelA('47')

    expect(
      periods.map((period) => [
        period.member_profile_id,
        period.starts_on,
        period.ends_on,
      ])
    ).toEqual([
      [SEED_DUBOIS, '1998-02-03', '2026-06-15'],
      [SEED_ROY, '2026-06-15', null],
    ])

    const parcelId = periods[0].parcel_id
    expect(await ownerAt(a, parcelId, '1998-02-02')).toBeUndefined()
    expect(await ownerAt(a, parcelId, '1998-02-03')).toBe(SEED_DUBOIS)
    expect(await ownerAt(a, parcelId, '2026-06-14')).toBe(SEED_DUBOIS)
    expect(await ownerAt(a, parcelId, '2026-06-15')).toBe(SEED_ROY)
    expect(await ownerAt(a, parcelId, '2031-01-01')).toBe(SEED_ROY)
  })

  test('critères 2 et 3 — une vente à l’écran : la période du vendeur ne reçoit que sa fin, celle de l’acquéreur s’ouvre le même jour', async ({
    browser,
  }) => {
    test.setTimeout(150_000)
    const {a} = await tenantIds()
    const sellerName = nameOf('Vendeur')
    const buyerName = nameOf('Acquéreur')
    const number = parcelOf('V')

    const bureau = await newSession(browser, TENANT_A, OWNER_A)
    try {
      const buyerId = await createProfile(bureau, {name: buyerName})
      const sellerId = await createProfile(bureau, {
        name: sellerName,
        addressLine: '8 chemin des Pins',
        postalCode: '33680',
        city: 'Lacanau',
      })
      await attachParcel(bureau, {number, startsOn: '01/03/2020'})

      const [before] = await periodsOfParcelA(number)
      expect(before).toMatchObject({
        member_profile_id: sellerId,
        starts_on: '2020-03-01',
        ends_on: null,
      })

      await bureau.reload({waitUntil: 'networkidle'})
      await currentParcels(bureau)
        .getByRole('row')
        .filter({hasText: number})
        .getByRole('link', {name: 'Enregistrer une vente'})
        .click()
      await expect(
        bureau.getByRole('heading', {
          level: 1,
          name: `Enregistrer la vente de la parcelle ${number}`,
        })
      ).toBeVisible({timeout: 15_000})

      await bureau.getByLabel('Date de la vente').fill('15/06/2026')
      await bureau.getByRole('combobox', {name: /Acquéreur/}).click()
      await bureau.getByLabel('Nom du propriétaire').fill(buyerName)
      await bureau.getByRole('option', {name: new RegExp(buyerName)}).click()

      const changes = bureau.getByRole('region', {name: 'Ce qui va changer'})
      await expect(changes).toContainText(
        `Vendeur : ${sellerName}, propriétaire du 01/03/2020 au 14/06/2026.`
      )
      await expect(changes).toContainText(
        `Acquéreur : ${buyerName}, propriétaire à partir du 15/06/2026.`
      )
      const announced = await changes
        .locator('[data-slot="sale-changes"]')
        .innerText()

      await bureau.getByRole('button', {name: 'Enregistrer la vente'}).click()
      const confirmation = bureau.getByRole('alertdialog')
      await expect(confirmation).toBeVisible()
      expect(
        await confirmation.locator('[data-slot="sale-changes"]').innerText()
      ).toBe(announced)
      await confirmation
        .getByRole('button', {name: 'Enregistrer la vente'})
        .click()

      await expect(
        bureau.getByRole('heading', {level: 1, name: sellerName})
      ).toBeVisible({timeout: 15_000})
      await expect(bureau.getByRole('status')).toContainText(
        `Vente enregistrée. La parcelle ${number} est à ${buyerName} depuis le 15/06/2026.`
      )
      await expect(bureau.getByText('Aucune parcelle actuelle.')).toBeVisible()
      const formerRow = formerParcels(bureau)
        .getByRole('row')
        .filter({hasText: number})
      await expect(formerRow).toContainText('du 01/03/2020 au 14/06/2026')
      await expect(formerRow.getByRole('link', {name: buyerName})).toBeVisible()
      await expect(formerRow.getByRole('button')).toHaveCount(0)

      // La seule écriture sur la ligne du vendeur est sa date de fin.
      const after = await periodsOfParcelA(number)
      expect(after).toHaveLength(2)
      const sellerPeriod = after.find((period) => period.id === before.id)
      expect(sellerPeriod).toEqual({...before, ends_on: '2026-06-15'})
      const buyerPeriod = after.find((period) => period.id !== before.id)
      expect(buyerPeriod).toMatchObject({
        parcel_id: before.parcel_id,
        member_profile_id: buyerId,
        starts_on: '2026-06-15',
        ends_on: null,
      })

      // La lecture datée, par la requête réelle.
      expect(await ownerAt(a, before.parcel_id, '2020-02-29')).toBeUndefined()
      expect(await ownerAt(a, before.parcel_id, '2026-06-14')).toBe(sellerId)
      expect(await ownerAt(a, before.parcel_id, '2026-06-15')).toBe(buyerId)
      expect(await ownerAt(a, before.parcel_id, '2030-01-01')).toBe(buyerId)

      // La parcelle se lit des deux côtés.
      await openProfile(bureau, TENANT_A, buyerId)
      await expect(
        currentParcels(bureau).getByRole('row').filter({hasText: number})
      ).toContainText('15/06/2026')
    } finally {
      await bureau.context().close()
    }
  })

  test('critère 4 — rattacher la parcelle 47 à un troisième propriétaire pendant que Roy la possède est refusé, rien n’est écrit', async ({
    browser,
  }) => {
    test.setTimeout(90_000)
    const name = nameOf('Troisième')
    const before = await periodsOfParcelA('47')

    const bureau = await newSession(browser, TENANT_A, OWNER_A)
    try {
      await createProfile(bureau, {name})
      await submitAttachment(bureau, {number: '47', startsOn: '01/09/2026'})

      const alert = attachDialog(bureau).getByRole('alert')
      await expect(alert).toContainText(
        'La parcelle 47 appartient à Hélène Roy depuis le 15/06/2026. Elle ne peut pas avoir deux propriétaires en même temps.'
      )
      await expect(
        alert.getByRole('link', {name: 'Ouvrir la fiche de Hélène Roy'})
      ).toBeVisible()
      await expect(
        attachDialog(bureau).getByLabel('Numéro de parcelle')
      ).toHaveValue('47')

      expect(await periodsOfParcelA('47')).toEqual(before)

      // Une date dans la période close du vendeur est refusée de même.
      await attachDialog(bureau)
        .getByLabel('Propriétaire depuis le')
        .fill('01/01/2010')
      await attachDialog(bureau)
        .getByRole('button', {name: 'Rattacher la parcelle'})
        .click()
      await expect(attachDialog(bureau).getByRole('alert')).toContainText(
        'La parcelle 47 appartenait à Jean et Odile Dubois du 03/02/1998 au 14/06/2026.'
      )
      expect(await periodsOfParcelA('47')).toEqual(before)
    } finally {
      await bureau.context().close()
    }
  })

  test('date future — un rattachement daté de l’an prochain est refusé sous le champ de date, rien n’est écrit', async ({
    browser,
  }) => {
    test.setTimeout(90_000)
    const {a} = await tenantIds()
    const name = nameOf('Date future')
    const number = parcelOf('F')
    const nextYear = new Date().getFullYear() + 1

    const bureau = await newSession(browser, TENANT_A, OWNER_A)
    try {
      const id = await createProfile(bureau, {name})
      await submitAttachment(bureau, {
        number,
        startsOn: `01/01/${nextYear}`,
      })

      const dialog = attachDialog(bureau)
      await expect(
        dialog.getByText(
          'Cette date ne peut pas être postérieure à aujourd’hui.'
        )
      ).toBeVisible()
      await expect(dialog.getByLabel('Propriétaire depuis le')).toHaveAttribute(
        'aria-invalid',
        'true'
      )
      await expect(dialog.getByLabel('Numéro de parcelle')).toHaveValue(number)

      const written = await inTenantScope(a, async (client) => {
        const result = await client.query<{parcels: number; periods: number}>(
          `select (select count(*)::int from parcel where number = $1) as parcels,
                  (select count(*)::int from parcel_ownership
                    where member_profile_id = $2) as periods`,
          [number, id]
        )
        return result.rows[0]
      })
      expect(written).toEqual({parcels: 0, periods: 0})
    } finally {
      await bureau.context().close()
    }
  })

  test('critères 6, 7 et 8 — sans email : courrier uniquement et aucun compte ; sans adresse : fiche incomplète, jusqu’à ce qu’on l’ajoute', async ({
    browser,
  }) => {
    test.setTimeout(150_000)
    const name = nameOf('Courrier')
    const email = `courrier-${RUN}@example.test`

    const bureau = await newSession(browser, TENANT_A, OWNER_A)
    try {
      const id = await createProfile(bureau, {name})

      await expect(
        bureau.getByText('Courrier uniquement', {exact: true})
      ).toBeVisible()
      await expect(
        bureau.getByText('Fiche incomplète', {exact: true})
      ).toBeVisible()
      await expect(
        bureau.getByText(
          'Cette fiche n’a ni adresse email ni adresse postale : aucun envoi ne peut atteindre ce propriétaire.'
        )
      ).toBeVisible()

      const created = await storedProfileOfTenantA(name)
      expect(created).toMatchObject({
        id,
        email: null,
        phone: null,
        address_line: null,
        postal_code: null,
        city: null,
        mail_only: true,
      })
      expect(
        await accountsBornFrom({name}),
        'une fiche ne crée ni compte ni appartenance'
      ).toEqual({users: 0, members: 0})

      await openList(bureau, TENANT_A, name)
      const row = listRowOf(bureau, name)
      await expect(row).toContainText('Courrier uniquement')
      await expect(row).toContainText('Fiche incomplète')

      // Ajouter une adresse postale depuis la fiche : le signalement tombe.
      await openProfile(bureau, TENANT_A, id)
      await bureau
        .getByRole('button', {name: 'Ajouter une adresse postale'})
        .click()
      await bureau.getByLabel('Adresse', {exact: true}).fill('3 rue du Lavoir')
      await bureau.getByLabel('Code postal').fill('33680')
      await bureau.getByLabel('Commune').fill('Lacanau')
      await bureau
        .getByRole('button', {name: 'Enregistrer les coordonnées'})
        .click()
      await expect(bureau.getByRole('status')).toContainText(
        'Coordonnées enregistrées.'
      )

      await bureau.reload({waitUntil: 'networkidle'})
      await expect(
        bureau.getByText('Courrier uniquement', {exact: true})
      ).toBeVisible()
      await expect(
        bureau.getByText('Fiche incomplète', {exact: true})
      ).toHaveCount(0)
      await expect(bureau.getByText('3 rue du Lavoir')).toBeVisible()

      await openList(bureau, TENANT_A, name)
      await expect(listRowOf(bureau, name)).toContainText('Courrier uniquement')
      await expect(listRowOf(bureau, name)).not.toContainText(
        'Fiche incomplète'
      )

      // Modifier téléphone et email : relus à l'écran et en base.
      await openProfile(bureau, TENANT_A, id)
      await bureau
        .getByRole('button', {name: 'Modifier les coordonnées'})
        .click()
      await bureau.getByLabel(/^Téléphone/).fill('06 12 34 56 78')
      await bureau.getByLabel(/^Adresse email/).fill(email)
      await bureau
        .getByRole('button', {name: 'Enregistrer les coordonnées'})
        .click()
      await expect(bureau.getByRole('status')).toContainText(
        'Coordonnées enregistrées.'
      )

      await bureau.reload({waitUntil: 'networkidle'})
      await expect(bureau.getByText(email)).toBeVisible()
      await expect(bureau.getByText('06 12 34 56 78')).toBeVisible()
      await expect(
        bureau.getByText('Courrier uniquement', {exact: true})
      ).toHaveCount(0)

      expect(await storedProfileOfTenantA(name)).toMatchObject({
        id,
        email,
        phone: '06 12 34 56 78',
        address_line: '3 rue du Lavoir',
        postal_code: '33680',
        city: 'Lacanau',
        mail_only: false,
      })
      expect(
        await accountsBornFrom({name, email}),
        'renseigner un email n’ouvre aucun compte (s12d)'
      ).toEqual({users: 0, members: 0})
    } finally {
      await bureau.context().close()
    }
  })
})

test.describe('Propriétaires — isolation entre associations', () => {
  test.afterAll(async () => {
    await cleanUpRun()
  })

  test('les fiches et les parcelles de TechCorp sont absentes chez Marketing Pro, et sa fiche n’y est pas servie', async ({
    browser,
  }) => {
    test.setTimeout(150_000)
    const name = nameOf('Réservé à TechCorp')
    const number = parcelOf('I')

    const bureauA = await newSession(browser, TENANT_A, OWNER_A)
    let profileId: string
    try {
      profileId = await createProfile(bureauA, {name})
      await attachParcel(bureauA, {number, startsOn: '01/01/2021'})
    } finally {
      await bureauA.context().close()
    }

    const boardB = await newSession(browser, TENANT_B, BOARD_B)
    try {
      await openList(boardB, TENANT_B)
      await expect(listRowOf(boardB, 'SCI Les Pins')).toBeVisible()
      await expect(boardB.getByText(name)).toHaveCount(0)
      await expect(boardB.getByText('Jean et Odile Dubois')).toHaveCount(0)

      await openList(boardB, TENANT_B, name)
      await expect(
        boardB.getByText(`Aucun propriétaire ne correspond à « ${name} ».`, {
          exact: false,
        })
      ).toBeVisible()

      await openList(boardB, TENANT_B, number)
      await expect(boardB.getByText(name)).toHaveCount(0)

      // La fiche de TechCorp, demandée sur le domaine de Marketing Pro.
      await openProfile(boardB, TENANT_B, profileId)
      await expect(boardB.getByText(name)).toHaveCount(0)
      await expect(boardB.getByText(number)).toHaveCount(0)
      await expect(
        boardB.getByRole('button', {name: 'Rattacher une parcelle'})
      ).toHaveCount(0)
    } finally {
      await boardB.context().close()
    }
  })

  test('la RLS refuse de lire une fiche, une parcelle et une période depuis le scope de l’autre association', async () => {
    const ids = await tenantIds()
    const [periodOfA] = await periodsOfParcelA('47')

    const seenFromB = await inTenantScope(ids.b, async (client) => ({
      profile: await client.query(
        `select id from member_profile where id = $1`,
        [SEED_DUBOIS]
      ),
      parcel: await client.query(`select id from parcel where id = $1`, [
        periodOfA.parcel_id,
      ]),
      ownership: await client.query(
        `select id from parcel_ownership where id = $1`,
        [periodOfA.id]
      ),
      profilesOfA: await client.query(
        `select id from member_profile where organization_id = $1`,
        [ids.a]
      ),
    }))
    expect(seenFromB.profile.rowCount, 'un oubli de scope ne fuite pas').toBe(0)
    expect(seenFromB.parcel.rowCount).toBe(0)
    expect(seenFromB.ownership.rowCount).toBe(0)
    expect(seenFromB.profilesOfA.rowCount).toBe(0)

    const withoutScope = await withAppRoleClient(async (client) => ({
      profiles: await client.query(`select id from member_profile`),
      parcels: await client.query(`select id from parcel`),
      ownerships: await client.query(`select id from parcel_ownership`),
    }))
    expect(withoutScope.profiles.rowCount).toBe(0)
    expect(withoutScope.parcels.rowCount).toBe(0)
    expect(withoutScope.ownerships.rowCount).toBe(0)

    // Écrire chez l'autre association depuis son propre scope est refusé.
    await expect(
      inTenantScope(ids.b, (client) =>
        client.query(
          `insert into member_profile (organization_id, name) values ($1, $2)`,
          [ids.a, nameOf('Intrus')]
        )
      )
    ).rejects.toThrow(/row-level security/)
  })

  test('la parcelle 47 de Marketing Pro n’est pas celle de TechCorp : même numéro, deux parcelles, deux propriétaires', async () => {
    const ids = await tenantIds()

    const parcelOfB = await inTenantScope(ids.b, async (client) => {
      const result = await client.query<{id: string; owner: string}>(
        `select p.id, mp.name as owner
           from parcel p
           join parcel_ownership po on po.parcel_id = p.id and po.ends_on is null
           join member_profile mp on mp.id = po.member_profile_id
          where p.number = '47'`
      )
      return result.rows
    })
    const [periodOfA] = await periodsOfParcelA('47')

    expect(parcelOfB).toHaveLength(1)
    expect(parcelOfB[0].owner).toBe('SCI Les Pins')
    expect(parcelOfB[0].id).not.toBe(periodOfA.parcel_id)

    // La lecture datée de la parcelle de TechCorp, depuis Marketing Pro : rien.
    expect(
      await ownerAt(ids.b, periodOfA.parcel_id, '2026-06-15')
    ).toBeUndefined()
    // Et la sienne ne rend que son propre propriétaire.
    expect(await ownerAt(ids.b, parcelOfB[0].id, '2026-06-15')).toBeTruthy()
    expect(await ownerAt(ids.a, parcelOfB[0].id, '2026-06-15')).toBeUndefined()
  })
})
