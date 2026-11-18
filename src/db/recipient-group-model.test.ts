import {getTableConfig} from 'drizzle-orm/pg-core'
import {describe, expect, it} from 'vitest'

import {organization} from './models/auth-model'
import {campaign} from './models/campaign-model'
import {memberProfile} from './models/member-profile-model'
import {
  recipientGroup,
  recipientGroupMember,
} from './models/recipient-group-model'

/**
 * Groupes de destinataires (s27, ADR 060 §4 et §5). Vit hors de
 * `src/db/models/` : un fichier de test dans ce dossier casse drizzle-kit
 * (voir `rls-inventory.test.ts`).
 */
type AnyTable = Parameters<typeof getTableConfig>[0]

const describeTable = (table: AnyTable) => {
  const config = getTableConfig(table)
  const column = (name: string) => config.columns.find((c) => c.name === name)
  const foreignKeyOn = (name: string) =>
    config.foreignKeys.find((fk) =>
      fk.reference().columns.some((c) => c.name === name)
    )
  const targetOf = (name: string) => {
    const reference = foreignKeyOn(name)?.reference()
    return reference && getTableConfig(reference.foreignTable).name
  }
  return {config, column, foreignKeyOn, targetOf}
}

describe('recipient_group (s27, ADR 060 §4)', () => {
  const t = describeTable(recipientGroup)

  it('porte les colonnes de l’ADR, et elles seules', () => {
    expect(t.config.name).toBe('recipient_group')
    expect(t.config.columns.map((c) => c.name).sort()).toEqual(
      ['id', 'organization_id', 'name', 'created_at', 'updated_at'].sort()
    )
    for (const name of [
      'organization_id',
      'name',
      'created_at',
      'updated_at',
    ]) {
      expect(t.column(name)?.notNull, name).toBe(true)
    }
  })

  it('suit son association (cascade)', () => {
    expect(t.targetOf('organization_id')).toBe(
      getTableConfig(organization).name
    )
    expect(t.foreignKeyOn('organization_id')?.onDelete).toBe('cascade')
  })

  it('rend le nom unique par association, sans casse', () => {
    const byName = t.config.indexes.find(
      (i) => i.config.name === 'recipient_group_organization_name_idx'
    )
    expect(byName?.config.unique).toBe(true)
    expect(byName?.config.columns).toHaveLength(2)
  })
})

describe('recipient_group_member (s27, ADR 060 §4)', () => {
  const t = describeTable(recipientGroupMember)

  it('porte les colonnes de l’ADR, et elles seules', () => {
    expect(t.config.name).toBe('recipient_group_member')
    expect(t.config.columns.map((c) => c.name).sort()).toEqual(
      ['organization_id', 'group_id', 'member_profile_id', 'created_at'].sort()
    )
    for (const name of ['organization_id', 'group_id', 'member_profile_id']) {
      expect(t.column(name)?.notNull, name).toBe(true)
    }
  })

  it('disparaît avec son groupe comme avec sa fiche (cascade)', () => {
    expect(t.foreignKeyOn('organization_id')?.onDelete).toBe('cascade')
    expect(t.targetOf('group_id')).toBe('recipient_group')
    expect(t.foreignKeyOn('group_id')?.onDelete).toBe('cascade')
    expect(t.targetOf('member_profile_id')).toBe(
      getTableConfig(memberProfile).name
    )
    expect(t.foreignKeyOn('member_profile_id')?.onDelete).toBe('cascade')
  })

  it('une fiche n’est qu’une fois dans un groupe (clé primaire composée)', () => {
    expect(
      t.config.primaryKeys.map((pk) => pk.columns.map((c) => c.name))
    ).toEqual([['group_id', 'member_profile_id']])
  })
})

describe('campaign — cible de groupe (s27, ADR 060 §5)', () => {
  const t = describeTable(campaign)

  it('garde le groupe visé en SET NULL et son nom copié', () => {
    expect(t.column('target_group_id')?.notNull).toBe(false)
    expect(t.column('target_group_id')?.getSQLType()).toBe('uuid')
    expect(t.targetOf('target_group_id')).toBe('recipient_group')
    expect(t.foreignKeyOn('target_group_id')?.onDelete).toBe('set null')
    expect(t.column('target_group_name')?.notNull).toBe(false)
    expect(t.column('target_group_name')?.getSQLType()).toBe('text')
  })
})
