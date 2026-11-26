/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import path from 'node:path'

import {Browser, expect, Page, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Modèles de documents — s36, critères 1 à 5 (ADR 074).
 *
 * Ce que seuls un navigateur, deux domaines et la base prouvent : le bureau
 * crée un modèle et le retrouve (1), une variable inconnue est refusée et
 * nommée, rien n'est enregistré (4), un document est produit pour une fiche
 * du seed et téléchargé, ou déposé dans son dossier et servi par la route de
 * s32 (2), un lot sur un groupe dépose un document par fiche (3), et les
 * modèles de A ne sont jamais visibles de B (5). Données créées et retirées
 * par la spec.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
/** TechCorp Solutions dans le seed. */
const TENANT_A = `http://localhost:${PORT}`
/** Marketing Pro dans le seed. */
const TENANT_B = `http://127.0.0.1:${PORT}`

const PASSWORD = 'Azerty123'
/** Présidente de TechCorp Solutions. */
const OWNER_A = 'user-owner@gmail.com'
/** Présidente de Marketing Pro. */
const OWNER_B = 'admin-owner@gmail.com'

/** Marcel Laurent, fiche de TechCorp. */
const LAURENT_PROFILE_ID = 'a1200000-0000-4000-8000-000000000004'
/** Deux fiches de TechCorp, réunies en groupe par la spec pour le lot. */
const GROUP_PROFILE_IDS = [
  'a1200000-0000-4000-8000-000000000003',
  'a1200000-0000-4000-8000-000000000005',
]

const RUN = Date.now().toString(36)
const MARKER = `e2e s36 ${RUN}`
const TEMPLATE_NAME = `${MARKER} convocation`
const DOCUMENT_TITLE = `${MARKER} convocation AG`
const LOT_TITLE = `${MARKER} lot`
const GROUP_NAME = `${MARKER} groupe`
const DOCUMENT_DATE = '2026-11-25'
const DOCUMENT_FILE_NAME = 'document-25-11-2026.pdf'

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
      'DATABASE_URL introuvable : les préparations SQL attaquent la base en direct.'
    )
  }
  return parsed.DATABASE_URL
}

/** Préparation et nettoyage hors scope : le seul `bypass` de la spec. */
const asMaintenance = async <T>(
  callback: (client: Client) => Promise<T>
): Promise<T> => {
  const client = new Client({connectionString: databaseUrl()})
  await client.connect()
  try {
    await client.query('begin')
    await client.query(`select set_config('app.bypass_rls', 'on', true)`)
    const result = await callback(client)
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    await client.end()
  }
}

const cleanUp = () =>
  asMaintenance(async (client) => {
    await client.query(`delete from member_document where title like $1`, [
      `${MARKER}%`,
    ])
    await client.query(`delete from document_template where name like $1`, [
      `${MARKER}%`,
    ])
    await client.query(`delete from recipient_group where name like $1`, [
      `${MARKER}%`,
    ])
  })

const templatesNamed = (name: string) =>
  asMaintenance(async (client) => {
    const result = await client.query<{id: string; organization_id: string}>(
      `select id, organization_id from document_template where name = $1`,
      [name]
    )
    return result.rows
  })

