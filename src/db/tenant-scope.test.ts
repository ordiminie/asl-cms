import type {SQL} from 'drizzle-orm'
import {PgDialect} from 'drizzle-orm/pg-core'
import {beforeEach, describe, expect, it, vi} from 'vitest'

// `vi.hoisted` : `vi.mock` est remonte au-dessus du module, un `const` declare
// plus bas ne serait pas encore initialise quand la fabrique s'execute. Les
// imports du fichier n'y sont pas non plus disponibles, d'ou la compilation SQL
// laissee au corps du test.
const {executedSql, poolDb, transactions} = vi.hoisted(() => {
  /** Les objets SQL reellement envoyes dans la transaction du scope. */
  const executedSql: unknown[] = []
  const transactions: {name: string}[] = []

  const makeTransaction = () => {
    const transaction = {
      name: `transaction-${transactions.length}`,
      execute: vi.fn(async (query: unknown) => {
        executedSql.push(query)
      }),
    }
    transactions.push(transaction)
    return transaction
  }

  const poolDb = {
    name: 'pool',
    transaction: vi.fn(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        await callback(makeTransaction())
    ),
  }

  return {executedSql, poolDb, transactions}
})

vi.mock('./models/db', () => ({default: poolDb}))

import {getDb, withRlsBypass, withTenant} from './tenant-scope'

const dialect = new PgDialect()

/** Traduit en `{sql, params}` ce que la transaction a recu. */
const executed = () =>
  executedSql.map((query) => dialect.sqlToQuery(query as SQL))

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  executedSql.length = 0
  transactions.length = 0
  poolDb.transaction.mockClear()
})

describe('getDb', () => {
  it('retourne le client du pool hors de tout scope de tenant', () => {
    expect(getDb()).toBe(poolDb)
  })

  it('retourne la transaction du scope courant dans un withTenant', async () => {
    const seen = await withTenant(ORGANIZATION_ID, async () => getDb())

    expect(seen).toBe(transactions[0])
    expect(seen).not.toBe(poolDb)
  })

  it('rend le client du pool une fois le scope refermé', async () => {
    await withTenant(ORGANIZATION_ID, async () => getDb())

    expect(getDb()).toBe(poolDb)
  })
})

describe('withTenant', () => {
  it("pose l'organisation par requête paramétrée, jamais par interpolation", async () => {
    await withTenant(ORGANIZATION_ID, async () => undefined)

    const statements = executed()

    expect(statements).toHaveLength(1)
    // `SET LOCAL` ne se paramètre pas — mesuré. set_config(..., true) est la
    // forme paramétrable au comportement identique ; interpoler l'id serait
    // une injection.
    expect(statements[0].sql).toContain('set_config')
    expect(statements[0].sql).not.toContain(ORGANIZATION_ID)
    expect(statements[0].params).toEqual([
      'app.organization_id',
      ORGANIZATION_ID,
    ])
  })

  it('pose le réglage dans une transaction, jamais sur le pool', async () => {
    await withTenant(ORGANIZATION_ID, async () => undefined)

    expect(poolDb.transaction).toHaveBeenCalledTimes(1)
  })

  it('refuse un identifiant qui ne soit pas un uuid', async () => {
    await expect(
      withTenant('not-a-uuid', async () => undefined)
    ).rejects.toThrow('withTenant requires a valid organization id')

    expect(poolDb.transaction).not.toHaveBeenCalled()
  })

  it('referme le scope même quand le callback échoue', async () => {
    await expect(
      withTenant(ORGANIZATION_ID, async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')

    expect(getDb()).toBe(poolDb)
  })

  it('imbriqué : réutilise la transaction du scope externe, sans seconde connexion', async () => {
    const seen = await withTenant(ORGANIZATION_ID, async () => {
      const before = getDb()
      const nested = await withTenant(OTHER_ORGANIZATION_ID, async () =>
        getDb()
      )
      return {before, nested, after: getDb()}
    })

    // Une seule transaction, donc un seul reglage a restaurer. Ouvrir une
    // seconde transaction depuis le pool donnerait deux sessions Postgres
    // distinctes : les ecritures du scope interne ne verraient pas celles du
    // scope externe, et deux connexions seraient retenues a la fois.
    expect(poolDb.transaction).toHaveBeenCalledTimes(1)
    expect(seen.before).toBe(transactions[0])
    expect(seen.nested).toBe(transactions[0])
    expect(seen.after).toBe(transactions[0])
  })

  it('imbriqué : repose la valeur du scope externe en base à la sortie', async () => {
    await withTenant(ORGANIZATION_ID, async () => {
      await withTenant(OTHER_ORGANIZATION_ID, async () => undefined)
    })

    // `set_config(..., true)` a une portee de TRANSACTION, pas de savepoint :
    // sans restauration explicite, le reglage du tenant interne survit a la
    // sortie du scope imbrique et le tenant externe lit les lignes du mauvais
    // tenant. Verifie en base : apres `release savepoint`,
    // `current_setting('app.organization_id')` rend encore la valeur interne.
    expect(executed().map((statement) => statement.params)).toEqual([
      ['app.organization_id', ORGANIZATION_ID],
      ['app.organization_id', OTHER_ORGANIZATION_ID],
      ['app.organization_id', ORGANIZATION_ID],
    ])
  })

  it('imbriqué : repose la chaîne vide quand le scope externe posait un autre réglage', async () => {
    await withRlsBypass(async () => {
      await withTenant(ORGANIZATION_ID, async () => undefined)
    })

    // La chaine vide est traitee comme « non pose » par la policy (NULLIF).
    expect(executed().map((statement) => statement.params)).toEqual([
      ['app.bypass_rls', 'on'],
      ['app.organization_id', ORGANIZATION_ID],
      ['app.organization_id', ''],
    ])
  })

  it('imbriqué : repose la valeur du scope externe même quand le callback échoue', async () => {
    await expect(
      withTenant(ORGANIZATION_ID, async () => {
        await withTenant(OTHER_ORGANIZATION_ID, async () => {
          throw new Error('boom')
        })
      })
    ).rejects.toThrow('boom')

    expect(executed().map((statement) => statement.params)).toEqual([
      ['app.organization_id', ORGANIZATION_ID],
      ['app.organization_id', OTHER_ORGANIZATION_ID],
      ['app.organization_id', ORGANIZATION_ID],
    ])
  })

  it('rend la valeur du callback', async () => {
    await expect(withTenant(ORGANIZATION_ID, async () => 42)).resolves.toBe(42)
  })
})

describe('withRlsBypass', () => {
  it("pose la porte de bypass, et rien d'autre", async () => {
    await withRlsBypass(async () => undefined)

    const statements = executed()

    expect(statements).toHaveLength(1)
    expect(statements[0].params).toEqual(['app.bypass_rls', 'on'])
  })

  it('publie sa transaction dans le scope courant', async () => {
    const seen = await withRlsBypass(async () => getDb())

    expect(seen).toBe(transactions[0])
  })
})
