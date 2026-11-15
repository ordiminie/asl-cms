/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {Browser, expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Questions des membres au bureau — s23, critères 1 à 5 et isolation entre
 * associations.
 *
 * Ce que seuls un navigateur, deux domaines et une vraie base prouvent : la
 * question écrite depuis l'espace membre arrive dans `member_question` **et**
 * dans la boîte de sortie du transport `file` (`EMAIL_TRANSPORT=file`), vers
 * l'adresse de son sujet **ou, à défaut,** vers l'adresse de contact (routage
 * exclusif, un seul envoi) ; le bureau la lit avec l'identité du membre ; les
 * sujets se gèrent dans la limite de 10 ; un sujet supprimé garde ses
 * questions ; enfin la RLS isole les deux associations.
 *
 * `localhost` sert TechCorp Solutions, `127.0.0.1` Marketing Pro (seed). Les
 * deux sujets du seed : « Factures et cotisation » (avec adresse) et « Voirie
 * et portails » (sans). Les compteurs du budget d'envoi ne sont pas lus :
 * `email-budget.spec.ts` les tient.
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

/** Fiche de TechCorp liée à un compte, posée par le seed (s22). */
const SEED_MOREAU = {
  email: 'lucie.moreau@example.test',
  name: 'Lucie Moreau',
  profileId: 'a1200000-0000-4000-8000-000000000006',
}

const ROUTED_SUBJECT = 'Factures et cotisation'
const ROUTED_ADDRESS = 'tresorerie@techcorp-solutions.test'
const UNROUTED_SUBJECT = 'Voirie et portails'

const QUESTIONS_ROUTE = '/bureau/questions'
const SUBJECTS_ROUTE = '/bureau/questions/sujets'
const LINK_SENT_TITLE = 'Consultez votre boîte mail'

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
const markerOf = (label: string) => `${label} s23-${RUN}`

const VISITOR_RUN = Date.now().toString(16).slice(-4)
let visitorCount = 0
/** Adresse IPv6 de documentation, propre à cet essai et à ce navigateur. */
const nextVisitorIp = () =>
  `2001:db8:523:${VISITOR_RUN}::${(++visitorCount).toString(16)}`

type OutboxMessage = {
  from: string
  to: string
  subject: string
  html?: string
  text: string
  replyTo?: string
}

test.use({locale: 'fr-FR'})
test.describe.configure({mode: 'serial'})

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

const newMessages = (before: Set<string>): OutboxMessage[] =>
  [...outboxFiles()]
    .filter((file) => !before.has(file))
    .map(
      (file) =>
        JSON.parse(
          fs.readFileSync(path.join(outboxDir(), file), 'utf8')
        ) as OutboxMessage
    )

/** Les emails déposés depuis `before` qui parlent de `marker`. */
const emailsAbout = (before: Set<string>, marker: string): OutboxMessage[] =>
  newMessages(before).filter((email) => email.text.includes(marker))

const messagesTo = (before: Set<string>, to: string): OutboxMessage[] =>
  newMessages(before).filter((message) => message.to === to)

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

/** Préparation et nettoyage hors scope : le seul `bypass` de la spec. */
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

type StoredQuestion = {
  id: string
  member_id: string
  category_id: string
  notification_failed: boolean
}

/** La question de TechCorp dont le texte porte `marker`, lue sous son scope. */
const storedQuestionOfTenantA = async (
  marker: string
): Promise<StoredQuestion | undefined> => {
  const {a} = await tenantIds()
  return inTenantScope(a, async (client) => {
    const result = await client.query<StoredQuestion>(
      `select id, member_id, category_id, notification_failed
         from member_question where body like $1`,
      [`%${marker}%`]
    )
    return result.rows[0]
  })
}

/** Les sujets actifs de TechCorp, lus sous son scope. */
const activeSubjectsOfTenantA = async () => {
  const {a} = await tenantIds()
  return inTenantScope(a, async (client) => {
    const result = await client.query<{id: string; name: string}>(
      `select id, name from association_category
        where domain = 'question' and deleted_at is null order by created_at`
    )
    return result.rows
  })
}

const subjectIdOf = async (name: string) => {
  const found = (await activeSubjectsOfTenantA()).find(
    (row) => row.name === name
  )
  expect(found, `le sujet « ${name} » doit exister`).toBeTruthy()
  return (found as {id: string}).id
}

/** L'adresse de notification de TechCorp, telle qu'enregistrée. */
const storedContactOfTenantA = async (): Promise<string> => {
  const {a} = await tenantIds()
  return inTenantScope(a, async (client) => {
    const result = await client.query<{value: string}>(
      `select value from organization_setting where organization_id = $1 and key = 'contact.email'`,
      [a]
    )
    const value = result.rows[0]?.value
    expect(value, 'TechCorp doit avoir une adresse de contact').toBeTruthy()
    return value
  })
}

/**
 * Chaque essai nettoie ce qu'il a écrit, les questions **avant** les sujets :
 * la clé étrangère est en `RESTRICT`.
 */
const cleanUpRun = () =>
  asMaintenance(async (client) => {
    await client.query(`delete from member_question where body like $1`, [
      `%${RUN}%`,
    ])
    await client.query(
      `delete from association_category where domain = 'question' and name like $1`,
      [`%${RUN}%`]
    )
  })

/**
 * Les liens de connexion sont plafonnés par adresse et par jour : chaque essai
 * repart de compteurs vides (précédent : `incident-report.spec.ts`).
 */
const resetRateLimits = () =>
  asMaintenance((client) =>
    client.query(
      `delete from rate_limit_event
        where organization_id in (select id from organization where slug = any($1))`,
      [['techcorp-solutions', 'marketing-pro']]
    )
  )

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
const newBoardSession = async (
  browser: Browser,
  base: string,
  email: string
) => {
  const context = await browser.newContext({locale: 'fr-FR'})
  await context.addCookies([{name: 'NEXT_LOCALE', value: 'fr', url: base}])
  const page = await context.newPage()
  await login(page, base, email)
  return page
}

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

const questionCard = (page: Page) =>
  page.getByRole('region', {name: 'Une question pour le bureau ?'})

/** Pose une question depuis l'espace : un sujet, un texte, rien d'autre. */
const askAsMember = async (
  page: Page,
  input: {subject: string; body: string}
) => {
  await page.goto(`${TENANT_A}/dashboard`, {waitUntil: 'networkidle'})
  await questionCard(page)
    .getByRole('link', {name: /Poser une (autre )?question/})
    .click()
  await expect(
    page.getByRole('heading', {level: 1, name: 'Poser une question au bureau'})
  ).toBeVisible({timeout: 60_000})
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('textbox')).toHaveCount(1)
  await page.getByRole('combobox', {name: 'Sujet de votre question'}).click()
  await page.getByRole('option', {name: input.subject}).click()
  await page.getByRole('textbox', {name: 'Votre question'}).fill(input.body)
  await page.getByRole('button', {name: 'Envoyer la question'}).click()
  await expect(page).toHaveURL(`${TENANT_A}/dashboard?question=envoyee`, {
    timeout: 15_000,
  })
  await expect(
    questionCard(page)
      .getByRole('status')
      .filter({hasText: 'Question envoyée.'})
  ).toBeVisible({timeout: 15_000})
}