const documentsTitled = (title: string) =>
  asMaintenance(async (client) => {
    const result = await client.query<{
      id: string
      member_profile_id: string
      document_date: string
    }>(
      `select id, member_profile_id, document_date::text as document_date
         from member_document where title = $1`,
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
  const context = await browser.newContext({
    locale: 'fr-FR',
    acceptDownloads: true,
  })
  await context.addCookies([{name: 'NEXT_LOCALE', value: 'fr', url: base}])
  const page = await context.newPage()
  await login(page, base, email)
  return page
}

let templateId = ''

test.beforeAll(cleanUp)
test.afterAll(cleanUp)

test('critère 1 — le bureau crée un modèle et le retrouve dans la liste', async ({
  browser,
}) => {
  test.setTimeout(120_000)
  const board = await newBoardSession(browser, TENANT_A, OWNER_A)
  try {
    await board.goto(`${TENANT_A}/bureau/modeles-documents/nouveau`, {
      waitUntil: 'load',
    })
    await expect(
      board.getByRole('heading', {level: 1, name: 'Nouveau modèle'})
    ).toBeVisible({timeout: 20_000})
    await board
      .getByRole('textbox', {name: 'Nom du modèle'})
      .fill(TEMPLATE_NAME)
    await board
      .getByRole('textbox', {name: 'Objet'})
      .fill('Convocation à l’assemblée générale du {date}')
    await board
      .getByRole('textbox', {name: 'Texte du document'})
      .fill(
        'Madame, Monsieur {nom},\n\nPropriétaire de la parcelle {parcelle}, vous êtes convoqué(e) à l’assemblée générale de {association}.'
      )
    await board.getByRole('button', {name: 'Enregistrer le modèle'}).click()

    await board.waitForURL(
      /\/bureau\/modeles-documents\/[0-9a-f-]+\?enregistre=1/,
      {
        timeout: 30_000,
      }
    )
    await expect(board.getByRole('status')).toContainText('Modèle enregistré.')
    const [saved] = await templatesNamed(TEMPLATE_NAME)
    expect(saved, 'le modèle est enregistré').toBeTruthy()
    templateId = saved.id

    await board.goto(`${TENANT_A}/bureau/modeles-documents`, {
      waitUntil: 'load',
    })
    const row = board.getByRole('row').filter({hasText: TEMPLATE_NAME})
    await expect(row).toBeVisible({timeout: 20_000})
    await expect(row).toContainText('{nom} {parcelle} {date} {association}')
  } finally {
    await board.context().close()
  }
})

test('critère 4 — une variable inconnue est refusée et nommée, rien n’est enregistré', async ({
  browser,
}) => {
  test.setTimeout(120_000)
  const rejectedName = `${MARKER} refusé`
  const board = await newBoardSession(browser, TENANT_A, OWNER_A)
  try {
    await board.goto(`${TENANT_A}/bureau/modeles-documents/nouveau`, {
      waitUntil: 'load',
    })
    await board.getByRole('textbox', {name: 'Nom du modèle'}).fill(rejectedName)
    await board.getByRole('textbox', {name: 'Objet'}).fill('Convocation')
    await board
      .getByRole('textbox', {name: 'Texte du document'})
      .fill('Madame, Monsieur {nom}, demeurant {adresse}.')
    await board.getByRole('button', {name: 'Enregistrer le modèle'}).click()

    const summary = board.getByRole('alert').filter({
      hasText: 'Le modèle n’a pas été enregistré.',
    })
    await expect(summary).toBeVisible({timeout: 20_000})
    await expect(summary).toContainText(
      'Texte du document : variable inconnue {adresse}.'
    )
    await expect(
      board.getByText(
        'Variable inconnue : {adresse}. Les variables possibles sont {nom}, {parcelle}, {date} et {association}.'
      )
    ).toBeVisible()
    expect(await templatesNamed(rejectedName)).toHaveLength(0)
  } finally {
    await board.context().close()
  }
})

test('critère 2 — le document d’une fiche du seed est produit et téléchargé, rien n’est conservé', async ({
  browser,
}) => {
  test.setTimeout(120_000)
  expect(templateId, 'le modèle du critère 1').toBeTruthy()
  const board = await newBoardSession(browser, TENANT_A, OWNER_A)
  try {
    const response = await board.request.get(
      `${TENANT_A}/api/document-templates/${templateId}/document?fiche=${LAURENT_PROFILE_ID}&date=${DOCUMENT_DATE}`
    )
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/pdf')
    expect(response.headers()['cache-control']).toContain('no-store')
    expect(response.headers()['content-disposition']).toBe(
      `attachment; filename="${DOCUMENT_FILE_NAME}"`
    )
    const body = Buffer.from(await response.body())
    expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-')

    await board.goto(
      `${TENANT_A}/bureau/proprietaires/${LAURENT_PROFILE_ID}/documents/generer`,
      {waitUntil: 'load'}
    )
    await board.getByRole('combobox', {name: 'Modèle'}).click()
    await board.getByRole('option', {name: TEMPLATE_NAME}).click()
    const download = board.waitForEvent('download')
    await board.getByRole('button', {name: 'Télécharger le PDF'}).click()
    expect((await download).suggestedFilename()).toBe(DOCUMENT_FILE_NAME)
    await expect(board.getByRole('status')).toContainText(
      'Document téléchargé.'
    )
    expect(await documentsTitled(DOCUMENT_TITLE)).toHaveLength(0)
  } finally {
    await board.context().close()
  }
})

test('critère 2 — case cochée : le document est déposé sur la fiche, servi par la route de s32', async ({
  browser,
}) => {
  test.setTimeout(120_000)
  const board = await newBoardSession(browser, TENANT_A, OWNER_A)
  try {
    await board.goto(
      `${TENANT_A}/bureau/proprietaires/${LAURENT_PROFILE_ID}/documents/generer`,
      {waitUntil: 'load'}
    )
    await board.getByRole('combobox', {name: 'Modèle'}).click()
    await board.getByRole('option', {name: TEMPLATE_NAME}).click()
    await board
      .getByRole('checkbox', {
        name: 'Déposer aussi dans le dossier de la fiche',
      })
      .click()
    await board.getByRole('combobox', {name: 'Catégorie'}).click()
    await board.getByRole('option', {name: 'Convocation'}).click()
    await board.getByRole('textbox', {name: 'Titre'}).fill(DOCUMENT_TITLE)
    const download = board.waitForEvent('download')
    await board
      .getByRole('button', {name: 'Télécharger et déposer le PDF'})
      .click()
    expect((await download).suggestedFilename()).toBe(DOCUMENT_FILE_NAME)
    await expect(board.getByRole('status')).toContainText(
      'Il est aussi déposé dans le dossier'
    )

    const deposited = await documentsTitled(DOCUMENT_TITLE)
    expect(deposited).toHaveLength(1)
    expect(deposited[0].member_profile_id).toBe(LAURENT_PROFILE_ID)
    const served = await board.request.get(
      `${TENANT_A}/api/member-documents/${deposited[0].id}`
    )
    expect(served.status()).toBe(200)
    expect(served.headers()['content-type']).toContain('application/pdf')
    expect(
      Buffer.from(await served.body())
        .subarray(0, 5)
        .toString('latin1')
    ).toBe('%PDF-')
  } finally {
    await board.context().close()
  }
})

test('critère 3 — un lot sur un groupe de deux fiches dépose un document sur chacune', async ({
  browser,
}) => {
  test.setTimeout(180_000)
  await asMaintenance(async (client) => {
    const group = await client.query<{id: string}>(
      `insert into recipient_group (organization_id, name)
       select organization_id, $1 from member_profile where id = $2
       returning id`,
      [GROUP_NAME, GROUP_PROFILE_IDS[0]]
    )
    for (const profileId of GROUP_PROFILE_IDS) {
      await client.query(
        `insert into recipient_group_member (organization_id, group_id, member_profile_id)
         select organization_id, $1, id from member_profile where id = $2`,
        [group.rows[0].id, profileId]
      )
    }
  })

  const board = await newBoardSession(browser, TENANT_A, OWNER_A)
  try {
    await board.goto(
      `${TENANT_A}/bureau/modeles-documents/lot?modele=${templateId}`,
      {waitUntil: 'load'}
    )
    await expect(
      board.getByRole('heading', {level: 1, name: 'Générer en lot'})
    ).toBeVisible({timeout: 20_000})
    await board.getByRole('radio', {name: 'Un groupe'}).click()
    await board.getByRole('combobox', {name: 'Groupe'}).click()
    await board.getByRole('option', {name: `${GROUP_NAME} (2 fiches)`}).click()
    await board.getByRole('combobox', {name: 'Catégorie'}).click()
    await board.getByRole('option', {name: 'Convocation'}).click()
    await board
      .getByRole('textbox', {name: 'Titre des documents'})
      .fill(LOT_TITLE)
    await board
      .getByRole('button', {name: 'Générer et déposer les 2 documents'})
      .click()

    await expect(board.getByRole('status')).toContainText(
      'Lot terminé : 2 documents déposés, aucun échec.',
      {timeout: 60_000}
    )
    const deposited = await documentsTitled(LOT_TITLE)
    expect(deposited.map((row) => row.member_profile_id).sort()).toEqual(
      [...GROUP_PROFILE_IDS].sort()
    )
  } finally {
    await board.context().close()
  }
})

test('critère 5 — les modèles de A ne sont jamais visibles de B', async ({
  browser,
}) => {
  test.setTimeout(120_000)
  const ownerB = await newBoardSession(browser, TENANT_B, OWNER_B)
  try {
    await ownerB.goto(`${TENANT_B}/bureau/modeles-documents/${templateId}`, {
      waitUntil: 'load',
    })
    await expect(ownerB.getByText('Page non trouvée')).toBeVisible({
      timeout: 20_000,
    })
    await expect(ownerB.getByText(TEMPLATE_NAME)).toHaveCount(0)

    await ownerB.goto(`${TENANT_B}/bureau/modeles-documents`, {
      waitUntil: 'load',
    })
    await expect(
      ownerB.getByRole('heading', {level: 1, name: 'Modèles de documents'})
    ).toBeVisible({timeout: 20_000})
    await expect(ownerB.getByText(TEMPLATE_NAME)).toHaveCount(0)

    const route = await ownerB.request.get(
      `${TENANT_B}/api/document-templates/${templateId}/document?fiche=${LAURENT_PROFILE_ID}&date=${DOCUMENT_DATE}`
    )
    expect(route.status()).toBe(404)
  } finally {
    await ownerB.context().close()
  }
})
