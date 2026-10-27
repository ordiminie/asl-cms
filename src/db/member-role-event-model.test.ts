import {getTableConfig} from 'drizzle-orm/pg-core'
import {describe, expect, it} from 'vitest'

import {organization, user} from './models/auth-model'
import {memberProfile} from './models/member-profile-model'
import {
  memberRoleEvent,
  memberRoleEventReasonEnum,
} from './models/member-role-event-model'

/**
 * Trace des changements de role (s14, ADR 039). Vit hors de `src/db/models/` :
 * un fichier de test dans ce dossier casse drizzle-kit (voir
 * `rls-inventory.test.ts`).
 */
describe('member_role_event (ADR 039)', () => {
  const config = getTableConfig(memberRoleEvent)
  const column = (name: string) => config.columns.find((c) => c.name === name)
  const foreignKeyOn = (name: string) =>
    config.foreignKeys.find((fk) =>
      fk.reference().columns.some((c) => c.name === name)
    )

  it('porte les colonnes de l’ADR, et elles seules', () => {
    expect(config.name).toBe('member_role_event')
    expect(config.columns.map((c) => c.name).sort()).toEqual(
      [
        'id',
        'organization_id',
        'member_profile_id',
        'target_user_id',
        'target_name',
        'author_user_id',
        'author_name',
        'from_role',
        'to_role',
        'reason',
        'created_at',
      ].sort()
    )
  })

  it('exige organization_id, la raison et la date ; les rôles sont nullables', () => {
    expect(column('organization_id')?.notNull).toBe(true)
    expect(column('reason')?.notNull).toBe(true)
    expect(column('created_at')?.notNull).toBe(true)
    expect(column('created_at')?.hasDefault).toBe(true)
    expect(column('from_role')?.notNull).toBe(false)
    expect(column('to_role')?.notNull).toBe(false)
  })

  it('reprend l’énuméré des rôles d’association pour from_role et to_role', () => {
    expect(column('from_role')?.getSQLType()).toBe('organization_role')
    expect(column('to_role')?.getSQLType()).toBe('organization_role')
  })

  it('énumère les quatre raisons de l’ADR', () => {
    expect(memberRoleEventReasonEnum.enumName).toBe('member_role_event_reason')
    expect([...memberRoleEventReasonEnum.enumValues].sort()).toEqual(
      ['assignment', 'email_change', 'presidency_transfer', 'removal'].sort()
    )
    expect(column('reason')?.getSQLType()).toBe('member_role_event_reason')
  })

  it('supprime la trace avec son association (cascade)', () => {
    const foreignKey = foreignKeyOn('organization_id')
    const reference = foreignKey?.reference()

    expect(reference && getTableConfig(reference.foreignTable).name).toBe(
      getTableConfig(organization).name
    )
    expect(foreignKey?.onDelete).toBe('cascade')
  })

  it.each([
    ['member_profile_id', memberProfile],
    ['target_user_id', user],
    ['author_user_id', user],
  ])(
    'garde la trace quand %s disparaît (ON DELETE SET NULL)',
    (name, table) => {
      const foreignKey = foreignKeyOn(name)
      const reference = foreignKey?.reference()

      expect(column(name)?.notNull).toBe(false)
      expect(reference && getTableConfig(reference.foreignTable).name).toBe(
        getTableConfig(table).name
      )
      expect(foreignKey?.onDelete).toBe('set null')
    }
  )

  it('indexe organization_id', () => {
    const index = config.indexes.find((i) =>
      i.config.columns.some((c) => 'name' in c && c.name === 'organization_id')
    )

    expect(index).toBeDefined()
    expect(
      index?.config.columns.map((c) => ('name' in c ? c.name : null))[0]
    ).toBe('organization_id')
  })
})
