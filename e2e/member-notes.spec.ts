/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {Browser, expect, Locator, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Notes internes et échanges d'un membre — s24, critères 1 à 5 et isolation
 * entre associations (ADR 050).
 *
 * Ce que seuls un navigateur, deux domaines et une vraie base prouvent : une
 * note retrouvée après rechargement, un échange classé au jour choisi dans le
 * fil mêlé, la mention « Modifiée le » sans changement d'auteur, l'étanchéité
 * côté membre (Lucie Moreau, connectée par un vrai lien), et la RLS forcée sur
 * `member_note` attaquée en direct sous le rôle applicatif.
 *
 * `localhost` sert TechCorp Solutions, `127.0.0.1` Marketing Pro (seed). La
 * spec ne crée que des notes portant son marqueur d'essai, sur la fiche de
 * Moreau du seed, et les efface à la fin.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
/** TechCorp Solutions dans le seed ; Marketing Pro est servie sur 127.0.0.1. */
const TENANT_A = `http://localhost:${PORT}`

const PASSWORD = 'Azerty123'
/** Présidente de TechCorp Solutions. */
const OWNER_A = 'user-owner@gmail.com'

/** Fiche et compte `member` de Lucie Moreau chez TechCorp (seed). */
const SEED_MOREAU = {
  email: 'lucie.moreau@example.test',
  profileId: 'a1200000-0000-4000-8000-000000000006',
}
/** Fiche de Marketing Pro (seed). */
const SEED_SCI_PINS = 'b1200000-0000-4000-8000-000000000001'

const PROFILE_ROUTE = (id: string) => `/bureau/proprietaires/${id}`
const DENIED_TEXT = 'Elle est réservée au bureau de l’association.'
const LINK_SENT_TITLE = 'Consultez votre boîte mail'

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
const MARKER = `s24-${RUN}`
const textOf = (label: string) => `${label} ${MARKER}`

const VISITOR_RUN = Date.now().toString(16).slice(-4)
let visitorCount = 0
/** Adresse IPv6 de documentation, propre à cet essai et à cette session. */
const nextVisitorIp = () =>
  `2001:db8:524:${VISITOR_RUN}::${(++visitorCount).toString(16)}`

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

type StoredNote = {
  id: string
  kind: string
  channel: string | null
  entry_date: string
  author_name: string | null
  updated_at: string | null
}

/** Les notes de l'essai sur la fiche de Moreau, lues sous le scope de TechCorp. */
const storedNotesOfRun = async (): Promise<StoredNote[]> => {
  const {a} = await tenantIds()
  return inTenantScope(a, async (client) => {
    const result = await client.query<StoredNote>(
      `select id, kind, channel, entry_date::text as entry_date, author_name,
              updated_at::text as updated_at
         from member_note
        where member_profile_id = $1 and body like $2
        order by entry_date desc, created_at desc, id desc`,
      [SEED_MOREAU.profileId, `%${MARKER}%`]
    )
    return result.rows
  })
}

/** Chaque essai efface ses notes : une base locale se relit deux fois. */
const cleanUpRun = () =>
  asMaintenance((client) =>
    client.query(`delete from member_note where body like $1`, [`%${MARKER}%`])
  )

/** Le jour calendaire de Paris, `jj/mm/aaaa`, décalé de `years` années. */
const parisDay = (years = 0): string => {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .split('-')
  return `${day}/${month}/${Number(year) + years}`
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

/** Un membre, connecté par le lien reçu, arrivé sur son espace. */
const newMemberSession = async (
  browser: Browser,
  base: string,
  email: string
) => {
  const context = await browser.newContext({
    locale: 'fr-FR',
    extraHTTPHeaders: {'x-forwarded-for': nextVisitorIp()},
  })
  await context.addCookies([{name: 'NEXT_LOCALE', value: 'fr', url: base}])
  const page = await context.newPage()
  const before = outboxFiles()
  await page.goto(`${base}/login`, {waitUntil: 'networkidle'})
  const address = page.getByLabel('Adresse email')
  await address.fill(email)
  await expect(address).toHaveValue(email)
  await page
    .getByRole('button', {name: 'Recevoir mon lien de connexion'})
    .click()
  await expect(
    page.getByRole('heading', {level: 1, name: LINK_SENT_TITLE})
  ).toBeVisible({timeout: 15_000})
  await expect
    .poll(() => messagesTo(before, email).length, {timeout: 10_000})
    .toBe(1)
  const link = messagesTo(before, email)[0].text.match(
    /https?:\/\/\S+\/magic-link\/verify\?\S+/
  )?.[0]
  expect(link, 'la version texte porte l’URL en clair').toBeTruthy()
  await page.goto(link as string)
  await expect(page).toHaveURL(`${base}/dashboard`, {timeout: 15_000})
  return page
}

const openMoreau = async (page: Page) => {
  await page.goto(`${TENANT_A}${PROFILE_ROUTE(SEED_MOREAU.profileId)}`, {
    waitUntil: 'networkidle',
  })
  await expect(
    page.getByRole('heading', {level: 2, name: 'Notes et échanges'})
  ).toBeVisible({timeout: 15_000})
}

const notesCard = (page: Page): Locator =>
  page.getByRole('region', {name: 'Notes et échanges'})

const thread = (page: Page): Locator =>
  notesCard(page).getByRole('list', {
    name: 'Notes et échanges, du plus récent au plus ancien',
  })

const entryOf = (page: Page, text: string): Locator =>
  thread(page).getByRole('listitem').filter({hasText: text})

const addNote = async (page: Page, body: string) => {
  const card = notesCard(page)
  await card.getByRole('button', {name: 'Ajouter une note'}).click()
  await card.getByLabel('Note', {exact: true}).fill(body)
  await card.getByRole('button', {name: 'Enregistrer la note'}).click()
  await expect(card.getByRole('status')).toContainText('Note enregistrée.', {
    timeout: 15_000,
  })
  await expect(entryOf(page, body)).toBeVisible({timeout: 15_000})
}

const fillExchange = async (
  page: Page,
  input: {date: string; channel: string; body: string}
) => {
  const card = notesCard(page)
  await card.getByLabel('Date de l’échange').fill(input.date)
  await card.getByRole('combobox', {name: 'Canal'}).click()
  await page.getByRole('option', {name: input.channel}).click()
  await card.getByLabel('Résumé').fill(input.body)
  await card.getByRole('button', {name: 'Enregistrer l’échange'}).click()
}

test.describe('Notes et échanges — le bureau tient le fil d’une fiche', () => {
  test.afterAll(async () => {
    await cleanUpRun()
  })

  test('critère 1 — une note ajoutée est retrouvée après rechargement, datée et signée', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const body = textOf('Souhaite être prévenu des travaux.')

    const bureau = await newSession(browser, TENANT_A, OWNER_A)
    try {
      await openMoreau(bureau)
      await addNote(bureau, body)

      await bureau.reload({waitUntil: 'networkidle'})
      const entry = entryOf(bureau, body)
      await expect(entry).toBeVisible({timeout: 15_000})
      await expect(entry).toContainText('Note')
      await expect(entry).toContainText(parisDay())
      await expect(entry).toContainText(/Écrit par \S+/)

      const [stored] = await storedNotesOfRun()
      expect(stored).toMatchObject({kind: 'note', channel: null})
      expect(stored.author_name).toBeTruthy()
    } finally {
      await bureau.context().close()
    }
  })

  test('critères 2 et 3 — un échange daté du futur est refusé, puis consigné au jour choisi, sous la note du jour', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const body = textOf('Appelé au sujet de la cotisation.')

    const bureau = await newSession(browser, TENANT_A, OWNER_A)
    try {
      await openMoreau(bureau)
      await notesCard(bureau)
        .getByRole('button', {name: 'Consigner un échange'})
        .click()

      await fillExchange(bureau, {
        date: parisDay(1),
        channel: 'Téléphone',
        body,
      })
      await expect(
        notesCard(bureau).getByText('Cette date n’est pas encore arrivée.')
      ).toBeVisible()
      expect(
        (await storedNotesOfRun()).filter((note) => note.kind === 'exchange')
      ).toHaveLength(0)

      await notesCard(bureau).getByLabel('Date de l’échange').fill('12/03/2026')
      await notesCard(bureau)
        .getByRole('button', {name: 'Enregistrer l’échange'})
        .click()
      await expect(notesCard(bureau).getByRole('status')).toContainText(
        'Échange enregistré.',
        {timeout: 15_000}
      )

      const exchange = entryOf(bureau, body)
      await expect(exchange).toContainText('Échange')
      await expect(exchange).toContainText('· Téléphone')
      await expect(exchange).toContainText('12/03/2026')

      const ofRun = await storedNotesOfRun()
      expect(ofRun.map((note) => note.kind)).toEqual(['note', 'exchange'])
      expect(ofRun[1]).toMatchObject({
        channel: 'phone',
        entry_date: '2026-03-12',
      })

      const texts = await thread(bureau)
        .getByRole('listitem')
        .filter({hasText: MARKER})
        .allTextContents()
      expect(texts).toHaveLength(2)
      expect(texts[0]).toContain('Souhaite être prévenu des travaux.')
      expect(texts[1]).toContain('Appelé au sujet de la cotisation.')
    } finally {
      await bureau.context().close()
    }
  })

  test('critère 5 — une note modifiée dit « Modifiée le », son auteur ne change pas ; supprimée, elle disparaît', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const original = textOf('Ne pas appeler avant 10 h.')
    const edited = textOf('Ne pas appeler avant 11 h.')

    const bureau = await newSession(browser, TENANT_A, OWNER_A)
    try {
      await openMoreau(bureau)
      await addNote(bureau, original)
      const authorBefore = (await storedNotesOfRun()).find(
        (note) => note.kind === 'note' && note.updated_at === null
      )?.author_name

      await entryOf(bureau, original)
        .getByRole('button', {name: /^Modifier la note du/})
        .click()
      await notesCard(bureau).getByLabel('Note', {exact: true}).fill(edited)
      await notesCard(bureau)
        .getByRole('button', {name: 'Enregistrer les modifications'})
        .click()
      await expect(notesCard(bureau).getByRole('status')).toContainText(
        'Note modifiée.',
        {timeout: 15_000}
      )

      await bureau.reload({waitUntil: 'networkidle'})
      const entry = entryOf(bureau, edited)
      await expect(entry).toContainText(
        /Modifiée le \d{2}\/\d{2}\/\d{4} à \d{2}:\d{2}/
      )
      await expect(entry).toContainText(`Écrit par ${authorBefore}`)
      await expect(thread(bureau).getByText(original)).toHaveCount(0)

      await entry.getByRole('button', {name: /^Supprimer la note du/}).click()
      const dialog = bureau.getByRole('alertdialog', {
        name: 'Supprimer cette note ?',
      })
      await expect(
        dialog.getByRole('button', {name: 'Garder la note'})
      ).toBeFocused()
      await dialog.getByRole('button', {name: 'Supprimer la note'}).click()
      await expect(notesCard(bureau).getByRole('status')).toContainText(
        'Note supprimée.',
        {timeout: 15_000}
      )
      await expect(entryOf(bureau, edited)).toHaveCount(0)

      const ofRun = await storedNotesOfRun()
      expect(ofRun.some((note) => note.updated_at !== null)).toBe(false)
    } finally {
      await bureau.context().close()
    }
  })
})

