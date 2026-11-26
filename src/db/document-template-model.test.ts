import {getTableConfig} from 'drizzle-orm/pg-core'
import {describe, expect, it} from 'vitest'

import {organization} from './models/auth-model'
import {documentTemplate} from './models/document-template-model'

/**
 * Modeles de documents (s36, ADR 074 §1). Vit hors de `src/db/models/` : un
 * fichier de test dans ce dossier casse drizzle-kit (voir
 * `rls-inventory.test.ts`).
 */
describe('document_template (s36, ADR 074 §1)', () => {
  const config = getTableConfig(documentTemplate)
  const column = (name: string) => config.columns.find((c) => c.name === name)
  const foreignKeyOn = (name: string) =>
    config.foreignKeys.find((fk) =>
      fk.reference().columns.some((c) => c.name === name)
    )

  it('porte les colonnes de l’ADR, et elles seules', () => {
    expect(config.name).toBe('document_template')
    expect(config.columns.map((c) => c.name).sort()).toEqual(
      [
        'id',
        'organization_id',
        'name',
        'subject',
        'body_markdown',
        'created_at',
        'updated_at',
      ].sort()
    )
    for (const name of [
      'organization_id',
      'name',
      'subject',
      'body_markdown',
      'created_at',
      'updated_at',
    ]) {
      expect(column(name)?.notNull, name).toBe(true)
    }
    expect(column('id')?.primary).toBe(true)
  })

  it('n’a aucune colonne de clé de fichier', () => {
    expect(config.columns.some((c) => c.name.endsWith('_key'))).toBe(false)
  })

  it('suit son association (cascade)', () => {
    const reference = foreignKeyOn('organization_id')?.reference()
    expect(reference && getTableConfig(reference.foreignTable).name).toBe(
      getTableConfig(organization).name
    )
    expect(foreignKeyOn('organization_id')?.onDelete).toBe('cascade')
  })

  it('indexe le nom par association, sans unicité', () => {
    const byName = config.indexes.find(
      (i) => i.config.name === 'document_template_organization_name_idx'
    )
    expect(byName?.config.unique).toBe(false)
    expect(byName?.config.columns).toHaveLength(2)
  })
})