const openQuestions = async (page: Page, base = TENANT_A) => {
  await page.goto(`${base}${QUESTIONS_ROUTE}`, {waitUntil: 'load'})
  await expect(
    page.getByRole('heading', {level: 1, name: 'Questions des membres'})
  ).toBeVisible({timeout: 20_000})
}

const openSubjects = async (page: Page) => {
  await page.goto(`${TENANT_A}${SUBJECTS_ROUTE}`, {waitUntil: 'load'})
  await expect(
    page.getByRole('heading', {level: 1, name: 'Sujets des questions'})
  ).toBeVisible({timeout: 20_000})
}

/** Les lignes du tableau (la vue en cartes est masquée en desktop). */
const rowOf = (page: Page, text: string) =>
  page.getByRole('table').locator('tbody tr').filter({hasText: text})

/** Une question écrite directement sous le scope de TechCorp, pour Moreau. */
const insertQuestionOfTenantA = async (categoryId: string, body: string) => {
  const {a} = await tenantIds()
  return inTenantScope(a, async (client) => {
    const result = await client.query<{id: string}>(
      `insert into member_question (organization_id, member_id, category_id, body)
       values ($1, $2, $3, $4) returning id`,
      [a, SEED_MOREAU.profileId, categoryId, body]
    )
    return result.rows[0].id
  })
}

