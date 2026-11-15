import {getTableConfig} from 'drizzle-orm/pg-core'
import {describe, expect, it} from 'vitest'

import {associationCategory} from './models/association-category-model'
import {organization} from './models/auth-model'
import {memberProfile} from './models/member-profile-model'
import {memberQuestion} from './models/member-question-model'

/**
 * Questions posees par un membre au bureau (s23). Vit hors de
 * `src/db/models/` : un fichier de test dans ce dossier casse drizzle-kit
 * (voir `rls-inventory.test.ts`).
 */
describe('member_question (s23)', () => {
  const config = getTableConfig(memberQuestion)
  const column = (name: string) => config.columns.find((c) => c.name === name)
  const foreignKeyOn = (name: string) =>
    config.foreignKeys.find((fk) =>
      fk.reference().columns.some((c) => c.name === name)
    )

  it('porte les colonnes du plan, et elles seules', () => {
    expect(config.name).toBe('member_question')
    expect(config.columns.map((c) => c.name).sort()).toEqual(
      [
        'id',
        'organization_id',
        'member_id',
        'category_id',
        'body',
        'notification_failed',
        'created_at',
      ].sort()
    )
  })

  it('exige l association, la fiche, le sujet et le texte', () => {
    expect(column('organization_id')?.notNull).toBe(true)
    expect(column('member_id')?.notNull).toBe(true)
    expect(column('category_id')?.notNull).toBe(true)
    expect(column('body')?.notNull).toBe(true)
    expect(column('notification_failed')?.notNull).toBe(true)
    expect(column('notification_failed')?.default).toBe(false)
    expect(column('created_at')?.notNull).toBe(true)
    expect(column('created_at')?.hasDefault).toBe(true)
  })

  it('supprime les questions avec leur association (cascade)', () => {
    const reference = foreignKeyOn('organization_id')?.reference()

    expect(reference && getTableConfig(reference.foreignTable).name).toBe(
      getTableConfig(organization).name
    )
    expect(foreignKeyOn('organization_id')?.onDelete).toBe('cascade')
  })

  it('refuse la suppression d une fiche portant des questions (RESTRICT)', () => {
    const reference = foreignKeyOn('member_id')?.reference()

    expect(reference && getTableConfig(reference.foreignTable).name).toBe(
      getTableConfig(memberProfile).name
    )
    expect(foreignKeyOn('member_id')?.onDelete).toBe('restrict')
  })

  it('garde le lien au sujet, jamais supprime physiquement (RESTRICT, critere 5)', () => {
    const reference = foreignKeyOn('category_id')?.reference()

    expect(reference && getTableConfig(reference.foreignTable).name).toBe(
      getTableConfig(associationCategory).name
    )
    expect(foreignKeyOn('category_id')?.onDelete).toBe('restrict')
  })

  it('indexe la file du bureau, plus recente d abord', () => {
    const index = config.indexes.find(
      (i) => i.config.name === 'member_question_organization_created_idx'
    )

    expect(
      index?.config.columns.map((c) => ('name' in c ? c.name : null))
    ).toEqual(['organization_id', 'created_at'])
  })
})
