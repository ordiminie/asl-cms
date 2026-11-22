/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import path from 'node:path'

import {expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Documents partagés — s31, critères 1 à 5 (ADR 069).
 *
 * Ce que seuls un navigateur, deux domaines et la base prouvent : le dépôt
 * par le bureau, la lecture et le téléchargement par un membre (octets
 * identiques), le refus d'un visiteur sans session **par URL directe**, le
 * 404 d'un identifiant de A demandé sur le domaine de B, le refus de la clé
 * de stockage sous la route publique `/api/files`, et l'adresse d'un
 * document retiré qui cesse de servir le fichier.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
/** TechCorp Solutions dans le seed. */
const TENANT_A = `http://localhost:${PORT}`
/** Marketing Pro dans le seed. */
const TENANT_B = `http://127.0.0.1:${PORT}`

const PASSWORD = 'Azerty123'
/** Présidente de TechCorp Solutions. */
const OWNER_A = 'user-owner@gmail.com'
/** Membre simple de TechCorp Solutions, jamais du bureau. */
const MEMBER_A = 'user@gmail.com'
/** Membre de TechCorp Solutions **et** du bureau de Marketing Pro (seed). */
const MEMBER_A_BOARD_B = 'admin@gmail.com'

const BUREAU_ROUTE = '/bureau/documents'
const CARD_NAME = 'Documents de l’association'
const TITLE_PREFIX = 'e2e s31'

const pdfFixture = (label: string) =>
  Buffer.from(`%PDF-1.4\n% ${label}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`)

const databaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const testEnvPath = path.resolve(process.cwd(), '.env.test')
  const parsed = fs.existsSync(testEnvPath)
    ? dotenv.parse(fs.readFileSync(testEnvPath))
    : {}

  const url = parsed.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL introuvable : la spec relit la clé de stockage en base.'
    )
  }
  return url
}

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

const inBypass = async <T>(
  client: Client,
  callback: () => Promise<T>
): Promise<T> => {
  await client.query('begin')
  try {
    await client.query(`select set_config('app.bypass_rls', 'on', true)`)
    const result = await callback()
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  }
}

/** Repart d'une liste sans document de la spec, en CI comme en local. */
const deleteSpecDocuments = async () => {
  await withAppRoleClient((client) =>
    inBypass(client, () =>
      client.query(`delete from shared_document where title like $1`, [
        `${TITLE_PREFIX}%`,
      ])
    )
  )
}

