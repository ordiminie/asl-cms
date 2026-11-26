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
    const responseA = await page.goto(`${TENANT_A}/modules/voirie`)
    expect(responseA?.status()).toBe(200)
    await expect(page.getByTestId('module-actif')).toContainText(TENANT_A_NAME)

    const responseB = await page.goto(`${TENANT_B}/modules/voirie`)
    expect(responseB?.status()).toBe(200)
    await expect(page.getByTestId('module-actif')).toHaveCount(0)
    await expect(page.getByText(TENANT_A_NAME)).toHaveCount(0)
  })

  test('un domaine inconnu ne sert le contenu d’aucune association', async ({
    page,
  }) => {
    const response = await page.goto(`${UNKNOWN_DOMAIN}/`)

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
    //
    // ⚠️ Deux segments, et non un seul comme avant s04 : depuis l'ADR 020 les
    // pages CMS sont servies à la racine (`/{slug}`), donc **tout** chemin à un
    // seul segment trouve désormais une route. Un slug inconnu y rend un 200
    // portant l'UI « Page non trouvée » (preuve dans `page-cms.spec.ts`) ; seul
    // un chemin qu'aucune route ne peut matcher garde le vrai 404.
    const response = await page.goto(`${TENANT_A}/does-not-exist/nested`)

    expect(response?.status()).toBe(404)
  })
})

test.describe('critère 4 — activation des modules', () => {
  test('la route d’un module inactif est introuvable', async ({page}) => {
    const response = await page.goto(`${TENANT_A}/modules/vote`)

    expect(response?.status()).toBe(200)
    await expect(page.getByTestId('module-actif')).toHaveCount(0)
  })

  test('une clé de module inconnue est introuvable, pas active par défaut', async ({
    page,
  }) => {
    const response = await page.goto(`${TENANT_A}/modules/module-fictif`)

    expect(response?.status()).toBe(200)
    await expect(page.getByTestId('module-actif')).toHaveCount(0)
  })
})

