import {getTableConfig} from 'drizzle-orm/pg-core'
import {describe, expect, it} from 'vitest'

import {user} from './models/auth-model'
import {memberProfileAccount} from './models/member-profile-account-model'
import {memberProfile} from './models/member-profile-model'

/**
 * Lien fiche ↔ compte (s53, ADR 054, remplace l'ADR 037). Vit hors de
 * `src/db/models/` : un fichier de test dans ce dossier casse drizzle-kit
 * (voir `rls-inventory.test.ts`).
 */
describe('member_profile — plus de colonne de compte, adresse non unique (ADR 054)', () => {
  const config = getTableConfig(memberProfile)

  it('ne porte plus de colonne user_id', () => {
    expect(config.columns.find((c) => c.name === 'user_id')).toBeUndefined()
    expect(
      config.indexes.find(
        (i) => i.config.name === 'member_profile_organization_user_idx'
      )
    ).toBeUndefined()
  })

  it('indexe l’adresse par association sans la rendre unique', () => {
    const index = config.indexes.find(
      (i) => i.config.name === 'member_profile_organization_email_idx'
    )

    expect(index).toBeDefined()
    expect(index?.config.unique).toBe(false)
    expect(index?.config.where).toBeDefined()
  })
})

describe('member_profile_account (ADR 054)', () => {
  const config = getTableConfig(memberProfileAccount)

  const foreignKeyOn = (column: string) =>
    config.foreignKeys.find((fk) =>
      fk.reference().columns.some((c) => c.name === column)
    )

  it('porte sa propre colonne de tenant, la fiche et le compte, tous obligatoires', () => {
    for (const name of ['organization_id', 'member_profile_id', 'user_id']) {
      expect(config.columns.find((c) => c.name === name)?.notNull, name).toBe(
        true
      )
    }
  })

  it('relie une fiche à au plus un compte : unique sur member_profile_id', () => {
    const index = config.indexes.find(
      (i) => i.config.name === 'member_profile_account_profile_idx'
    )

    expect(index?.config.unique).toBe(true)
    expect(
      index?.config.columns.map((c) => ('name' in c ? c.name : null))
    ).toEqual(['member_profile_id'])
  })

  it('laisse un compte porter plusieurs fiches : index non unique (organization_id, user_id)', () => {
    const index = config.indexes.find(
      (i) => i.config.name === 'member_profile_account_organization_user_idx'
    )

    expect(index?.config.unique).toBe(false)
    expect(
      index?.config.columns.map((c) => ('name' in c ? c.name : null))
    ).toEqual(['organization_id', 'user_id'])
  })

  it('suit la fiche et le compte en ON DELETE CASCADE', () => {
    const toProfile = foreignKeyOn('member_profile_id')
    const toUser = foreignKeyOn('user_id')

    expect(
      toProfile && getTableConfig(toProfile.reference().foreignTable).name
    ).toBe('member_profile')
    expect(toProfile?.onDelete).toBe('cascade')
    expect(toUser && getTableConfig(toUser.reference().foreignTable).name).toBe(
      getTableConfig(user).name
    )
    expect(toUser?.onDelete).toBe('cascade')
  })
})