/** La clé de stockage d'un document, lue en base — jamais dans la page. */
const fileKeyOf = async (documentId: string): Promise<string> =>
  withAppRoleClient(async (client) => {
    const result = await inBypass(client, () =>
      client.query<{file_key: string}>(
        `select file_key from shared_document where id = $1`,
        [documentId]
      )
    )
    expect(result.rowCount, 'le document doit exister en base').toBe(1)
    return result.rows[0].file_key
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

const downloadLinkOf = (page: Page, title: string) =>
  page.getByRole('link', {
    name: new RegExp(`^Télécharger « ${title} » \\(PDF`),
  })

/** L'identifiant lu dans l'adresse du lien : `/api/documents/{id}`. */
const documentIdOf = async (page: Page, title: string): Promise<string> => {
  const href = await downloadLinkOf(page, title).first().getAttribute('href')
  const match = href?.match(/^\/api\/documents\/([0-9a-f-]{36})$/)
  expect(match, `adresse de téléchargement inattendue : ${href}`).toBeTruthy()
  return (match as RegExpMatchArray)[1]
}

const depositDocument = async (page: Page, title: string, pdf: Buffer) => {
  await page.goto(`${TENANT_A}${BUREAU_ROUTE}/nouveau`, {waitUntil: 'load'})
  await expect(
    page.getByRole('heading', {level: 1, name: 'Déposer un document'})
  ).toBeVisible({timeout: 20_000})

  await page.getByRole('textbox', {name: 'Titre'}).fill(title)
  await page.getByRole('combobox', {name: 'Catégorie'}).click()
  await page.getByRole('option', {name: 'Statuts'}).click()
  await page.getByLabel('Fichier', {exact: true}).setInputFiles({
    name: 'statuts.pdf',
    mimeType: 'application/pdf',
    buffer: pdf,
  })
  await page.getByRole('button', {name: 'Déposer le document'}).click()

  await page.waitForURL(/\/bureau\/documents\?statut=depose/, {
    timeout: 60_000,
  })
  await expect(
    page.getByRole('status').filter({hasText: `« ${title} »`})
  ).toBeVisible({timeout: 20_000})
}

test.describe.configure({mode: 'serial'})

test.beforeAll(async () => {
  await deleteSpecDocuments()
})

test.afterAll(async () => {
  await deleteSpecDocuments()
})

test.describe('Documents partagés — dépôt, lecture, isolation, retrait', () => {
  const title = `${TITLE_PREFIX} Statuts ${Date.now().toString(36)}`
  const pdf = pdfFixture(title)
  let documentId = ''

  test('critère 1 : le bureau dépose un PDF et le voit dans sa liste', async ({
    page,
  }) => {
    await login(page, TENANT_A, OWNER_A)
    await depositDocument(page, title, pdf)

    const row = page.getByRole('row').filter({hasText: title})
    await expect(row).toBeVisible()
    await expect(row).toContainText('Statuts')
    documentId = await documentIdOf(page, title)
  })

  test('critère 2 : le membre le voit dans son espace et le télécharge, octets identiques', async ({
    page,
  }) => {
    await login(page, TENANT_A, MEMBER_A)
    await page.goto(`${TENANT_A}/dashboard`, {waitUntil: 'load'})

    const card = page.getByRole('region', {name: CARD_NAME})
    await expect(card.getByText(title)).toBeVisible({timeout: 20_000})
    expect(await documentIdOf(page, title)).toBe(documentId)

    const served = await page.request.get(
      `${TENANT_A}/api/documents/${documentId}`
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
  })

  test('critère 3 : sans session, ni la liste ni le fichier, même par URL directe', async ({
    browser,
  }) => {
    const visitor = await browser.newContext()
    const page = await visitor.newPage()
    try {
      await page.goto(`${TENANT_A}/dashboard`)
      await expect(page).toHaveURL(/\/login/)

      const served = await page.request.get(
        `${TENANT_A}/api/documents/${documentId}`
      )
      expect(served.status()).toBe(401)
      expect(served.headers()['content-type'] ?? '').not.toContain(
        'application/pdf'
      )
      expect((await served.body()).length).toBe(0)
    } finally {
      await visitor.close()
    }
  })

  test('critère 4 : l’identifiant de A demandé sur le domaine de B ne rend rien', async ({
    page,
  }) => {
    await login(page, TENANT_B, MEMBER_A_BOARD_B)

    const served = await page.request.get(
      `${TENANT_B}/api/documents/${documentId}`
    )
    expect(served.status()).toBe(404)
    expect((await served.body()).length).toBe(0)
  })

  test('ADR 069 : la clé de stockage n’est pas servie par la route publique des fichiers', async ({
    browser,
  }) => {
    const key = await fileKeyOf(documentId)
    expect(key).toMatch(/\/shared-documents\//)

    const visitor = await browser.newContext()
    try {
      const encoded = key
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/')
      const served = await visitor.request.get(
        `${TENANT_A}/api/files/${encoded}`
      )
      expect(served.status()).toBe(404)
    } finally {
      await visitor.close()
    }
  })

  test('critère 5 : le bureau retire le document ; il disparaît et son adresse cesse de servir le fichier', async ({
    page,
    browser,
  }) => {
    await login(page, TENANT_A, OWNER_A)
    await page.goto(`${TENANT_A}${BUREAU_ROUTE}`, {waitUntil: 'load'})

    await page
      .getByRole('row')
      .filter({hasText: title})
      .getByRole('button', {name: /Retirer/})
      .click()
    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toContainText(`Retirer « ${title} » ?`)
    await confirm.getByRole('button', {name: 'Retirer le document'}).click()

    await page.waitForURL(/\/bureau\/documents\?statut=retire/, {
      timeout: 30_000,
    })
    await expect(
      page.getByRole('status').filter({hasText: 'Document retiré.'})
    ).toBeVisible({timeout: 20_000})
    await expect(page.getByRole('row').filter({hasText: title})).toHaveCount(0)

    const member = await browser.newContext()
    const memberPage = await member.newPage()
    try {
      await login(memberPage, TENANT_A, MEMBER_A)
      await memberPage.goto(`${TENANT_A}/dashboard`, {waitUntil: 'load'})
      await expect(
        memberPage.getByRole('region', {name: CARD_NAME})
      ).toBeVisible({timeout: 20_000})
      await expect(memberPage.getByText(title)).toHaveCount(0)

      const served = await memberPage.request.get(
        `${TENANT_A}/api/documents/${documentId}`
      )
      expect(served.status()).toBe(404)
    } finally {
      await member.close()
    }
  })
})
