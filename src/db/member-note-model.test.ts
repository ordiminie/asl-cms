import {getTableConfig} from 'drizzle-orm/pg-core'
import {describe, expect, it} from 'vitest'

import {organization, user} from './models/auth-model'
import {
  memberNote,
  memberNoteChannelEnum,
  memberNoteKindEnum,
} from './models/member-note-model'
import {memberProfile} from './models/member-profile-model'

/**
 * Notes internes d'un membre (s24, ADR 050). Vit hors de `src/db/models/` : un
 * fichier de test dans ce dossier casse drizzle-kit (voir
 * `rls-inventory.test.ts`).
 */
describe('member_note (ADR 050)', () => {
  const config = getTableConfig(memberNote)
  const column = (name: string) => config.columns.find((c) => c.name === name)
  const foreignKeyOn = (name: string) =>
    config.foreignKeys.find((fk) =>
      fk.reference().columns.some((c) => c.name === name)
    )

  it('porte les colonnes de l’ADR, et elles seules', () => {
    expect(config.name).toBe('member_note')
    expect(config.columns.map((c) => c.name).sort()).toEqual(
      [
        'id',
        'organization_id',
        'member_profile_id',
        'kind',
        'channel',
        'entry_date',
        'body',
        'author_user_id',
        'author_name',
        'on_behalf_of_user_id',
        'on_behalf_of_name',
        'created_at',
        'updated_at',
      ].sort()
    )
  })

  it('exige le type, le jour, le texte et la fiche ; canal et modification sont nullables', () => {
    expect(column('organization_id')?.notNull).toBe(true)
    expect(column('member_profile_id')?.notNull).toBe(true)
    expect(column('kind')?.notNull).toBe(true)
    expect(column('entry_date')?.notNull).toBe(true)
    expect(column('body')?.notNull).toBe(true)
    expect(column('created_at')?.notNull).toBe(true)
    expect(column('created_at')?.hasDefault).toBe(true)
    expect(column('channel')?.notNull).toBe(false)
    expect(column('updated_at')?.notNull).toBe(false)
    expect(column('updated_at')?.hasDefault).toBe(false)
  })

  it('énumère les deux types et les quatre canaux de l’ADR', () => {
    expect(memberNoteKindEnum.enumName).toBe('member_note_kind')
    expect([...memberNoteKindEnum.enumValues]).toEqual(['note', 'exchange'])
    expect(memberNoteChannelEnum.enumName).toBe('member_note_channel')
    expect([...memberNoteChannelEnum.enumValues]).toEqual([
      'phone',
      'mail',
      'in_person',
      'email',
    ])
    expect(column('kind')?.getSQLType()).toBe('member_note_kind')
    expect(column('channel')?.getSQLType()).toBe('member_note_channel')
    expect(column('entry_date')?.getSQLType()).toBe('date')
  })

  it('supprime les notes avec leur association (cascade)', () => {
    const reference = foreignKeyOn('organization_id')?.reference()

    expect(reference && getTableConfig(reference.foreignTable).name).toBe(
      getTableConfig(organization).name
    )
    expect(foreignKeyOn('organization_id')?.onDelete).toBe('cascade')
  })

  it('refuse la suppression d’une fiche portant des notes (RESTRICT)', () => {
    const reference = foreignKeyOn('member_profile_id')?.reference()

    expect(reference && getTableConfig(reference.foreignTable).name).toBe(
      getTableConfig(memberProfile).name
    )
    expect(foreignKeyOn('member_profile_id')?.onDelete).toBe('restrict')
  })

  it.each(['author_user_id', 'on_behalf_of_user_id'])(
    'garde la note quand le compte de %s disparaît (SET NULL)',
    (name) => {
      const reference = foreignKeyOn(name)?.reference()

      expect(column(name)?.notNull).toBe(false)
      expect(reference && getTableConfig(reference.foreignTable).name).toBe(
        getTableConfig(user).name
      )
      expect(foreignKeyOn(name)?.onDelete).toBe('set null')
    }
  )

  it('lie le canal au type : renseigné si et seulement si échange', () => {
    const constraint = config.checks.find(
      (c) => c.name === 'member_note_channel_kind_check'
    )

    expect(constraint).toBeDefined()
  })

  it('indexe le fil d’une fiche dans l’ordre de lecture', () => {
    const index = config.indexes.find(
      (i) => i.config.name === 'member_note_organization_member_entry_idx'
    )

    expect(
      index?.config.columns.map((c) => ('name' in c ? c.name : null))
    ).toEqual([
      'organization_id',
      'member_profile_id',
      'entry_date',
      'created_at',
    ])
  })
})
