import {getTableConfig} from 'drizzle-orm/pg-core'
import {describe, expect, it} from 'vitest'

import {organization} from './models/auth-model'
import {billingSyncState} from './models/billing-sync-state-model'

/**
 * Etat de la synchronisation Pennylane d'une association (s20, ADR 062 §7).
 * Vit hors de `src/db/models/` : un fichier de test dans ce dossier casse
 * drizzle-kit (voir `rls-inventory.test.ts`).
 */
describe('billing_sync_state (s20, ADR 062 §7)', () => {
  const config = getTableConfig(billingSyncState)
  const column = (name: string) => config.columns.find((c) => c.name === name)

  it('porte les colonnes de l’ADR, et elles seules — ni URL, ni moyen de paiement', () => {
    expect(config.name).toBe('billing_sync_state')
    expect(config.columns.map((c) => c.name).sort()).toEqual(
      [
        'organization_id',
        'last_attempt_at',
        'last_success_at',
        'last_error',
        'counts',
        'unmatched_customers',
        'terrain_mismatches',
        'created_at',
        'updated_at',
      ].sort()
    )
  })

  it('une ligne par association : l’association est la clé primaire', () => {
    expect(column('organization_id')?.primary).toBe(true)
    const fk = config.foreignKeys[0]?.reference()
    expect(fk && getTableConfig(fk.foreignTable).name).toBe(
      getTableConfig(organization).name
    )
    expect(config.foreignKeys[0]?.onDelete).toBe('cascade')
  })

  it('les instants et le motif d’échec sont facultatifs ; les listes, jamais nulles', () => {
    expect(column('last_attempt_at')?.notNull).toBe(false)
    expect(column('last_success_at')?.notNull).toBe(false)
    expect(column('last_error')?.notNull).toBe(false)
    expect(column('last_error')?.columnType).toBe('PgText')
    for (const name of [
      'counts',
      'unmatched_customers',
      'terrain_mismatches',
    ]) {
      expect(column(name)?.columnType, name).toBe('PgJsonb')
      expect(column(name)?.notNull, name).toBe(true)
    }
  })
})
