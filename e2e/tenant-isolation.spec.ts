/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import fs from 'node:fs'
import path from 'node:path'

import {expect, test} from '@playwright/test'
import dotenv from 'dotenv'
import {Client} from 'pg'

/**
 * Isolation multi-tenant — critères 2, 4, 6 et 7 de s01.
 *
 * C'est le **seul** niveau où la RLS se prouve : `src/db/models/db.ts` refuse
 * toute connexion en test unitaire et les repositories y sont mockés
 * (ADR 002, `docs/architecture.md`). Deux moitiés donc : l'application servie
 * sur deux domaines, puis la base attaquée **en direct**, couche applicative
 * court-circuitée.
 *
 * ⚠️ Trois hôtes, aucun `/etc/hosts`, aucun DNS : Chromium interdit de
 * surcharger l'en-tête `Host` (en-tête protégé), mais tout 127.0.0.0/8 est du
 * loopback et `localhost` / `127.0.0.1` / `127.0.0.2` sont trois `Host`
 * distincts qui atteignent le même serveur. Le seed rattache les deux premiers
 * à deux associations et laisse le troisième inconnu.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'

/** TechCorp Solutions dans le seed, module `voirie` actif. */
const TENANT_A = `http://localhost:${PORT}`
const TENANT_A_NAME = 'TechCorp Solutions'
const TENANT_A_SUBJECT = 'Lampadaire cassé rue des Tilleuls'

/** Marketing Pro dans le seed, aucun module actif. */
const TENANT_B = `http://127.0.0.1:${PORT}`
const TENANT_B_SUBJECT = 'Portail du lotissement bloqué'

/** Aucune association ne sert ce domaine. */
const UNKNOWN_DOMAIN = `http://127.0.0.2:${PORT}`

const PASSWORD = 'Azerty123'

const databaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const testEnvPath = path.resolve(process.cwd(), '.env.test')
  const parsed = fs.existsSync(testEnvPath)
    ? dotenv.parse(fs.readFileSync(testEnvPath))
    : {}

  const url = parsed.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL introuvable : la preuve RLS attaque la base en direct.'
    )
  }
  return url
}

/**
 * Une connexion sous le **rôle applicatif**, celui de l'application. Le rôle
 * propriétaire est superuser : `FORCE ROW LEVEL SECURITY` ne le contraint pas,
 * et la preuve ne vaudrait rien sous lui.
 */
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

const tenantIds = async (client: Client) => {
  const result = await client.query<{slug: string; id: string}>(
    `select slug, id from organization where slug in ('techcorp-solutions', 'marketing-pro')`
  )
  const bySlug = new Map(result.rows.map((row) => [row.slug, row.id]))
  const a = bySlug.get('techcorp-solutions')
  const b = bySlug.get('marketing-pro')
  expect(a, 'le seed doit porter les deux associations').toBeTruthy()
  expect(b, 'le seed doit porter les deux associations').toBeTruthy()
  return {a: a as string, b: b as string}
}

test.describe('critère 2 — le tenant vient du domaine appelé', () => {
  test('deux domaines servent deux associations distinctes', async ({page}) => {
    // Le module `voirie` est actif chez A, inactif chez B : la même URL se
    // comporte donc différemment selon le domaine, ce qui ne peut venir que de
    // la résolution par `Host`.
    const responseA = await page.goto(`${TENANT_A}/fr/modules/voirie`)
    expect(responseA?.status()).toBe(200)
    await expect(page.getByTestId('module-actif')).toContainText(TENANT_A_NAME)

    const responseB = await page.goto(`${TENANT_B}/fr/modules/voirie`)
    expect(responseB?.status()).toBe(200)
    await expect(page.getByTestId('module-actif')).toHaveCount(0)
    await expect(page.getByText(TENANT_A_NAME)).toHaveCount(0)
  })

  test('un domaine inconnu ne sert le contenu d’aucune association', async ({
    page,
  }) => {
    const response = await page.goto(`${UNKNOWN_DOMAIN}/fr`)

    // Le statut est **200**, et l'assertion est stricte : sous Cache
    // Components, `notFound()` part après le début de la réponse (ADR 013,
    // mesuré). Le jour où Next permettra de décider le statut avant le shell,
    // ce test tombera — c'est le signal attendu pour rouvrir l'ADR 013, pas
    // une régression à masquer en ajustant l'assertion.
    expect(response?.status()).toBe(200)

    await expect(page.getByTestId('module-actif')).toHaveCount(0)
    await expect(page.getByText(TENANT_A_NAME)).toHaveCount(0)
  })

  test('une route qui n’existe pas rend, elle, un vrai 404', async ({page}) => {
    // Le cas de référence de l'ADR 013 : sans route correspondante, la
    // décision précède le premier octet.
    const response = await page.goto(`${TENANT_A}/fr/does-not-exist`)

    expect(response?.status()).toBe(404)
  })
})