test.describe('Questions des membres au bureau (s23)', () => {
  test.beforeEach(async () => {
    await resetRateLimits()
  })

  test.afterAll(async () => {
    await cleanUpRun()
  })

  const routedQuestion = markerOf('Facture de l’eau 2026 introuvable')
  const unroutedQuestion = markerOf('Le portail des Crêtes ne ferme plus')

  test('critères 1 et 2 — une question part vers l’adresse de son sujet, l’autre vers le contact, un seul envoi chacune', async ({
    browser,
  }) => {
    test.setTimeout(180_000)
    const contact = await storedContactOfTenantA()
    expect(contact).not.toBe(ROUTED_ADDRESS)

    const moreau = await newMemberSession(browser, TENANT_A, SEED_MOREAU.email)
    try {
      const beforeRouted = outboxFiles()
      await askAsMember(moreau, {subject: ROUTED_SUBJECT, body: routedQuestion})
      await expect
        .poll(() => emailsAbout(beforeRouted, routedQuestion).length, {
          timeout: 10_000,
        })
        .toBe(1)
      const [routed] = emailsAbout(beforeRouted, routedQuestion)
      expect(routed.to).toBe(ROUTED_ADDRESS)
      expect(routed.subject).toContain(ROUTED_SUBJECT)
      expect(routed.text).toContain(SEED_MOREAU.name)
      expect(routed.text).toContain(SEED_MOREAU.email)

      const beforeUnrouted = outboxFiles()
      await askAsMember(moreau, {
        subject: UNROUTED_SUBJECT,
        body: unroutedQuestion,
      })
      await expect
        .poll(() => emailsAbout(beforeUnrouted, unroutedQuestion).length, {
          timeout: 10_000,
        })
        .toBe(1)
      expect(emailsAbout(beforeUnrouted, unroutedQuestion)[0].to).toBe(contact)
    } finally {
      await moreau.context().close()
    }

    const stored = await storedQuestionOfTenantA(routedQuestion)
    expect(stored?.member_id).toBe(SEED_MOREAU.profileId)
    expect(stored?.category_id).toBe(await subjectIdOf(ROUTED_SUBJECT))
    expect(stored?.notification_failed).toBe(false)
  })

  test('critère 4 — le bureau lit la question avec le nom, l’email et le sujet du membre', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const board = await newBoardSession(browser, TENANT_A, OWNER_A)
    try {
      await openQuestions(board)
      const row = rowOf(board, routedQuestion)
      await expect(row).toContainText(SEED_MOREAU.name)
      await expect(row).toContainText(SEED_MOREAU.email)
      await expect(row).toContainText(ROUTED_SUBJECT)

      await row.getByRole('link', {name: 'Lire'}).click()
      await expect(
        board.getByRole('heading', {
          level: 1,
          name: `Question de ${SEED_MOREAU.name}`,
        })
      ).toBeVisible({timeout: 60_000})
      await expect(board.getByTestId('member-question-body')).toHaveText(
        routedQuestion
      )
      await expect(
        board.getByRole('link', {name: 'Répondre par email'})
      ).toHaveAttribute('href', `mailto:${SEED_MOREAU.email}`)
    } finally {
      await board.context().close()
    }
  })

  test('critère 3 — le 11ᵉ sujet est refusé avec un message explicite', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const {a} = await tenantIds()
    const active = (await activeSubjectsOfTenantA()).length
    await asMaintenance(async (client) => {
      for (let index = active; index < 10; index++) {
        await client.query(
          `insert into association_category (organization_id, domain, name)
           values ($1, 'question', $2)`,
          [a, `Remplissage ${index} ${RUN}`]
        )
      }
    })

    const board = await newBoardSession(browser, TENANT_A, OWNER_A)
    try {
      await openSubjects(board)
      await expect(board.getByText('10 sur 10')).toBeVisible()
      const add = board.getByRole('button', {name: 'Ajouter un sujet'})
      await expect(add).toBeEnabled()
      await add.click()
      await expect(
        board.getByRole('alert').filter({
          hasText:
            'Vous avez déjà 10 sujets, le maximum. Supprimez-en un avant d’en ajouter un autre.',
        })
      ).toBeVisible({timeout: 15_000})
    } finally {
      await asMaintenance((client) =>
        client.query(
          `delete from association_category where domain = 'question' and name like $1`,
          [`Remplissage % ${RUN}`]
        )
      )
      await board.context().close()
    }
  })

  test('critère 5 — supprimer un sujet garde ses questions, lues avec « catégorie supprimée »', async ({
    browser,
  }) => {
    test.setTimeout(150_000)
    const {a} = await tenantIds()
    const doomed = `Élagage ${RUN}`
    const doomedId = await asMaintenance(async (client) => {
      const result = await client.query<{id: string}>(
        `insert into association_category (organization_id, domain, name)
         values ($1, 'question', $2) returning id`,
        [a, doomed]
      )
      return result.rows[0].id
    })
    const kept = markerOf('Peut-on élaguer avant l’hiver ?')
    const keptId = await insertQuestionOfTenantA(doomedId, kept)

    const board = await newBoardSession(browser, TENANT_A, OWNER_A)
    try {
      await openSubjects(board)
      await rowOf(board, doomed).getByRole('button', {name: 'Modifier'}).click()
      await board
        .getByRole('dialog', {name: 'Modifier le sujet'})
        .getByRole('button', {name: 'Supprimer le sujet'})
        .click()
      const confirm = board.getByRole('alertdialog')
      await expect(confirm).toContainText(
        'La question déjà reçue dans ce sujet reste consultable'
      )
      await confirm.getByRole('button', {name: 'Supprimer le sujet'}).click()
      await expect(
        board.getByRole('status').filter({hasText: `« ${doomed} » supprimé`})
      ).toBeVisible({timeout: 15_000})

      await openQuestions(board)
      await expect(rowOf(board, kept)).toContainText(
        `${doomed} — catégorie supprimée`
      )
    } finally {
      await board.context().close()
    }

    const stillThere = await storedQuestionOfTenantA(kept)
    expect(stillThere?.id).toBe(keptId)
    expect(stillThere?.category_id).toBe(doomedId)
  })

  test('isolation — depuis Marketing Pro, aucune question ni aucun sujet de TechCorp n’est lisible ni modifiable', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const ids = await tenantIds()
    const subjectOfA = await subjectIdOf(ROUTED_SUBJECT)
    const isolated = markerOf('Isolation RLS')
    const questionOfA = await insertQuestionOfTenantA(subjectOfA, isolated)

    const seenFromB = await inTenantScope(ids.b, async (client) => ({
      question: await client.query(
        `select id from member_question where id = $1`,
        [questionOfA]
      ),
      subject: await client.query(
        `select id from association_category where id = $1`,
        [subjectOfA]
      ),
      updatedQuestion: await client.query(
        `update member_question set body = 'détourné' where id = $1`,
        [questionOfA]
      ),
      updatedSubject: await client.query(
        `update association_category set name = 'détourné' where id = $1`,
        [subjectOfA]
      ),
    }))
    expect(seenFromB.question.rowCount, 'un oubli de scope ne fuite pas').toBe(
      0
    )
    expect(seenFromB.subject.rowCount).toBe(0)
    expect(seenFromB.updatedQuestion.rowCount).toBe(0)
    expect(seenFromB.updatedSubject.rowCount).toBe(0)

    const withoutScope = await withAppRoleClient((client) =>
      client.query(`select id from member_question where id = $1`, [
        questionOfA,
      ])
    )
    expect(withoutScope.rowCount).toBe(0)
    expect((await storedQuestionOfTenantA(isolated))?.id).toBe(questionOfA)

    const boardB = await newBoardSession(browser, TENANT_B, BOARD_B)
    try {
      await openQuestions(boardB, TENANT_B)
      await expect(boardB.getByText(isolated)).toHaveCount(0)
      await expect(boardB.getByText(routedQuestion)).toHaveCount(0)

      await boardB.goto(`${TENANT_B}${QUESTIONS_ROUTE}/${questionOfA}`, {
        waitUntil: 'load',
      })
      await expect(boardB.getByText(isolated)).toHaveCount(0)
      await expect(
        boardB.getByRole('heading', {
          level: 1,
          name: `Question de ${SEED_MOREAU.name}`,
        })
      ).toHaveCount(0)
    } finally {
      await boardB.context().close()
    }
  })
})
