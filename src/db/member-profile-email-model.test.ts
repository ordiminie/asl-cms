import {getTableConfig} from 'drizzle-orm/pg-core'
import {describe, expect, it} from 'vitest'

import {organization, user} from './models/auth-model'
import {
  memberProfileEmail,
  memberProfileEmailOriginEnum,
  memberProfileEmailRoleEnum,
  memberProfileEmailStatusEnum,
} from './models/member-profile-email-model'

/**
 * Adresses d'une fiche (s54, ADR 056). Vit hors de `src/db/models/` : un
 * fichier de test dans ce dossier casse drizzle-kit (voir
 * `rls-inventory.test.ts`).
 */
describe('member_profile_email (ADR 056)', () => {
  const config = getTableConfig(memberProfileEmail)
  const column = (name: string) => config.columns.find((c) => c.name === name)
  const foreignKeyOn = (name: string) =>
    config.foreignKeys.find((fk) =>
      fk.reference().columns.some((c) => c.name === name)
    )
  const referencedTableOf = (name: string) => {
    const reference = foreignKeyOn(name)?.reference()
    return reference && getTableConfig(reference.foreignTable).name
  }
  const indexNamed = (name: string) =>
    config.indexes.find((i) => i.config.name === name)

  it('porte les colonnes de l’ADR 056 §1, et elles seules', () => {
    expect(config.name).toBe('member_profile_email')
    expect(config.columns.map((c) => c.name).sort()).toEqual(
      [
        'id',
        'organization_id',
        'member_profile_id',
        'email',
        'role',
        'status',
        'origin',
        'added_by_user_id',
        'replaces_email_id',
        'confirmation_token_hash',
        'expires_at',
        'unsubscribed_at',
        'created_at',
        'updated_at',
      ].sort()
    )
  })

  it('exige le tenant, la fiche, l’adresse, le rôle, le statut et l’origine', () => {
    for (const name of [
      'organization_id',
      'member_profile_id',
      'email',
      'role',
      'status',
      'origin',
      'created_at',
      'updated_at',
    ]) {
      expect(column(name)?.notNull, name).toBe(true)
    }
    for (const name of [
      'added_by_user_id',
      'replaces_email_id',
      'confirmation_token_hash',
      'expires_at',
      'unsubscribed_at',
    ]) {
      expect(column(name)?.notNull, name).toBe(false)
    }
  })

  it('énumère rôle, statut et origine', () => {
    expect(memberProfileEmailRoleEnum.enumValues).toEqual([
      'holder',
      'additional',
    ])
    expect(memberProfileEmailStatusEnum.enumValues).toEqual([
      'active',
      'pending',
    ])
    expect(memberProfileEmailOriginEnum.enumValues).toEqual(['file', 'site'])
  })

  it('suit l’association et la fiche en cascade, l’auteur en SET NULL, l’adresse remplacée en cascade', () => {
    expect(referencedTableOf('organization_id')).toBe(
      getTableConfig(organization).name
    )
    expect(foreignKeyOn('organization_id')?.onDelete).toBe('cascade')
    expect(referencedTableOf('member_profile_id')).toBe('member_profile')
    expect(foreignKeyOn('member_profile_id')?.onDelete).toBe('cascade')
    expect(referencedTableOf('added_by_user_id')).toBe(
      getTableConfig(user).name
    )
    expect(foreignKeyOn('added_by_user_id')?.onDelete).toBe('set null')
    expect(referencedTableOf('replaces_email_id')).toBe('member_profile_email')
    expect(foreignKeyOn('replaces_email_id')?.onDelete).toBe('cascade')
  })

  it('rend l’adresse unique sans casse sur une fiche', () => {
    const index = indexNamed('member_profile_email_profile_email_idx')

    expect(index?.config.unique).toBe(true)
    expect(index?.config.columns).toHaveLength(2)
  })

  it('garantit au plus une titulaire active par fiche (unique partiel)', () => {
    const index = indexNamed('member_profile_email_active_holder_idx')

    expect(index?.config.unique).toBe(true)
    expect(index?.config.where).toBeDefined()
    expect(
      index?.config.columns.map((c) => ('name' in c ? c.name : null))
    ).toEqual(['member_profile_id'])
  })

  it('indexe l’adresse par association, sans la rendre unique', () => {
    const index = indexNamed('member_profile_email_organization_email_idx')

    expect(index?.config.unique).toBe(false)
    expect(index?.config.columns).toHaveLength(2)
  })
})