test.describe('critère 4 — activation des modules', () => {
  test('la route d’un module inactif est introuvable', async ({page}) => {
    const response = await page.goto(`${TENANT_A}/fr/modules/vote`)

    expect(response?.status()).toBe(200)
    await expect(page.getByTestId('module-actif')).toHaveCount(0)
  })

  test('une clé de module inconnue est introuvable, pas active par défaut', async ({
    page,
  }) => {
    const response = await page.goto(`${TENANT_A}/fr/modules/module-fictif`)

    expect(response?.status()).toBe(200)
    await expect(page.getByTestId('module-actif')).toHaveCount(0)
  })
})

test.describe('critère 6 — le tenant A ne voit rien du tenant B', () => {
  test('le back-office ne montre que les soumissions du domaine appelé', async ({
    page,
  }) => {
    await page.goto(`${TENANT_A}/en/login`)
    await expect(page.locator('form')).toBeVisible()
    await page.fill('input[name="email"]', 'admin@gmail.com')
    await page.fill('input[name="password"]', PASSWORD)
    await page.click("button[type='submit']")
    await page.waitForURL((url) => !url.toString().includes('/login'), {
      timeout: 15_000,
    })

    await page.goto(`${TENANT_A}/en/admin/submissions`, {waitUntil: 'load'})

    await expect(page.getByText(TENANT_A_SUBJECT)).toBeVisible()
    await expect(page.getByText(TENANT_B_SUBJECT)).toHaveCount(0)
  })

  test('un identifiant forgé ne rend rien : la policy ne connaît pas la ligne', async () => {
    await withAppRoleClient(async (client) => {
      const {a} = await tenantIds(client)

      // Hors scope, la ligne de B est deja invisible : on passe par la porte
      // `app.bypass_rls` — celle que l'ADR 002 reserve au SuperAdmin — juste
      // pour connaitre l'identifiant a forger.
      await client.query('begin')
      await client.query(`select set_config('app.bypass_rls', 'on', true)`)
      const owned = await client.query<{id: string}>(
        `select id from user_submissions where subject = $1`,
        [TENANT_B_SUBJECT]
      )
      await client.query('commit')

      const forgedId = owned.rows[0]?.id
      expect(forgedId, 'le seed doit porter une soumission chez B').toBeTruthy()

      await client.query('begin')
      await client.query(`select set_config('app.organization_id', $1, true)`, [
        a,
      ])
      const read = await client.query(
        `select id from user_submissions where id = $1`,
        [forgedId]
      )
      await client.query('commit')

      expect(read.rowCount).toBe(0)
    })
  })
})

test.describe('critère 7 — la policy refuse, couche applicative court-circuitée', () => {
  test('hors scope de tenant, aucune ligne ne sort', async () => {
    await withAppRoleClient(async (client) => {
      const result = await client.query('select id from user_submissions')

      // « Un oubli de scope ne fuite pas : il ne retourne rien. »
      expect(result.rowCount).toBe(0)
    })
  })

  test('dans le scope de A, seules les lignes de A sortent', async () => {
    await withAppRoleClient(async (client) => {
      const {a} = await tenantIds(client)

      await client.query('begin')
      await client.query(`select set_config('app.organization_id', $1, true)`, [
        a,
      ])
      const rows = await client.query<{organization_id: string}>(
        'select organization_id from user_submissions'
      )
      await client.query('commit')

      expect(rows.rowCount).toBeGreaterThan(0)
      for (const row of rows.rows) {
        expect(row.organization_id).toBe(a)
      }
    })
  })

  test('écrire pour un autre tenant est refusé, pas silencieusement ignoré', async () => {
    await withAppRoleClient(async (client) => {
      const {a, b} = await tenantIds(client)

      await client.query('begin')
      await client.query(`select set_config('app.organization_id', $1, true)`, [
        a,
      ])

      await expect(
        client.query(
          `insert into user_submissions (organization_id, email, type, subject, message)
           values ($1, 'forge@example.test', 'contact', 'Forgé', 'Écriture hors tenant')`,
          [b]
        )
      ).rejects.toThrow(/row-level security/i)

      await client.query('rollback')
    })
  })

  test('le rôle applicatif n’est ni superuser ni BYPASSRLS, sans quoi tout ce qui précède est vide de sens', async () => {
    await withAppRoleClient(async (client) => {
      const result = await client.query<{
        rolsuper: boolean
        rolbypassrls: boolean
      }>(
        `select rolsuper, rolbypassrls from pg_roles where rolname = current_user`
      )

      expect(result.rows[0]?.rolsuper).toBe(false)
      expect(result.rows[0]?.rolbypassrls).toBe(false)
    })
  })
})