test.describe('critère 6 — le tenant A ne voit rien du tenant B', () => {
  test('le back-office ne montre que les soumissions du domaine appelé', async ({
    page,
  }) => {
    await page.goto(`${TENANT_A}/login/prestataire`)
    await expect(page.locator('form')).toBeVisible()
    await page.fill('input[name="email"]', 'superadmin@gmail.com')
    await page.fill('input[name="password"]', PASSWORD)
    await page.click("button[type='submit']")
    await page.waitForURL((url) => !url.toString().includes('/login'), {
      timeout: 15_000,
    })

    await page.goto(`${TENANT_A}/admin/submissions`, {waitUntil: 'load'})

    // Au premier chargement à froid, le tableau existe un temps en deux copies
    // masquées (streaming puis reprise React) : getByText les verrait toutes
    // les deux, getByRole ne retient que la cellule réellement rendue.
    await expect(page.getByRole('cell', {name: TENANT_A_SUBJECT})).toBeVisible({
      timeout: 15_000,
    })
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

/**
 * s54 (ADR 056) : les adresses d'une fiche sont sous RLS forcée, sur leur
 * propre colonne de tenant. Le seed en porte dans les deux associations.
 */
test.describe('s54 — member_profile_email isolée entre associations', () => {
  /** Une adresse de TechCorp (seed), titulaire et supplémentaire. */
  const ADDRESS_A = 'p.ferrand@techcorp-solutions.test'

  const inScope = async <T>(
    client: Client,
    organizationId: string,
    read: () => Promise<T>
  ): Promise<T> => {
    await client.query('begin')
    try {
      await client.query(`select set_config('app.organization_id', $1, true)`, [
        organizationId,
      ])
      return await read()
    } finally {
      await client.query('rollback')
    }
  }

  test('hors scope de tenant, aucune adresse ne sort', async () => {
    await withAppRoleClient(async (client) => {
      const result = await client.query('select id from member_profile_email')

      expect(result.rowCount).toBe(0)
    })
  })

  test('chaque association ne lit que ses adresses ; celle de A est invisible depuis B', async () => {
    await withAppRoleClient(async (client) => {
      const {a, b} = await tenantIds(client)

      const fromA = await inScope(client, a, () =>
        client.query<{organization_id: string; email: string}>(
          'select organization_id, email from member_profile_email'
        )
      )
      const fromB = await inScope(client, b, () =>
        client.query<{organization_id: string; email: string}>(
          'select organization_id, email from member_profile_email'
        )
      )

      expect(fromA.rowCount).toBeGreaterThan(0)
      expect(fromB.rowCount).toBeGreaterThan(0)
      for (const row of fromA.rows) expect(row.organization_id).toBe(a)
      for (const row of fromB.rows) expect(row.organization_id).toBe(b)
      expect(fromA.rows.map((row) => row.email)).toContain(ADDRESS_A)
      expect(fromB.rows.map((row) => row.email)).not.toContain(ADDRESS_A)
    })
  })

  test('écrire une adresse pour une autre association est refusé', async () => {
    await withAppRoleClient(async (client) => {
      const {a, b} = await tenantIds(client)

      await client.query('begin')
      await client.query(`select set_config('app.organization_id', $1, true)`, [
        a,
      ])
      const [fiche] = (
        await client.query<{id: string}>(
          'select id from member_profile limit 1'
        )
      ).rows

      await expect(
        client.query(
          `insert into member_profile_email
             (organization_id, member_profile_id, email, role, status, origin)
           values ($1, $2, 'forge@example.test', 'additional', 'active', 'site')`,
          [b, fiche.id]
        )
      ).rejects.toThrow(/row-level security/i)

      await client.query('rollback')
    })
  })
})

test.describe('s19 — member_invoice et invoice_status_alert isolées entre associations', () => {
  /** Une facture de TechCorp (seed). */
  const INVOICE_A = 'a1900000-0000-4000-8000-0000000000c1'
  /** Une facture de Marketing Pro (seed). */
  const INVOICE_B = 'b1900000-0000-4000-8000-0000000000d1'
  /** Un statut déjà signalé chez TechCorp (seed). */
  const ALERT_A = 'a1900000-0000-4000-8000-0000000000e1'
  /** Un statut déjà signalé chez Marketing Pro (seed). */
  const ALERT_B = 'b1900000-0000-4000-8000-0000000000f1'

  const inScope = async <T>(
    client: Client,
    organizationId: string,
    read: () => Promise<T>
  ): Promise<T> => {
    await client.query('begin')
    try {
      await client.query(`select set_config('app.organization_id', $1, true)`, [
        organizationId,
      ])
      return await read()
    } finally {
      await client.query('rollback')
    }
  }

  test('hors scope de tenant, aucune facture ni alerte ne sort', async () => {
    await withAppRoleClient(async (client) => {
      expect(
        (await client.query('select id from member_invoice')).rowCount
      ).toBe(0)
      expect(
        (await client.query('select id from invoice_status_alert')).rowCount
      ).toBe(0)
    })
  })

  test('chaque association ne lit que ses factures ; un identifiant forgé de l’autre ne rend rien', async () => {
    await withAppRoleClient(async (client) => {
      const {a, b} = await tenantIds(client)

      const fromA = await inScope(client, a, () =>
        client.query<{id: string; organization_id: string}>(
          'select id, organization_id from member_invoice'
        )
      )
      const forgedFromB = await inScope(client, b, () =>
        client.query('select id from member_invoice where id = $1', [INVOICE_A])
      )

      expect(fromA.rows.map((row) => row.id)).toContain(INVOICE_A)
      expect(fromA.rows.map((row) => row.id)).not.toContain(INVOICE_B)
      for (const row of fromA.rows) expect(row.organization_id).toBe(a)
      expect(forgedFromB.rowCount).toBe(0)
    })
  })

  test('écrire une facture pour une autre association est refusé', async () => {
    await withAppRoleClient(async (client) => {
      const {a, b} = await tenantIds(client)

      await client.query('begin')
      await client.query(`select set_config('app.organization_id', $1, true)`, [
        a,
      ])
      const [invoice] = (
        await client.query<{member_profile_id: string; parcel_id: string}>(
          'select member_profile_id, parcel_id from member_invoice where id = $1',
          [INVOICE_A]
        )
      ).rows

      await expect(
        client.query(
          `insert into member_invoice
             (organization_id, member_profile_id, parcel_id, source, year, issued_on, due_on, amount_cents, status)
           values ($1, $2, $3, 'site', 2026, '2026-01-01', '2026-02-01', 100, 'Forgé')`,
          [b, invoice.member_profile_id, invoice.parcel_id]
        )
      ).rejects.toThrow(/row-level security/i)

      await client.query('rollback')
    })
  })

  test('chaque association ne lit que ses alertes ; celle de B est invisible depuis A', async () => {
    await withAppRoleClient(async (client) => {
      const {a, b} = await tenantIds(client)

      const fromA = await inScope(client, a, () =>
        client.query<{id: string; organization_id: string}>(
          'select id, organization_id from invoice_status_alert'
        )
      )
      const fromB = await inScope(client, b, () =>
        client.query<{id: string; organization_id: string}>(
          'select id, organization_id from invoice_status_alert'
        )
      )
      const forgedFromA = await inScope(client, a, () =>
        client.query('select id from invoice_status_alert where id = $1', [
          ALERT_B,
        ])
      )

      expect(fromA.rows.map((row) => row.id)).toContain(ALERT_A)
      expect(fromA.rows.map((row) => row.id)).not.toContain(ALERT_B)
      for (const row of fromA.rows) expect(row.organization_id).toBe(a)
      expect(fromB.rows.map((row) => row.id)).toContain(ALERT_B)
      expect(forgedFromA.rowCount).toBe(0)
    })
  })

  test('écrire une alerte pour une autre association est refusé', async () => {
    await withAppRoleClient(async (client) => {
      const {a, b} = await tenantIds(client)

      await client.query('begin')
      await client.query(`select set_config('app.organization_id', $1, true)`, [
        a,
      ])

      await expect(
        client.query(
          `insert into invoice_status_alert (organization_id, status)
           values ($1, 'Forgé')`,
          [b]
        )
      ).rejects.toThrow(/row-level security/i)

      await client.query('rollback')
    })
  })
})

test.describe('s31 — documents partagés : RLS de shared_document (ADR 069)', () => {
  /** Une ligne par association, écrite sous `bypass` puis retirée. */
  const created: {a?: string; b?: string; categories: string[]} = {
    categories: [],
  }

  const inScope = async <T>(
    client: Client,
    organizationId: string,
    read: () => Promise<T>
  ): Promise<T> => {
    await client.query('begin')
    try {
      await client.query(`select set_config('app.organization_id', $1, true)`, [
        organizationId,
      ])
      return await read()
    } finally {
      await client.query('rollback')
    }
  }

  const inBypass = async <T>(client: Client, write: () => Promise<T>) => {
    await client.query('begin')
    try {
      await client.query(`select set_config('app.bypass_rls', 'on', true)`)
      const result = await write()
      await client.query('commit')
      return result
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  }

  test.beforeAll(async () => {
    await withAppRoleClient(async (client) => {
      const {a, b} = await tenantIds(client)
      await inBypass(client, async () => {
        for (const [slot, organizationId] of [
          ['a', a],
          ['b', b],
        ] as const) {
          const category = await client.query<{id: string}>(
            `insert into association_category (organization_id, domain, name)
             values ($1, 'document', $2) returning id`,
            [organizationId, `RLS s31 ${Date.now().toString(36)} ${slot}`]
          )
          created.categories.push(category.rows[0].id)
          const document = await client.query<{id: string}>(
            `insert into shared_document (organization_id, title, category_id, file_key, file_bytes)
             values ($1, 'RLS s31', $2, $3, 1) returning id`,
            [
              organizationId,
              category.rows[0].id,
              `${organizationId}/shared-documents/rls/file.pdf`,
            ]
          )
          created[slot] = document.rows[0].id
        }
      })
    })
  })

  test.afterAll(async () => {
    await withAppRoleClient((client) =>
      inBypass(client, async () => {
        await client.query(
          `delete from shared_document where id = any($1::uuid[])`,
          [[created.a, created.b].filter(Boolean)]
        )
        await client.query(
          `delete from association_category where id = any($1::uuid[])`,
          [created.categories]
        )
      })
    )
  })

  test('hors scope de tenant, aucun document ne sort', async () => {
    await withAppRoleClient(async (client) => {
      expect(
        (await client.query('select id from shared_document')).rowCount
      ).toBe(0)
    })
  })

  test('dans le scope de A, seuls les documents de A sortent ; celui de A est invisible depuis B', async () => {
    await withAppRoleClient(async (client) => {
      const {a, b} = await tenantIds(client)

      const fromA = await inScope(client, a, () =>
        client.query<{id: string; organization_id: string}>(
          'select id, organization_id from shared_document'
        )
      )
      const forgedFromB = await inScope(client, b, () =>
        client.query('select id from shared_document where id = $1', [
          created.a,
        ])
      )

      expect(fromA.rows.map((row) => row.id)).toContain(created.a)
      expect(fromA.rows.map((row) => row.id)).not.toContain(created.b)
      for (const row of fromA.rows) expect(row.organization_id).toBe(a)
      expect(forgedFromB.rowCount).toBe(0)
    })
  })

  test('écrire un document pour une autre association est refusé', async () => {
    await withAppRoleClient(async (client) => {
      const {a, b} = await tenantIds(client)

      await client.query('begin')
      await client.query(`select set_config('app.organization_id', $1, true)`, [
        a,
      ])

      await expect(
        client.query(
          `insert into shared_document (organization_id, title, category_id, file_key, file_bytes)
           values ($1, 'Forgé', $2, 'forge.pdf', 1)`,
          [b, created.categories[1]]
        )
      ).rejects.toThrow(/row-level security/i)

      await client.query('rollback')
    })
  })
})

test.describe('s29 — rangs de relance : RLS de unpaid_reminder (ADR 070)', () => {
  /** Une campagne et son rang par association, écrits sous `bypass` puis retirés. */
  const created: {a?: string; b?: string; campaigns: string[]} = {
    campaigns: [],
  }
  const DUE_ON = '2020-03-31'

  const inScope = async <T>(
    client: Client,
    organizationId: string,
    read: () => Promise<T>
  ): Promise<T> => {
    await client.query('begin')
    try {
      await client.query(`select set_config('app.organization_id', $1, true)`, [
        organizationId,
      ])
      return await read()
    } finally {
      await client.query('rollback')
    }
  }

  const inBypass = async <T>(client: Client, write: () => Promise<T>) => {
    await client.query('begin')
    try {
      await client.query(`select set_config('app.bypass_rls', 'on', true)`)
      const result = await write()
      await client.query('commit')
      return result
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  }

  test.beforeAll(async () => {
    await withAppRoleClient(async (client) => {
      const {a, b} = await tenantIds(client)
      await inBypass(client, async () => {
        for (const [slot, organizationId] of [
          ['a', a],
          ['b', b],
        ] as const) {
          const campaign = await client.query<{id: string}>(
            `insert into campaign
               (organization_id, submission_id, subject, body_markdown, template_id,
                target_kind, recipient_count, without_email_count, unsubscribed_count,
                status, send_date)
             values ($1, gen_random_uuid(), 'RLS s29', 'Bonjour', 'unpaid_reminder',
                     'unpaid_members', 0, 0, 0, 'sent', current_date)
             returning id`,
            [organizationId]
          )
          created.campaigns.push(campaign.rows[0].id)
          const reminder = await client.query<{id: string}>(
            `insert into unpaid_reminder (organization_id, due_on, rank, campaign_id)
             values ($1, $2, 1, $3) returning id`,
            [organizationId, DUE_ON, campaign.rows[0].id]
          )
          created[slot] = reminder.rows[0].id
        }
      })
    })
  })

  test.afterAll(async () => {
    await withAppRoleClient((client) =>
      inBypass(client, () =>
        client.query(`delete from campaign where id = any($1::uuid[])`, [
          created.campaigns,
        ])
      )
    )
  })

  test('hors scope de tenant, aucun rang ne sort', async () => {
    await withAppRoleClient(async (client) => {
      expect(
        (await client.query('select id from unpaid_reminder')).rowCount
      ).toBe(0)
    })
  })

  test('dans le scope de A, seuls les rangs de A sortent ; celui de A est invisible depuis B', async () => {
    await withAppRoleClient(async (client) => {
      const {a, b} = await tenantIds(client)

      const fromA = await inScope(client, a, () =>
        client.query<{id: string; organization_id: string}>(
          'select id, organization_id from unpaid_reminder'
        )
      )
      const forgedFromB = await inScope(client, b, () =>
        client.query('select id from unpaid_reminder where id = $1', [
          created.a,
        ])
      )

      expect(fromA.rows.map((row) => row.id)).toContain(created.a)
      expect(fromA.rows.map((row) => row.id)).not.toContain(created.b)
      for (const row of fromA.rows) expect(row.organization_id).toBe(a)
      expect(forgedFromB.rowCount).toBe(0)
    })
  })

  test('écrire un rang pour une autre association est refusé', async () => {
    await withAppRoleClient(async (client) => {
      const {a, b} = await tenantIds(client)

      await client.query('begin')
      await client.query(`select set_config('app.organization_id', $1, true)`, [
        a,
      ])

      await expect(
        client.query(
          `insert into unpaid_reminder (organization_id, due_on, rank, campaign_id)
           values ($1, $2, 2, $3)`,
          [b, DUE_ON, created.campaigns[1]]
        )
      ).rejects.toThrow(/row-level security/i)

      await client.query('rollback')
    })
  })
})

test.describe('s32 — documents nominatifs : RLS de member_document (ADR 073)', () => {
  /** Une ligne par association, sur une fiche du seed, écrite sous `bypass` puis retirée. */
  const created: {
    a?: string
    b?: string
    categories: string[]
    profiles: string[]
  } = {categories: [], profiles: []}

  const inScope = async <T>(
    client: Client,
    organizationId: string,
    read: () => Promise<T>
  ): Promise<T> => {
    await client.query('begin')
    try {
      await client.query(`select set_config('app.organization_id', $1, true)`, [
        organizationId,
      ])
      return await read()
    } finally {
      await client.query('rollback')
    }
  }

  const inBypass = async <T>(client: Client, write: () => Promise<T>) => {
    await client.query('begin')
    try {
      await client.query(`select set_config('app.bypass_rls', 'on', true)`)
      const result = await write()
      await client.query('commit')
      return result
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  }

  test.beforeAll(async () => {
    await withAppRoleClient(async (client) => {
      const {a, b} = await tenantIds(client)
      await inBypass(client, async () => {
        for (const [slot, organizationId] of [
          ['a', a],
          ['b', b],
        ] as const) {
          const profile = await client.query<{id: string}>(
            `select id from member_profile where organization_id = $1 order by id limit 1`,
            [organizationId]
          )
          expect(
            profile.rowCount,
            'le seed porte une fiche par association'
          ).toBe(1)
          created.profiles.push(profile.rows[0].id)
          const category = await client.query<{id: string}>(
            `insert into association_category (organization_id, domain, name)
             values ($1, 'member_document', $2) returning id`,
            [organizationId, `RLS s32 ${Date.now().toString(36)} ${slot}`]
          )
          created.categories.push(category.rows[0].id)
          const document = await client.query<{id: string}>(
            `insert into member_document
               (organization_id, member_profile_id, title, category_id,
                document_date, file_key, file_bytes)
             values ($1, $2, 'RLS s32', $3, '2026-01-01', $4, 1) returning id`,
            [
              organizationId,
              profile.rows[0].id,
              category.rows[0].id,
              `${organizationId}/member-documents/${profile.rows[0].id}/rls.pdf`,
            ]
          )
          created[slot] = document.rows[0].id
        }
      })
    })
  })

  test.afterAll(async () => {
    await withAppRoleClient((client) =>
      inBypass(client, async () => {
        await client.query(
          `delete from member_document where id = any($1::uuid[])`,
          [[created.a, created.b].filter(Boolean)]
        )
        await client.query(
          `delete from association_category where id = any($1::uuid[])`,
          [created.categories]
        )
      })
    )
  })

  test('hors scope de tenant, aucun document nominatif ne sort', async () => {
    await withAppRoleClient(async (client) => {
      expect(
        (await client.query('select id from member_document')).rowCount
      ).toBe(0)
    })
  })

  test('dans le scope de A, seuls les documents de A sortent ; celui de A est invisible depuis B', async () => {
    await withAppRoleClient(async (client) => {
      const {a, b} = await tenantIds(client)

      const fromA = await inScope(client, a, () =>
        client.query<{id: string; organization_id: string}>(
          'select id, organization_id from member_document'
        )
      )
      const forgedFromB = await inScope(client, b, () =>
        client.query('select id from member_document where id = $1', [
          created.a,
        ])
      )

      expect(fromA.rows.map((row) => row.id)).toContain(created.a)
      expect(fromA.rows.map((row) => row.id)).not.toContain(created.b)
      for (const row of fromA.rows) expect(row.organization_id).toBe(a)
      expect(forgedFromB.rowCount).toBe(0)
    })
  })

  test('écrire un document nominatif pour une autre association est refusé', async () => {
    await withAppRoleClient(async (client) => {
      const {a, b} = await tenantIds(client)

      await client.query('begin')
      await client.query(`select set_config('app.organization_id', $1, true)`, [
        a,
      ])

      await expect(
        client.query(
          `insert into member_document
             (organization_id, member_profile_id, title, category_id,
              document_date, file_key, file_bytes)
           values ($1, $2, 'Forgé', $3, '2026-01-01', 'forge.pdf', 1)`,
          [b, created.profiles[1], created.categories[1]]
        )
      ).rejects.toThrow(/row-level security/i)

      await client.query('rollback')
    })
  })
})

test.describe('s36 — modèles de documents : RLS de document_template (ADR 074)', () => {
  /** Un modèle par association, écrit sous `bypass` puis retiré. */
  const created: {a?: string; b?: string} = {}

  const inScope = async <T>(
    client: Client,
    organizationId: string,
    read: () => Promise<T>
  ): Promise<T> => {
    await client.query('begin')
    try {
      await client.query(`select set_config('app.organization_id', $1, true)`, [
        organizationId,
      ])
      return await read()
    } finally {
      await client.query('rollback')
    }
  }

  const inBypass = async <T>(client: Client, write: () => Promise<T>) => {
    await client.query('begin')
    try {
      await client.query(`select set_config('app.bypass_rls', 'on', true)`)
      const result = await write()
      await client.query('commit')
      return result
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  }

  test.beforeAll(async () => {
    await withAppRoleClient(async (client) => {
      const {a, b} = await tenantIds(client)
      await inBypass(client, async () => {
        for (const [slot, organizationId] of [
          ['a', a],
          ['b', b],
        ] as const) {
          const template = await client.query<{id: string}>(
            `insert into document_template
               (organization_id, name, subject, body_markdown)
             values ($1, $2, 'Objet', 'Bonjour {nom}') returning id`,
            [organizationId, `RLS s36 ${Date.now().toString(36)} ${slot}`]
          )
          created[slot] = template.rows[0].id
        }
      })
    })
  })

  test.afterAll(async () => {
    await withAppRoleClient((client) =>
      inBypass(client, () =>
        client.query(
          `delete from document_template where id = any($1::uuid[])`,
          [[created.a, created.b].filter(Boolean)]
        )
      )
    )
  })

  test('hors scope de tenant, aucun modèle ne sort', async () => {
    await withAppRoleClient(async (client) => {
      expect(
        (await client.query('select id from document_template')).rowCount
      ).toBe(0)
    })
  })

  test('dans le scope de A, seuls les modèles de A sortent ; celui de A est invisible depuis B', async () => {
    await withAppRoleClient(async (client) => {
      const {a, b} = await tenantIds(client)

      const fromA = await inScope(client, a, () =>
        client.query<{id: string; organization_id: string}>(
          'select id, organization_id from document_template'
        )
      )
      const forgedFromB = await inScope(client, b, () =>
        client.query('select id from document_template where id = $1', [
          created.a,
        ])
      )

      expect(fromA.rows.map((row) => row.id)).toContain(created.a)
      expect(fromA.rows.map((row) => row.id)).not.toContain(created.b)
      for (const row of fromA.rows) expect(row.organization_id).toBe(a)
      expect(forgedFromB.rowCount).toBe(0)
    })
  })

  test('écrire un modèle pour une autre association est refusé', async () => {
    await withAppRoleClient(async (client) => {
      const {a, b} = await tenantIds(client)

      await client.query('begin')
      await client.query(`select set_config('app.organization_id', $1, true)`, [
        a,
      ])

      await expect(
        client.query(
          `insert into document_template
             (organization_id, name, subject, body_markdown)
           values ($1, 'Forgé', 'Objet', 'Texte')`,
          [b]
        )
      ).rejects.toThrow(/row-level security/i)

      await client.query('rollback')
    })
  })
})
