import {getTableConfig} from 'drizzle-orm/pg-core'
import {describe, expect, it} from 'vitest'

import {user} from './models/auth-model'
import {memberProfile} from './models/member-profile-model'

/**
 * Lien fiche ↔ compte (s12d, ADR 037). Vit hors de `src/db/models/` : un
 * fichier de test dans ce dossier casse drizzle-kit (voir
 * `rls-inventory.test.ts`).
 */
describe('member_profile.user_id (ADR 037)', () => {
  const config = getTableConfig(memberProfile)

  it('est une colonne nullable', () => {
    const column = config.columns.find((c) => c.name === 'user_id')

    expect(column).toBeDefined()
    expect(column?.notNull).toBe(false)
  })

  it('reference user(id) en ON DELETE SET NULL', () => {
    const foreignKey = config.foreignKeys.find((fk) =>
      fk.reference().columns.some((c) => c.name === 'user_id')
    )

    const reference = foreignKey?.reference()
    expect(reference).toBeDefined()
    expect(reference && getTableConfig(reference.foreignTable).name).toBe(
      getTableConfig(user).name
    )
    expect(reference?.foreignColumns.map((c) => c.name)).toEqual(['id'])
    expect(foreignKey?.onDelete).toBe('set null')
  })

  it('est unique par association, seulement quand elle est renseignee', () => {
    const index = config.indexes.find(
      (i) => i.config.name === 'member_profile_organization_user_idx'
    )

    expect(index?.config.unique).toBe(true)
    expect(
      index?.config.columns.map((c) => ('name' in c ? c.name : null))
    ).toEqual(['organization_id', 'user_id'])
    expect(index?.config.where).toBeDefined()
  })
})