test.describe('Notes et échanges — étanchéité côté membre et entre associations', () => {
  test.afterAll(async () => {
    await cleanUpRun()
  })

  test('critère 4 — Moreau, compte `member`, n’atteint pas sa fiche du bureau et ne lit aucune note dans son espace', async ({
    browser,
  }) => {
    test.setTimeout(150_000)
    const body = textOf('Note interne sur Moreau.')

    const bureau = await newSession(browser, TENANT_A, OWNER_A)
    try {
      await openMoreau(bureau)
      await addNote(bureau, body)
    } finally {
      await bureau.context().close()
    }

    const moreau = await newMemberSession(browser, TENANT_A, SEED_MOREAU.email)
    try {
      await expect(moreau.getByText(MARKER)).toHaveCount(0)

      await moreau.goto(`${TENANT_A}${PROFILE_ROUTE(SEED_MOREAU.profileId)}`, {
        waitUntil: 'load',
      })
      await expect(moreau.getByText(DENIED_TEXT)).toBeVisible({
        timeout: 20_000,
      })
      await expect(moreau.getByText(MARKER)).toHaveCount(0)
      await expect(
        moreau.getByRole('heading', {level: 2, name: 'Notes et échanges'})
      ).toHaveCount(0)

      for (const route of ['/dashboard', '/dashboard/signaler']) {
        await moreau.goto(`${TENANT_A}${route}`, {waitUntil: 'networkidle'})
        await expect(moreau.getByText(MARKER)).toHaveCount(0)
      }
    } finally {
      await moreau.context().close()
    }
  })

  test('accès croisé — sous le rôle applicatif, Marketing Pro ne lit aucune note de TechCorp et ne peut pas en écrire', async () => {
    const ids = await tenantIds()
    const [note] = await storedNotesOfRun()
    expect(note, 'le test précédent a écrit une note').toBeTruthy()

    const seenFromB = await inTenantScope(ids.b, async (client) => ({
      byId: await client.query(`select id from member_note where id = $1`, [
        note.id,
      ]),
      ofA: await client.query(
        `select id from member_note where organization_id = $1`,
        [ids.a]
      ),
    }))
    expect(seenFromB.byId.rowCount, 'un oubli de scope ne fuite pas').toBe(0)
    expect(seenFromB.ofA.rowCount).toBe(0)

    const withoutScope = await withAppRoleClient((client) =>
      client.query(`select id from member_note`)
    )
    expect(withoutScope.rowCount).toBe(0)

    await expect(
      inTenantScope(ids.b, (client) =>
        client.query(
          `insert into member_note
             (organization_id, member_profile_id, kind, entry_date, body)
           values ($1, $2, 'note', current_date, $3)`,
          [ids.a, SEED_MOREAU.profileId, textOf('Intrus')]
        )
      )
    ).rejects.toThrow(/row-level security/)
  })

  test('le bureau de TechCorp n’ouvre pas la fiche d’une association de Marketing Pro', async ({
    browser,
  }) => {
    test.setTimeout(90_000)
    const bureau = await newSession(browser, TENANT_A, OWNER_A)
    try {
      await bureau.goto(`${TENANT_A}${PROFILE_ROUTE(SEED_SCI_PINS)}`, {
        waitUntil: 'networkidle',
      })
      await expect(bureau.getByText('SCI Les Pins')).toHaveCount(0)
      await expect(
        bureau.getByRole('heading', {level: 2, name: 'Notes et échanges'})
      ).toHaveCount(0)
    } finally {
      await bureau.context().close()
    }
  })
})
