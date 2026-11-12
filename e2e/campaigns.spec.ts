/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {Browser, expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Campagnes email — s25, critères 1 à 9 et isolation entre associations
 * (ADR 051).
 *
 * Ce que seuls un navigateur, deux domaines et une vraie base prouvent : une
 * campagne composée en mode libre part par l'outbox `file`
 * (`EMAIL_TRANSPORT=file`) à chaque membre joignable, habillée, avec ses
 * en-têtes `List-Unsubscribe` ; elle est archivée ; le `GET` de la page de
 * désinscription n'écrit rien, le bouton et le `POST` sans interaction
 * écrivent ; un désinscrit sort de la cible suivante ; la RLS forcée isole les
 * trois tables.
 *
 * `localhost` sert TechCorp Solutions, `127.0.0.1` Marketing Pro (seed). La
 * spec crée trois fiches chez TechCorp (deux avec email, une sans) et les
 * efface à la fin, avec ses campagnes. TechCorp porte aussi les fiches du
 * seed : le décompte attendu est lu en base, et les assertions d'envoi
 * portent sur les fiches de l'essai.
 *
 * La livraison part par `after()` : la spec **interroge l'outbox** jusqu'à
 * voir ses messages, elle ne suppose pas qu'ils soient là à la réponse.
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
/** Compte `member` de Lucie Moreau chez TechCorp (seed). */
const MEMBER_A_EMAIL = 'lucie.moreau@example.test'

const CAMPAIGNS_ROUTE = '/bureau/campagnes'
const NEW_CAMPAIGN_ROUTE = '/bureau/campagnes/nouvelle'
const PROFILE_ROUTE = (id: string) => `/bureau/proprietaires/${id}`
const DENIED_TITLE = 'Cette page ne vous est pas accessible'
const LINK_SENT_TITLE = 'Consultez votre boîte mail'

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
const MARKER = `s25-${RUN}`
const subjectOf = (label: string) => `${label} ${MARKER}`

/** Les trois fiches de l'essai, chez TechCorp. */
const FICHES = {
  first: {name: `Aubert ${MARKER}`, email: `aubert-${RUN}@example.test`},
  second: {name: `Renaud ${MARKER}`, email: `renaud-${RUN}@example.test`},
  withoutEmail: {name: `Sans email ${MARKER}`, email: null},
} as const

const VISITOR_RUN = Date.now().toString(16).slice(-4)
let visitorCount = 0
/** Adresse IPv6 de documentation, propre à cet essai et à cette session. */
const nextVisitorIp = () =>
  `2001:db8:525:${VISITOR_RUN}::${(++visitorCount).toString(16)}`

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

type Counts = {recipients: number; withoutEmail: number; unsubscribed: number}

/** Le décompte de TechCorp, lu en base sous son scope : la même partition. */
const countsInDatabase = async (): Promise<Counts> => {
  const {a} = await tenantIds()
  return inTenantScope(a, async (client) => {
    const result = await client.query<{
      recipients: number
      without_email: number
      unsubscribed: number
    }>(
      `select
         count(*) filter (where p.email is not null and u.id is null)::int as recipients,
         count(*) filter (where p.email is null)::int as without_email,
         count(*) filter (where p.email is not null and u.id is not null)::int as unsubscribed
       from member_profile p
       left join member_unsubscribe u on u.member_profile_id = p.id
       where p.organization_id = $1`,
      [a]
    )
    const [row] = result.rows
    return {
      recipients: row.recipients,
      withoutEmail: row.without_email,
      unsubscribed: row.unsubscribed,
    }
  })
}

const ficheIds: Record<keyof typeof FICHES, string> = {
  first: '',
  second: '',
  withoutEmail: '',
}

const createFiches = async () => {
  const {a} = await tenantIds()
  await inTenantScope(a, async (client) => {
    for (const key of Object.keys(FICHES) as (keyof typeof FICHES)[]) {
      const fiche = FICHES[key]
      const result = await client.query<{id: string}>(
        `insert into member_profile (organization_id, name, email)
         values ($1, $2, $3) returning id`,
        [a, fiche.name, fiche.email]
      )
      ficheIds[key] = result.rows[0].id
    }
  })
}

/** Chaque essai efface ses campagnes et ses fiches (le refus suit en cascade). */
const cleanUpRun = () =>
  asMaintenance(async (client) => {
    await client.query(`delete from campaign where subject like $1`, [
      `%${MARKER}%`,
    ])
    await client.query(`delete from member_profile where name like $1`, [
      `%${MARKER}%`,
    ])
  })

const campaignsOfRun = async (): Promise<
  {id: string; status: string; recipient_count: number; sent_count: number}[]
> => {
  const {a} = await tenantIds()
  return inTenantScope(a, async (client) => {
    const result = await client.query(
      `select id, status, recipient_count, sent_count from campaign
        where subject like $1 order by created_at`,
      [`%${MARKER}%`]
    )
    return result.rows
  })
}

const unsubscribeOf = async (memberProfileId: string) => {
  const {a} = await tenantIds()
  return inTenantScope(a, async (client) => {
    const result = await client.query(
      `select id from member_unsubscribe where member_profile_id = $1`,
      [memberProfileId]
    )
    return result.rowCount ?? 0
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

type OutboxMessage = {
  from: string
  to: string
  subject: string
  html?: string
  text: string
  headers?: Record<string, string>
  replyTo?: string
}

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

const messagesSince = (before: Set<string>): OutboxMessage[] =>
  [...outboxFiles()]
    .filter((file) => !before.has(file))
    .map(
      (file) =>
        JSON.parse(
          fs.readFileSync(path.join(outboxDir(), file), 'utf8')
        ) as OutboxMessage
    )

const messagesTo = (before: Set<string>, to: string | null) =>
  messagesSince(before).filter((message) => message.to === to)

/** Le jeton du lien de désinscription, lu en clair dans la version texte. */
const unsubscribeTokenOf = (message: OutboxMessage): string => {
  const token = message.text.match(/\/desinscription\/([A-Za-z0-9_-]{43})/)?.[1]
  expect(token, 'la version texte porte l’URL de désinscription').toBeTruthy()
  return token as string
}

/** Compose en mode libre, ouvre l'aperçu, envoie ; rend l'id de la campagne. */
const composeAndSend = async (
  page: Page,
  input: {subject: string; body: string; expectedRecipients: number}
): Promise<string> => {
  await page.goto(`${TENANT_A}${NEW_CAMPAIGN_ROUTE}`, {
    waitUntil: 'networkidle',
  })
  await page.getByRole('textbox', {name: /^Objet/}).fill(input.subject)
  await page
    .getByRole('textbox', {name: 'Message', exact: true})
    .fill(input.body)
  await page.getByRole('button', {name: 'Voir l’aperçu'}).click()
  await expect(
    page.getByRole('heading', {level: 1, name: 'Aperçu avant l’envoi'})
  ).toBeVisible({timeout: 15_000})
  await expect(page.getByTitle('Aperçu de l’email')).toBeVisible()

  const sendLabel = new RegExp(
    `^Envoyer à ${input.expectedRecipients} membres?$`
  )
  await page.getByRole('button', {name: sendLabel}).click()
  const dialog = page.getByRole('alertdialog', {name: 'Envoyer la campagne ?'})
  await expect(
    dialog.getByRole('button', {name: 'Revenir à l’aperçu'})
  ).toBeFocused()
  await dialog.getByRole('button', {name: sendLabel}).click()

  await page.waitForURL(/\/bureau\/campagnes\/[0-9a-f-]{36}\?envoi=1$/, {
    timeout: 20_000,
  })
  return new URL(page.url()).pathname.split('/').pop() as string
}

test.describe('Campagnes — composer, envoyer, archiver, désinscrire', () => {
  test.beforeAll(async () => {
    await cleanUpRun()
    await createFiches()
  })

  test.afterAll(async () => {
    await cleanUpRun()
  })

  test('critères 1, 2, 3, 5 et 8 — mode libre : décompte, aperçu, envoi habillé, archive', async ({
    browser,
  }) => {
    test.setTimeout(150_000)
    const expected = await countsInDatabase()
    const subject = subjectOf('Peinture du portail')

    const bureau = await newSession(browser, TENANT_A, OWNER_A)
    try {
      await bureau.goto(`${TENANT_A}${NEW_CAMPAIGN_ROUTE}`, {
        waitUntil: 'networkidle',
      })
      const recipients = bureau
        .getByRole('heading', {name: '3 · Destinataires'})
        .locator('xpath=..')
      await expect(recipients).toContainText(
        `Recevront cette campagne${expected.recipients}`
      )
      await expect(recipients).toContainText(`${expected.withoutEmail}`)
      await expect(recipients).toContainText(
        `Membres au total${expected.recipients + expected.withoutEmail + expected.unsubscribed}`
      )

      const before = outboxFiles()
      const campaignId = await composeAndSend(bureau, {
        subject,
        body: 'Bonjour {nom},\n\nLe portail sera repeint.',
        expectedRecipients: expected.recipients,
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
      expect(messagesTo(before, null)).toHaveLength(0)

      for (const fiche of [FICHES.first, FICHES.second]) {
        const [message] = messagesTo(before, fiche.email)
        expect(message.subject).toContain(subject)
        expect(message.html).toContain('Ne plus recevoir ces campagnes')
        expect(message.html).toContain(`Bonjour ${fiche.name}`)
        const token = unsubscribeTokenOf(message)
        expect(message.html).toContain(`/desinscription/${token}`)
        expect(message.headers?.['List-Unsubscribe']).toBe(
          `<${TENANT_A}/api/campaigns/unsubscribe/${token}>`
        )
        expect(message.headers?.['List-Unsubscribe-Post']).toBe(
          'List-Unsubscribe=One-Click'
        )
        expect(message.replyTo).toBeTruthy()
      }

      await expect
        .poll(async () => (await campaignsOfRun())[0]?.status, {
          timeout: 30_000,
        })
        .toBe('sent')

      await bureau.goto(`${TENANT_A}${CAMPAIGNS_ROUTE}`, {
        waitUntil: 'networkidle',
      })
      const row = bureau.getByRole('row').filter({hasText: subject})
      await expect(row).toBeVisible()
      await row.getByRole('link', {name: 'Consulter'}).click()
      await expect(bureau).toHaveURL(
        `${TENANT_A}${CAMPAIGNS_ROUTE}/${campaignId}`
      )
      const title = bureau.getByRole('heading', {level: 1, name: subject})
      await expect(title).toBeVisible()
      // L'en-tete porte le badge d'etat de la campagne ; la page precedente
      // (archive) reste montee, masquee, apres une navigation cliente.
      await expect(
        title.locator('xpath=..').getByText('Envoyée', {exact: true})
      ).toBeVisible()
      await expect(bureau.getByText('Bonjour {nom},')).toBeVisible()
    } finally {
      await bureau.context().close()
    }
  })

  test('critère 4 — variable inconnue : « Voir l’aperçu » alerte, rien ne part', async ({
    browser,
  }) => {
    test.setTimeout(90_000)
    const subject = subjectOf('Variable inconnue')
    const campaignsBefore = (await campaignsOfRun()).length
    const before = outboxFiles()

    const bureau = await newSession(browser, TENANT_A, OWNER_A)
    try {
      await bureau.goto(`${TENANT_A}${NEW_CAMPAIGN_ROUTE}`, {
        waitUntil: 'networkidle',
      })
      await bureau.getByRole('textbox', {name: /^Objet/}).fill(subject)
      await bureau
        .getByRole('textbox', {name: 'Message', exact: true})
        .fill('Parcelle {parcele}')
      await bureau.getByRole('button', {name: 'Voir l’aperçu'}).click()

      await expect(
        bureau.getByText('Variable inconnue : {parcele}.')
      ).toBeVisible({timeout: 15_000})
      await expect(
        bureau.getByRole('heading', {name: 'Aperçu avant l’envoi'})
      ).toHaveCount(0)
      expect(await campaignsOfRun()).toHaveLength(campaignsBefore)
      expect(messagesSince(before)).toHaveLength(0)
    } finally {
      await bureau.context().close()
    }
  })

  test('critères 6 et 7 — le GET ne désinscrit pas, le bouton oui ; la fiche le montre ; la campagne suivante l’exclut', async ({
    browser,
  }) => {
    test.setTimeout(180_000)
    const before = outboxFiles()

    const bureau = await newSession(browser, TENANT_A, OWNER_A)
    try {
      const expected = await countsInDatabase()
      await composeAndSend(bureau, {
        subject: subjectOf('Avant désinscription'),
        body: 'Bonjour {nom}',
        expectedRecipients: expected.recipients,
      })
      await expect
        .poll(() => messagesTo(before, FICHES.first.email).length, {
          timeout: 30_000,
        })
        .toBe(1)
      const token = unsubscribeTokenOf(
        messagesTo(before, FICHES.first.email)[0]
      )

      const visitor = await browser.newContext({locale: 'fr-FR'})
      try {
        const page = await visitor.newPage()
        await page.goto(`${TENANT_A}/desinscription/${token}`, {
          waitUntil: 'networkidle',
        })
        await expect(
          page.getByRole('button', {name: 'Me désinscrire'})
        ).toBeVisible({timeout: 15_000})
        expect(await unsubscribeOf(ficheIds.first)).toBe(0)

        await bureau.goto(`${TENANT_A}${PROFILE_ROUTE(ficheIds.first)}`, {
          waitUntil: 'networkidle',
        })
        await expect(bureau.getByText('Désinscrit des campagnes')).toHaveCount(
          0
        )

        await page.getByRole('button', {name: 'Me désinscrire'}).click()
        await expect(
          page.getByText(
            /^C’est enregistré\. Vous ne recevrez plus les campagnes/
          )
        ).toBeVisible({timeout: 15_000})
        expect(await unsubscribeOf(ficheIds.first)).toBe(1)
      } finally {
        await visitor.close()
      }

      await bureau.reload({waitUntil: 'networkidle'})
      await expect(bureau.getByText('Désinscrit des campagnes')).toBeVisible({
        timeout: 15_000,
      })

      const after = await countsInDatabase()
      expect(after.recipients).toBe(expected.recipients - 1)
      const nextBefore = outboxFiles()
      await composeAndSend(bureau, {
        subject: subjectOf('Après désinscription'),
        body: 'Bonjour {nom}',
        expectedRecipients: after.recipients,
      })
      await expect
        .poll(() => messagesTo(nextBefore, FICHES.second.email).length, {
          timeout: 30_000,
        })
        .toBe(1)
      expect(messagesTo(nextBefore, FICHES.first.email)).toHaveLength(0)
    } finally {
      await bureau.context().close()
    }
  })

  test('critère 6 — le POST sans interaction (RFC 8058) désinscrit, le GET de la route n’écrit rien', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const before = outboxFiles()
    const bureau = await newSession(browser, TENANT_A, OWNER_A)
    try {
      const expected = await countsInDatabase()
      await composeAndSend(bureau, {
        subject: subjectOf('Sans interaction'),
        body: 'Bonjour {nom}',
        expectedRecipients: expected.recipients,
      })
    } finally {
      await bureau.context().close()
    }
    await expect
      .poll(() => messagesTo(before, FICHES.second.email).length, {
        timeout: 30_000,
      })
      .toBe(1)
    const message = messagesTo(before, FICHES.second.email)[0]
    const endpoint = message.headers?.['List-Unsubscribe']?.slice(1, -1)
    expect(endpoint).toBeTruthy()

    const client = await browser.newContext()
    try {
      const get = await client.request.get(endpoint as string, {
        maxRedirects: 0,
      })
      expect(get.status()).toBe(303)
      expect(await unsubscribeOf(ficheIds.second)).toBe(0)

      const post = await client.request.post(endpoint as string, {
        form: {'List-Unsubscribe': 'One-Click'},
      })
      expect(post.status()).toBe(200)
      expect(await unsubscribeOf(ficheIds.second)).toBe(1)
    } finally {
      await client.close()
    }
  })

  test('critère 9 — accès croisé : la RLS isole les trois tables, le jeton et la campagne de A restent invisibles depuis B', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const ids = await tenantIds()
    const [campaign] = await campaignsOfRun()
    expect(
      campaign,
      'les tests précédents ont envoyé une campagne'
    ).toBeTruthy()

    const seenFromB = await inTenantScope(ids.b, async (client) => ({
      campaign: await client.query(`select id from campaign where id = $1`, [
        campaign.id,
      ]),
      recipients: await client.query(
        `select id from campaign_recipient where campaign_id = $1`,
        [campaign.id]
      ),
      unsubscribes: await client.query(
        `select id from member_unsubscribe where organization_id = $1`,
        [ids.a]
      ),
    }))
    expect(seenFromB.campaign.rowCount, 'un oubli de scope ne fuite pas').toBe(
      0
    )
    expect(seenFromB.recipients.rowCount).toBe(0)
    expect(seenFromB.unsubscribes.rowCount).toBe(0)

    const withoutScope = await withAppRoleClient(async (client) => ({
      campaign: await client.query(`select id from campaign`),
      recipients: await client.query(`select id from campaign_recipient`),
      unsubscribes: await client.query(`select id from member_unsubscribe`),
    }))
    expect(withoutScope.campaign.rowCount).toBe(0)
    expect(withoutScope.recipients.rowCount).toBe(0)
    expect(withoutScope.unsubscribes.rowCount).toBe(0)

    await expect(
      inTenantScope(ids.b, (client) =>
        client.query(
          `insert into campaign
             (organization_id, submission_id, subject, body_markdown, target_kind,
              recipient_count, without_email_count, unsubscribed_count, status, send_date)
           values ($1, uuid_generate_v4(), $2, 'x', 'all_members', 0, 0, 0, 'sent', current_date)`,
          [ids.a, subjectOf('Intrus')]
        )
      )
    ).rejects.toThrow(/row-level security/)
    await expect(
      inTenantScope(ids.b, (client) =>
        client.query(
          `insert into member_unsubscribe (organization_id, member_profile_id)
           values ($1, $2)`,
          [ids.a, ficheIds.withoutEmail]
        )
      )
    ).rejects.toThrow(/row-level security/)

    const tokenOfA = await inTenantScope(ids.a, async (client) => {
      const result = await client.query<{unsubscribe_token: string}>(
        `select unsubscribe_token from campaign_recipient where campaign_id = $1 limit 1`,
        [campaign.id]
      )
      return result.rows[0].unsubscribe_token
    })
    const visitor = await browser.newContext({locale: 'fr-FR'})
    try {
      const page = await visitor.newPage()
      await page.goto(`${TENANT_B}/desinscription/${tokenOfA}`, {
        waitUntil: 'networkidle',
      })
      await expect(
        page.getByRole('heading', {level: 1, name: 'Ce lien ne fonctionne pas'})
      ).toBeVisible({timeout: 15_000})
      await expect(
        page.getByRole('button', {name: 'Me désinscrire'})
      ).toHaveCount(0)
    } finally {
      await visitor.close()
    }

    const boardB = await newSession(browser, TENANT_B, BOARD_B)
    try {
      await boardB.goto(`${TENANT_B}${CAMPAIGNS_ROUTE}/${campaign.id}`, {
        waitUntil: 'networkidle',
      })
      await expect(
        boardB.getByText(
          'Cette campagne n’existe pas ou n’appartient pas à votre association.'
        )
      ).toBeVisible({timeout: 15_000})
      await expect(boardB.getByText(MARKER)).toHaveCount(0)
    } finally {
      await boardB.context().close()
    }
  })

  test('un compte `member` n’accède pas aux campagnes du bureau', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const context = await browser.newContext({
      locale: 'fr-FR',
      extraHTTPHeaders: {'x-forwarded-for': nextVisitorIp()},
    })
    try {
      await context.addCookies([
        {name: 'NEXT_LOCALE', value: 'fr', url: TENANT_A},
      ])
      const page = await context.newPage()
      const before = outboxFiles()
      await page.goto(`${TENANT_A}/login`, {waitUntil: 'networkidle'})
      const address = page.getByLabel('Adresse email')
      await address.fill(MEMBER_A_EMAIL)
      await expect(address).toHaveValue(MEMBER_A_EMAIL)
      await page
        .getByRole('button', {name: 'Recevoir mon lien de connexion'})
        .click()
      await expect(
        page.getByRole('heading', {level: 1, name: LINK_SENT_TITLE})
      ).toBeVisible({timeout: 15_000})
      await expect
        .poll(
          () =>
            messagesTo(before, MEMBER_A_EMAIL).filter((message) =>
              message.text.includes('/magic-link/verify')
            ).length,
          {timeout: 10_000}
        )
        .toBe(1)
      const link = messagesTo(before, MEMBER_A_EMAIL)
        .map((message) => message.text)
        .join('\n')
        .match(/https?:\/\/\S+\/magic-link\/verify\?\S+/)?.[0]
      expect(link).toBeTruthy()
      await page.goto(link as string)
      await expect(page).toHaveURL(`${TENANT_A}/dashboard`, {timeout: 15_000})

      await page.goto(`${TENANT_A}${CAMPAIGNS_ROUTE}`, {waitUntil: 'load'})
      await expect(
        page.getByRole('heading', {level: 1, name: DENIED_TITLE})
      ).toBeVisible({timeout: 20_000})
      await expect(page.getByText(MARKER)).toHaveCount(0)
    } finally {
      await context.close()
    }
  })
})

/**
 * Envoi étalé — s26, critères 1, 2, 5, 7, 8, 9, 11 et 12 (ADR 052).
 *
 * Le plafond quotidien de TechCorp est abaissé à 2 pour l'essai : une
 * campagne s'étale alors en parts de deux destinataires, la première part
 * aujourd'hui (passage immédiat en `after()`), les suivantes programmées. Le
 * planificateur est relancé par son script, comme la minuterie le ferait.
 * L'atomicité du `SKIP LOCKED` et du passage `pending -> sending` ne se prouve
 * qu'ici, contre une vraie base.
 */
const SCHEDULER_SCRIPT = 'src/db/scripts/run-scheduled-jobs.ts'
const CAP_KEY = 'campaign.daily_send_cap'
const SPREAD_MARKER = `s26-${RUN}`
const SPREAD_FICHES = Array.from({length: 5}, (_, index) => ({
  name: `Étalé ${index + 1} ${SPREAD_MARKER}`,
  email: `etale-${index + 1}-${RUN}@example.test`,
}))

const runScheduler = (): string =>
  execFileSync('pnpm', ['tsx', SCHEDULER_SCRIPT], {
    env: {...process.env, DATABASE_URL: databaseUrl()},
    encoding: 'utf8',
    timeout: 90_000,
  })

type SpreadRecipient = {
  id: string
  email: string | null
  status: string
  part_number: number
}

const spreadStateOf = async (campaignId: string) => {
  const {a} = await tenantIds()
  return inTenantScope(a, async (client) => {
    const parts = await client.query<{
      id: string
      number: number
      status: string
      recipient_count: number
    }>(
      `select id, number, status, recipient_count from campaign_part
        where campaign_id = $1 order by number`,
      [campaignId]
    )
    const recipients = await client.query<SpreadRecipient>(
      `select r.id, p.email, r.status, cp.number as part_number
         from campaign_recipient r
         left join member_profile p on p.id = r.member_profile_id
         join campaign_part cp on cp.id = r.part_id
        where r.campaign_id = $1
        order by cp.number, r.id`,
      [campaignId]
    )
    const jobs = await client.query<{idempotency_key: string}>(
      `select idempotency_key from scheduled_job
        where kind = 'campaign.deliver_part' and payload->>'campaignId' = $1`,
      [campaignId]
    )
    return {parts: parts.rows, recipients: recipients.rows, jobs: jobs.rows}
  })
}

/**
 * L'état d'une part et de sa tâche après un passage, avec la sortie du
 * script : de quoi lire un échec en CI sans relancer.
 */
const diagnosisOf = async (
  campaignId: string,
  partId: string,
  output: string
): Promise<string> => {
  const {a} = await tenantIds()
  const job = await inTenantScope(a, async (client) => {
    const result = await client.query(
      `select attempts, run_after, locked_at, completed_at, failed_at
         from scheduled_job
        where kind = 'campaign.deliver_part' and idempotency_key = $1`,
      [partId]
    )
    return result.rows[0]
  })
  const state = await spreadStateOf(campaignId)
  const part = state.parts.find((candidate) => candidate.id === partId)
  return JSON.stringify(
    {
      part: part?.status,
      recipients: state.recipients
        .filter((recipient) => recipient.part_number === part?.number)
        .map((recipient) => recipient.status),
      job,
      output: output.trim().split('\n').slice(-15),
    },
    null,
    2
  )
}

/** Rend la tâche d'une part due maintenant, comme un passage de minuit. */
const makePartDue = async (partId: string) => {
  const {a} = await tenantIds()
  await inTenantScope(a, (client) =>
    client.query(
      `update scheduled_job
          set run_after = now() - interval '1 minute', locked_at = null,
              completed_at = null
        where kind = 'campaign.deliver_part' and idempotency_key = $1`,
      [partId]
    )
  )
}

test.describe('Campagnes — envoi étalé en parts quotidiennes (s26)', () => {
  let spreadCampaignId = ''

  test.beforeAll(async () => {
    const {a} = await tenantIds()
    await asMaintenance(async (client) => {
      await client.query(`delete from campaign where subject like $1`, [
        `%${SPREAD_MARKER}%`,
      ])
      await client.query(`delete from member_profile where name like $1`, [
        `%${SPREAD_MARKER}%`,
      ])
    })
    await inTenantScope(a, async (client) => {
      for (const fiche of SPREAD_FICHES) {
        await client.query(
          `insert into member_profile (organization_id, name, email)
           values ($1, $2, $3)`,
          [a, fiche.name, fiche.email]
        )
      }
      await client.query(
        `insert into organization_setting (organization_id, key, value)
         values ($1, $2, '2')
         on conflict (organization_id, key) do update set value = '2'`,
        [a, CAP_KEY]
      )
    })
  })

  test.afterAll(async () => {
    const {a} = await tenantIds()
    await inTenantScope(a, (client) =>
      client.query(
        `delete from organization_setting where organization_id = $1 and key = $2`,
        [a, CAP_KEY]
      )
    )
    await asMaintenance(async (client) => {
      await client.query(`delete from campaign where subject like $1`, [
        `%${SPREAD_MARKER}%`,
      ])
      await client.query(`delete from member_profile where name like $1`, [
        `%${SPREAD_MARKER}%`,
      ])
    })
  })

  test('critères 1, 2 et 5 — plafond 2 : des parts de deux, la première reçue, les suivantes programmées', async ({
    browser,
  }) => {
    test.setTimeout(180_000)
    const expected = await countsInDatabase()
    const partsCount = Math.ceil(expected.recipients / 2)
    expect(partsCount).toBeGreaterThanOrEqual(3)
    const subject = `Étalement ${SPREAD_MARKER}`
    const before = outboxFiles()

    const bureau = await newSession(browser, TENANT_A, OWNER_A)
    try {
      spreadCampaignId = await composeAndSend(bureau, {
        subject,
        body: 'Bonjour {nom}, envoi du {date}.',
        expectedRecipients: expected.recipients,
      })

      const state = await spreadStateOf(spreadCampaignId)
      expect(state.parts.map((part) => part.recipient_count)).toEqual(
        Array.from({length: partsCount}, (_, index) =>
          index < partsCount - 1 || expected.recipients % 2 === 0 ? 2 : 1
        )
      )
      expect(state.jobs).toHaveLength(partsCount)

      const firstPart = state.recipients
        .filter((recipient) => recipient.part_number === 1)
        .map((recipient) => recipient.email)
      await expect
        .poll(
          () =>
            firstPart.filter((email) => messagesTo(before, email).length === 1)
              .length,
          {
            timeout: 30_000,
          }
        )
        .toBe(2)
      const toCampaign = () =>
        state.recipients.flatMap((recipient) =>
          messagesTo(before, recipient.email)
        )
      expect(toCampaign()).toHaveLength(2)

      await expect
        .poll(
          async () => (await spreadStateOf(spreadCampaignId)).parts[0].status,
          {
            timeout: 30_000,
          }
        )
        .toBe('sent')
      const after = await spreadStateOf(spreadCampaignId)
      expect(after.parts.slice(1).map((part) => part.status)).toEqual(
        Array.from({length: partsCount - 1}, () => 'scheduled')
      )

      await bureau.goto(`${TENANT_A}${CAMPAIGNS_ROUTE}/${spreadCampaignId}`, {
        waitUntil: 'networkidle',
      })
      await expect(
        bureau
          .getByRole('heading', {level: 1, name: subject})
          .locator('xpath=..')
          .getByText('En cours d’envoi', {exact: true})
      ).toBeVisible()
      await expect(
        bureau.getByRole('heading', {level: 2, name: 'Envois par jour'})
      ).toBeVisible()
      await expect(
        bureau
          .getByRole('heading', {level: 2, name: 'Envois par jour'})
          .locator('xpath=..')
          .getByRole('table')
          .getByText(/^Programmée pour le \d{2}\/\d{2}$/)
          .first()
      ).toBeVisible()
      await expect(bureau.getByText(/interrompue|bloquée/i)).toHaveCount(0)
    } finally {
      await bureau.context().close()
    }
  })

  test('critères 8 et 12 — relancer le planificateur ne réécrit à personne ; une part due part seule', async () => {
    test.setTimeout(180_000)
    expect(
      spreadCampaignId,
      'le test précédent a lancé la campagne'
    ).toBeTruthy()
    const state = await spreadStateOf(spreadCampaignId)
    const received = state.recipients
      .filter((recipient) => recipient.part_number === 1)
      .map((recipient) => recipient.email)

    let before = outboxFiles()
    await makePartDue(state.parts[0].id)
    expect(runScheduler()).toMatch(/Taches traitees : \d+/)
    expect(
      state.recipients.flatMap((recipient) =>
        messagesTo(before, recipient.email)
      )
    ).toHaveLength(0)

    before = outboxFiles()
    await makePartDue(state.parts[1].id)
    const output = runScheduler()
    const diagnosis = await diagnosisOf(
      spreadCampaignId,
      state.parts[1].id,
      output
    )
    expect(
      (await spreadStateOf(spreadCampaignId)).parts[1].status,
      diagnosis
    ).toBe('sent')
    const secondPart = state.recipients
      .filter((recipient) => recipient.part_number === 2)
      .map((recipient) => recipient.email)
    expect(
      secondPart.map((email) => messagesTo(before, email).length),
      diagnosis
    ).toEqual([1, 1])
    for (const email of received) {
      expect(messagesTo(before, email)).toHaveLength(0)
    }
    const after = await spreadStateOf(spreadCampaignId)
    expect(after.parts[1].status).toBe('sent')
    expect(after.parts[2].status).toBe('scheduled')
  })

  test('critère 7 — un arrêt entre l’envoi et son enregistrement laisse « À vérifier », sans renvoi', async () => {
    test.setTimeout(180_000)
    const {a} = await tenantIds()
    const state = await spreadStateOf(spreadCampaignId)
    const third = state.recipients.filter(
      (recipient) => recipient.part_number === 3
    )
    const [stuck, ...others] = third
    await inTenantScope(a, (client) =>
      client.query(
        `update campaign_recipient
            set status = 'sending', claimed_at = now() - interval '16 minutes'
          where id = $1`,
        [stuck.id]
      )
    )

    const before = outboxFiles()
    await makePartDue(state.parts[2].id)
    const output = runScheduler()
    const diagnosis = await diagnosisOf(
      spreadCampaignId,
      state.parts[2].id,
      output
    )

    const after = await spreadStateOf(spreadCampaignId)
    expect(
      after.recipients.find((r) => r.id === stuck.id)?.status,
      diagnosis
    ).toBe('to_verify')
    expect(messagesTo(before, stuck.email)).toHaveLength(0)
    for (const other of others) {
      expect(messagesTo(before, other.email), diagnosis).toHaveLength(1)
    }
  })

  test('critère 11 — accès croisé : l’autre association ne voit ni parts, ni tâches, ni destinataires ; une URL forgée est introuvable', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const ids = await tenantIds()
    const state = await spreadStateOf(spreadCampaignId)
    expect(state.parts.length).toBeGreaterThan(0)

    const seenFromB = await inTenantScope(ids.b, async (client) => ({
      parts: await client.query(
        `select id from campaign_part where campaign_id = $1`,
        [spreadCampaignId]
      ),
      jobs: await client.query(
        `select id from scheduled_job where organization_id = $1`,
        [ids.a]
      ),
      recipients: await client.query(
        `select id from campaign_recipient where campaign_id = $1`,
        [spreadCampaignId]
      ),
    }))
    expect(seenFromB.parts.rowCount, 'un oubli de scope ne fuite pas').toBe(0)
    expect(seenFromB.jobs.rowCount).toBe(0)
    expect(seenFromB.recipients.rowCount).toBe(0)

    const withoutScope = await withAppRoleClient(async (client) => ({
      parts: await client.query(`select id from campaign_part`),
      jobs: await client.query(`select id from scheduled_job`),
    }))
    expect(withoutScope.parts.rowCount).toBe(0)
    expect(withoutScope.jobs.rowCount).toBe(0)

    await expect(
      inTenantScope(ids.b, (client) =>
        client.query(
          `insert into scheduled_job
             (organization_id, kind, idempotency_key, run_after, payload)
           values ($1, 'campaign.deliver_part', $2, now(), '{}'::jsonb)`,
          [ids.a, `intrus-${RUN}`]
        )
      )
    ).rejects.toThrow(/row-level security/)
    await expect(
      inTenantScope(ids.b, (client) =>
        client.query(
          `insert into campaign_part
             (organization_id, campaign_id, number, scheduled_for, recipient_count)
           values ($1, $2, 99, current_date, 1)`,
          [ids.a, spreadCampaignId]
        )
      )
    ).rejects.toThrow(/row-level security/)

    const boardB = await newSession(browser, TENANT_B, BOARD_B)
    try {
      await boardB.goto(
        `${TENANT_B}${CAMPAIGNS_ROUTE}/${spreadCampaignId}?statut=a-verifier`,
        {waitUntil: 'networkidle'}
      )
      await expect(
        boardB.getByText(
          'Cette campagne n’existe pas ou n’appartient pas à votre association.'
        )
      ).toBeVisible({timeout: 15_000})
      await expect(boardB.getByText(SPREAD_MARKER)).toHaveCount(0)
    } finally {
      await boardB.context().close()
    }
  })
})
