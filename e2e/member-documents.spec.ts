/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import {randomUUID} from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {Browser, expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Documents nominatifs — s32, critères 1 à 7 (ADR 073).
 *
 * Ce que seuls un navigateur, deux domaines et la base prouvent : le dépôt par
 * le bureau puis la lecture par le membre (octets identiques), l'autorisation
 * croisée (un autre membre, le bureau d'une autre association), la traversée
 * de chemin (identifiant forgé, clé demandée sous `/api/files`), le compte
 * relié à plusieurs fiches, la vente, l'isolation du bureau, le lot et le
 * retrait. La RLS n'est pas testable en unitaire : c'est ici qu'elle se
 * prouve.
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
/** Membre simple de TechCorp, sans fiche : la spec le relie à la fiche Laurent. */
const PLAIN_MEMBER_A = 'user@gmail.com'

/** Trois fiches, un seul compte (s53) : parcelles 61, 62 et 63. */
const LEFEVRE = {
  email: 'bernard.lefevre@example.test',
  profileIds: [
    'a1200000-0000-4000-8000-000000000008',
    'a1200000-0000-4000-8000-000000000009',
    'a1200000-0000-4000-8000-00000000000a',
  ],
}
/** Vendeuse de la parcelle 9 le 01/10/2019, à Marcel Laurent. */
const MOREAU = {
  email: 'lucie.moreau@example.test',
  profileId: 'a1200000-0000-4000-8000-000000000006',
}
/** Acquéreur de la parcelle 9 : une fiche sans compte dans le seed. */
const LAURENT_PROFILE_ID = 'a1200000-0000-4000-8000-000000000004'
/** Deux fiches de TechCorp sans identifiant client Pennylane, pour le lot. */
const BATCH_PROFILE_IDS = [
  'a1200000-0000-4000-8000-000000000003',
  'a1200000-0000-4000-8000-000000000005',
]
/** Fiche de Marketing Pro. */
const SCI_PINS_PROFILE_ID = 'b1200000-0000-4000-8000-000000000001'

const TITLE_PREFIX = 'e2e s32'
const RUN = Date.now().toString(36)
const CARD_NAME = 'Mes documents'

const VISITOR_RUN = Date.now().toString(16).slice(-4)
let visitorCount = 0
/** Adresse IPv6 de documentation, propre à cet essai et à ce navigateur. */
const nextVisitorIp = () =>
  `2001:db8:532:${VISITOR_RUN}::${(++visitorCount).toString(16)}`

const pdfFixture = (label: string) =>
  Buffer.from(`%PDF-1.4\n% ${label}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`)

type OutboxMessage = {to: string; text: string}

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

const databaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const testEnvPath = path.resolve(process.cwd(), '.env.test')
  const parsed = fs.existsSync(testEnvPath)
    ? dotenv.parse(fs.readFileSync(testEnvPath))
    : {}
  if (!parsed.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL introuvable : les préparations SQL attaquent la base en direct.'
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

/** Préparation et nettoyage hors scope : le seul `bypass` de la spec. */
const asMaintenance = <T>(callback: (client: Client) => Promise<T>) =>
  withAppRoleClient(async (client) => {
    await client.query('begin')
    try {
      await client.query(`select set_config('app.bypass_rls', 'on', true)`)
      const result = await callback(client)
      await client.query('commit')
      return result
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  })

const deleteSpecDocuments = () =>
  asMaintenance((client) =>
    client.query(`delete from member_document where title like $1`, [
      `${TITLE_PREFIX}%`,
    ])
  )

/** Les liens de connexion sont plafonnés par adresse et par jour. */
const resetRateLimits = () =>
  asMaintenance((client) =>
    client.query(
      `delete from rate_limit_event
        where organization_id in (select id from organization where slug = any($1))`,
      [['techcorp-solutions', 'marketing-pro']]
    )
  )

/** L'identifiant de la catégorie « Facture » d'une fiche, dans son association. */
const invoiceCategoryOf = (profileId: string) =>
  asMaintenance(async (client) => {
    const result = await client.query<{id: string}>(
      `select c.id from association_category c
         join member_profile p on p.organization_id = c.organization_id
        where p.id = $1 and c.domain = 'member_document'
          and c.name = 'Facture' and c.deleted_at is null`,
      [profileId]
    )
    expect(result.rowCount, 'la catégorie « Facture » du seed').toBe(1)
    return result.rows[0].id
  })

/**
 * Un document posé directement en base, pour les cas où seule la lecture
 * compte (liste, refus) : sa clé suit la forme du serveur, sans fichier.
 */
const insertDocument = async (input: {
  profileId: string
  title: string
  documentDate: string
}): Promise<string> => {
  const categoryId = await invoiceCategoryOf(input.profileId)
  return asMaintenance(async (client) => {
    const id = randomUUID()
    await client.query(
      `insert into member_document
         (id, organization_id, member_profile_id, title, category_id,
          document_date, file_key, file_bytes)
       select $1, p.organization_id, p.id, $3, $4, $5,
              p.organization_id || '/member-documents/' || p.id || '/' || $1 || '-' || $6 || '.pdf',
              10
         from member_profile p where p.id = $2`,
      [
        id,
        input.profileId,
        input.title,
        categoryId,
        input.documentDate,
        randomUUID(),
      ]
    )
    return id
  })
}

const documentRowsTitled = (title: string) =>
  asMaintenance(async (client) => {
    const result = await client.query<{
      id: string
      member_profile_id: string
      file_key: string
    }>(
      `select id, member_profile_id, file_key from member_document where title = $1`,
      [title]
    )
    return result.rows
  })

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
  await expect
    .poll(() => messagesTo(before, email).length, {timeout: 15_000})
    .toBe(1)
  const link = messagesTo(before, email)[0].text.match(
    /https?:\/\/\S+\/magic-link\/verify\?\S+/
  )?.[0]
  expect(link, 'la version texte porte l’URL en clair').toBeTruthy()
  await page.goto(link as string)
  await expect(page).toHaveURL(`${base}/dashboard`, {timeout: 15_000})
  return page
}

const myDocuments = (page: Page) => page.getByRole('region', {name: CARD_NAME})

/** L'identifiant lu dans l'adresse du lien : `/api/member-documents/{id}`. */
const documentIdIn = async (page: Page, title: string): Promise<string> => {
  const href = await page
    .getByRole('link', {name: new RegExp(`^Télécharger « ${title} »`)})
    .first()
    .getAttribute('href')
  const match = href?.match(/^\/api\/member-documents\/([0-9a-f-]{36})$/)
  expect(match, `adresse de téléchargement inattendue : ${href}`).toBeTruthy()
  return (match as RegExpMatchArray)[1]
}

const expectNotServed = async (page: Page, url: string) => {
  const served = await page.request.get(url)
  expect(served.status(), url).toBe(404)
  expect(served.headers()['content-type'] ?? '').not.toContain(
    'application/pdf'
  )
  expect((await served.body()).length).toBe(0)
}

test.beforeAll(async () => {
  await deleteSpecDocuments()
})

test.afterAll(async () => {
  await deleteSpecDocuments()
})

test.describe('Documents nominatifs — dépôt, lecture, cloisonnement (s32)', () => {
  const title = `${TITLE_PREFIX} Facture ${RUN}`
  const pdf = pdfFixture(title)
  let documentId = ''

  test.beforeEach(async () => {
    await resetRateLimits()
  })

  test('critère 1 : le bureau dépose un PDF sur une fiche ; le membre le voit et le télécharge, octets identiques', async ({
    browser,
  }) => {
    const board = await newBoardSession(browser, TENANT_A, OWNER_A)
    try {
      await board.goto(
        `${TENANT_A}/bureau/proprietaires/${LEFEVRE.profileIds[0]}/documents/nouveau`,
        {waitUntil: 'load'}
      )
      await expect(
        board.getByRole('heading', {level: 1, name: 'Déposer un document'})
      ).toBeVisible({timeout: 20_000})
      await board.getByRole('textbox', {name: 'Titre'}).fill(title)
      await board.getByRole('combobox', {name: 'Catégorie'}).click()
      await board.getByRole('option', {name: 'Facture'}).click()
      await board.getByLabel('Fichier', {exact: true}).setInputFiles({
        name: 'facture.pdf',
        mimeType: 'application/pdf',
        buffer: pdf,
      })
      await board.getByRole('button', {name: 'Déposer le document'}).click()
      await board.waitForURL(/\?documents=depose/, {timeout: 60_000})
      const section = board.getByRole('region', {name: 'Documents'})
      await expect(
        section.getByRole('status').filter({hasText: `« ${title} »`})
      ).toBeVisible({timeout: 20_000})
    } finally {
      await board.context().close()
    }

    const [row] = await documentRowsTitled(title)
    expect(row.member_profile_id).toBe(LEFEVRE.profileIds[0])
    expect(row.file_key).toMatch(
      new RegExp(
        `/member-documents/${LEFEVRE.profileIds[0]}/${row.id}-[0-9a-f-]{36}\\.pdf$`
      )
    )

    const member = await newMemberSession(browser, TENANT_A, LEFEVRE.email)
    try {
      await expect(myDocuments(member).getByText(title)).toBeVisible({
        timeout: 20_000,
      })
      documentId = await documentIdIn(member, title)
      expect(documentId).toBe(row.id)

      const served = await member.request.get(
        `${TENANT_A}/api/member-documents/${documentId}`
      )
      expect(served.status()).toBe(200)
      expect(served.headers()['content-type']).toContain('application/pdf')
      expect(served.headers()['cache-control']).toBe('no-store')
      expect(served.headers()['x-content-type-options']).toBe('nosniff')
      expect(served.headers()['content-disposition']).toMatch(/^attachment;/)
      expect(
        Buffer.from(await served.body()).equals(pdf),
        'les octets servis sont ceux du PDF déposé'
      ).toBe(true)
    } finally {
      await member.context().close()
    }
  })

  test('critère 4 — autorisation croisée : un autre membre, puis le bureau de B sur son domaine, ne reçoivent rien', async ({
    browser,
  }) => {
    const other = await newMemberSession(browser, TENANT_A, MOREAU.email)
    try {
      await expectNotServed(
        other,
        `${TENANT_A}/api/member-documents/${documentId}`
      )
      await expect(myDocuments(other)).toBeVisible({timeout: 20_000})
      await expect(other.getByText(title)).toHaveCount(0)
    } finally {
      await other.context().close()
    }

    const boardB = await newBoardSession(browser, TENANT_B, BOARD_B)
    try {
      await expectNotServed(
        boardB,
        `${TENANT_B}/api/member-documents/${documentId}`
      )
    } finally {
      await boardB.context().close()
    }
  })

  test('critère 4 — traversée de chemin : identifiant forgé, non uuid, et la clé sous /api/files ne servent rien', async ({
    browser,
  }) => {
    const [row] = await documentRowsTitled(title)
    const member = await newMemberSession(browser, TENANT_A, LEFEVRE.email)
    try {
      for (const forged of [
        `..%2F..%2F${row.file_key.split('/').map(encodeURIComponent).join('%2F')}`,
        `..%2F${LEFEVRE.profileIds[1]}`,
        'not-a-uuid',
        `${documentId}%2F..%2F..`,
      ]) {
        const served = await member.request.get(
          `${TENANT_A}/api/member-documents/${forged}`
        )
        expect(served.status(), forged).toBe(404)
        expect((await served.body()).length).toBe(0)
      }

      const encoded = row.file_key
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/')
      const publicRoute = await member.request.get(
        `${TENANT_A}/api/files/${encoded}`
      )
      expect(publicRoute.status()).toBe(404)
    } finally {
      await member.context().close()
    }
  })

  test('critère 3 : un compte relié à trois fiches voit les documents de chacune, avec son terrain', async ({
    browser,
  }) => {
    const titles = [1, 2].map(
      (rank) => `${TITLE_PREFIX} Convocation ${rank} ${RUN}`
    )
    await insertDocument({
      profileId: LEFEVRE.profileIds[1],
      title: titles[0],
      documentDate: '2026-02-01',
    })
    await insertDocument({
      profileId: LEFEVRE.profileIds[2],
      title: titles[1],
      documentDate: '2026-01-15',
    })

    const member = await newMemberSession(browser, TENANT_A, LEFEVRE.email)
    try {
      const card = myDocuments(member)
      await expect(card.getByText(title)).toBeVisible({timeout: 20_000})
      for (const [index, parcel] of [
        [0, '62'],
        [1, '63'],
      ] as const) {
        const line = card.getByRole('listitem').filter({hasText: titles[index]})
        await expect(line).toContainText(`Terrain : Parcelle ${parcel}`)
      }
      await expect(
        card.getByRole('listitem').filter({hasText: title})
      ).toContainText('Terrain : Parcelle 61')
      await expect(
        card.getByRole('listitem').filter({hasText: titles[1]})
      ).toContainText('Au nom de SCI Les Chênes')
    } finally {
      await member.context().close()
    }
  })

  test('critère 5 — vente : un document de 2019 reste au vendeur et reste invisible de l’acquéreur', async ({
    browser,
  }) => {
    const saleTitle = `${TITLE_PREFIX} Facture 2019 ${RUN}`
    const saleDocumentId = await insertDocument({
      profileId: MOREAU.profileId,
      title: saleTitle,
      documentDate: '2019-06-01',
    })

    const seller = await newMemberSession(browser, TENANT_A, MOREAU.email)
    try {
      const line = myDocuments(seller)
        .getByRole('listitem')
        .filter({hasText: saleTitle})
      await expect(line).toBeVisible({timeout: 20_000})
      await expect(line).toContainText(/Terrain : Parcelles? (.* )?9\b/)
    } finally {
      await seller.context().close()
    }

    await asMaintenance((client) =>
      client.query(
        `insert into member_profile_account (organization_id, member_profile_id, user_id)
         select p.organization_id, p.id, u.id
           from member_profile p, "user" u
          where p.id = $1 and u.email = $2
         on conflict do nothing`,
        [LAURENT_PROFILE_ID, PLAIN_MEMBER_A]
      )
    )
    try {
      const buyer = await newBoardSession(browser, TENANT_A, PLAIN_MEMBER_A)
      try {
        await buyer.goto(`${TENANT_A}/dashboard`, {waitUntil: 'load'})
        await expect(myDocuments(buyer)).toBeVisible({timeout: 20_000})
        await expect(buyer.getByText(saleTitle)).toHaveCount(0)
        await expectNotServed(
          buyer,
          `${TENANT_A}/api/member-documents/${saleDocumentId}`
        )
      } finally {
        await buyer.context().close()
      }
    } finally {
      await asMaintenance((client) =>
        client.query(
          `delete from member_profile_account
            where member_profile_id = $1
              and user_id = (select id from "user" where email = $2)`,
          [LAURENT_PROFILE_ID, PLAIN_MEMBER_A]
        )
      )
    }
  })

  test('critère 6 : le bureau de A voit tous les documents de A, aucun de B', async ({
    browser,
  }) => {
    const titleB = `${TITLE_PREFIX} Facture B ${RUN}`
    const documentB = await insertDocument({
      profileId: SCI_PINS_PROFILE_ID,
      title: titleB,
      documentDate: '2026-03-01',
    })

    const board = await newBoardSession(browser, TENANT_A, OWNER_A)
    try {
      await board.goto(
        `${TENANT_A}/bureau/documents-nominatifs?q=${encodeURIComponent('Lefèvre')}`,
        {waitUntil: 'load'}
      )
      await expect(
        board.getByRole('heading', {level: 1, name: 'Documents nominatifs'})
      ).toBeVisible({timeout: 20_000})
      await expect(
        board.getByRole('row').filter({hasText: title})
      ).toBeVisible()

      await board.goto(`${TENANT_A}/bureau/documents-nominatifs`, {
        waitUntil: 'load',
      })
      await expect(
        board.getByRole('heading', {level: 1, name: 'Documents nominatifs'})
      ).toBeVisible({timeout: 20_000})
      await expect(board.getByText(titleB)).toHaveCount(0)
      await expectNotServed(
        board,
        `${TENANT_A}/api/member-documents/${documentB}`
      )
    } finally {
      await board.context().close()
    }
  })

  test('critère 7 — lot : chaque fichier va à la fiche de sa référence, le fichier sans correspondance est écarté', async ({
    browser,
  }) => {
    const batchTitle = `${TITLE_PREFIX} Lot ${RUN}`
    const references = BATCH_PROFILE_IDS.map(() => randomUUID())
    const previous = await asMaintenance(async (client) => {
      const result = await client.query<{
        id: string
        pennylane_customer_id: string | null
      }>(
        `select id, pennylane_customer_id from member_profile where id = any($1::uuid[])`,
        [BATCH_PROFILE_IDS]
      )
      for (const [index, profileId] of BATCH_PROFILE_IDS.entries()) {
        await client.query(
          `update member_profile set pennylane_customer_id = $2 where id = $1`,
          [profileId, references[index]]
        )
      }
      return result.rows
    })

    try {
      const board = await newBoardSession(browser, TENANT_A, OWNER_A)
      try {
        await board.goto(`${TENANT_A}/bureau/documents-nominatifs/lot`, {
          waitUntil: 'load',
        })
        await expect(
          board.getByRole('heading', {level: 1, name: 'Déposer en lot'})
        ).toBeVisible({timeout: 20_000})
        await board
          .getByRole('textbox', {name: 'Titre des documents'})
          .fill(batchTitle)
        await board.getByRole('combobox', {name: 'Catégorie'}).click()
        await board.getByRole('option', {name: 'Facture'}).click()
        await board.getByLabel('Fichiers', {exact: true}).setInputFiles([
          {
            name: `${references[0]}_facture.pdf`,
            mimeType: 'application/pdf',
            buffer: pdfFixture('lot 1'),
          },
          {
            name: `${randomUUID()}_facture.pdf`,
            mimeType: 'application/pdf',
            buffer: pdfFixture('lot inconnu'),
          },
          {
            name: `${references[1].toUpperCase()}_facture.pdf`,
            mimeType: 'application/pdf',
            buffer: pdfFixture('lot 2'),
          },
        ])
        await board
          .getByRole('button', {name: 'Déposer les 3 documents'})
          .click()

        await expect(
          board.getByText(/Lot terminé : 2 documents déposés, 1 écarté\./)
        ).toBeVisible({timeout: 60_000})
        const report = board.getByRole('table', {
          name: 'Rapport du lot, fichiers écartés en tête',
        })
        await expect(report.locator('tbody tr').first()).toContainText('Écarté')
      } finally {
        await board.context().close()
      }

      const rows = await documentRowsTitled(batchTitle)
      expect(rows.map((row) => row.member_profile_id).sort()).toEqual(
        [...BATCH_PROFILE_IDS].sort()
      )
      for (const row of rows) {
        expect(row.file_key).toContain(
          `/member-documents/${row.member_profile_id}/`
        )
      }
    } finally {
      await asMaintenance(async (client) => {
        await client.query(`delete from member_document where title = $1`, [
          batchTitle,
        ])
        for (const row of previous) {
          await client.query(
            `update member_profile set pennylane_customer_id = $2 where id = $1`,
            [row.id, row.pennylane_customer_id]
          )
        }
      })
    }
  })

  test('retrait : le bureau retire le document depuis la fiche ; son adresse cesse de servir le fichier', async ({
    browser,
  }) => {
    const board = await newBoardSession(browser, TENANT_A, OWNER_A)
    try {
      await board.goto(
        `${TENANT_A}/bureau/proprietaires/${LEFEVRE.profileIds[0]}`,
        {waitUntil: 'load'}
      )
      const section = board.getByRole('region', {name: 'Documents'})
      await expect(section.getByText(title).first()).toBeVisible({
        timeout: 20_000,
      })
      await section
        .getByRole('row')
        .filter({hasText: title})
        .getByRole('button', {name: /Retirer/})
        .click()
      const confirm = board.getByRole('alertdialog')
      await expect(confirm).toContainText(`Retirer « ${title} » du dossier de`)
      await confirm.getByRole('button', {name: 'Retirer le document'}).click()
      await board.waitForURL(/\?documents=retire/, {timeout: 30_000})
      await expect(
        board.getByRole('status').filter({hasText: 'Document retiré.'})
      ).toBeVisible({timeout: 20_000})
    } finally {
      await board.context().close()
    }

    const member = await newMemberSession(browser, TENANT_A, LEFEVRE.email)
    try {
      await expect(myDocuments(member)).toBeVisible({timeout: 20_000})
      await expect(member.getByText(title)).toHaveCount(0)
      await expectNotServed(
        member,
        `${TENANT_A}/api/member-documents/${documentId}`
      )
    } finally {
      await member.context().close()
    }
  })
})
