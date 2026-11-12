import {getTableConfig} from 'drizzle-orm/pg-core'
import {describe, expect, it} from 'vitest'

import {organization, user} from './models/auth-model'
import {
  campaign,
  campaignPart,
  campaignPartStatusEnum,
  campaignRecipient,
  campaignRecipientStatusEnum,
  campaignStatusEnum,
  memberUnsubscribe,
} from './models/campaign-model'
import {memberProfile} from './models/member-profile-model'

/**
 * Campagnes, lignes d'envoi et desinscriptions (s25, ADR 051). Vit hors de
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
  const referencedTableOf = (name: string) => {
    const reference = foreignKeyOn(name)?.reference()
    return reference && getTableConfig(reference.foreignTable).name
  }
  const uniqueColumns = () =>
    config.uniqueConstraints.map((u) => u.columns.map((c) => c.name))
  const indexColumns = (indexName: string) =>
    config.indexes
      .find((i) => i.config.name === indexName)
      ?.config.columns.map((c) => ('name' in c ? c.name : null))
  return {
    config,
    column,
    foreignKeyOn,
    referencedTableOf,
    uniqueColumns,
    indexColumns,
  }
}

describe('enums de campagne (ADR 051)', () => {
  it('énumère les statuts d’une campagne et d’une ligne d’envoi', () => {
    expect(campaignStatusEnum.enumName).toBe('campaign_status')
    expect([...campaignStatusEnum.enumValues]).toEqual([
      'sending',
      'sent',
      'interrupted',
    ])
    expect(campaignRecipientStatusEnum.enumName).toBe(
      'campaign_recipient_status'
    )
    expect([...campaignRecipientStatusEnum.enumValues]).toEqual([
      'pending',
      'sent',
      'failed',
      'sending',
      'to_verify',
      'unsubscribed',
    ])
  })

  it('énumère les statuts d’une part (s26, ADR 052)', () => {
    expect(campaignPartStatusEnum.enumName).toBe('campaign_part_status')
    expect([...campaignPartStatusEnum.enumValues]).toEqual([
      'scheduled',
      'sending',
      'sent',
      'failed',
    ])
  })
})

describe('campaign_part (s26, ADR 052)', () => {
  const t = describeTable(campaignPart)

  it('porte les colonnes du plan, et elles seules', () => {
    expect(t.config.name).toBe('campaign_part')
    expect(t.config.columns.map((c) => c.name).sort()).toEqual(
      [
        'id',
        'organization_id',
        'campaign_id',
        'number',
        'scheduled_for',
        'recipient_count',
        'status',
        'finished_at',
      ].sort()
    )
    expect(t.column('scheduled_for')?.getSQLType()).toBe('date')
    expect(t.column('status')?.getSQLType()).toBe('campaign_part_status')
  })

  it('suit son association et sa campagne (cascade), un numéro unique par campagne', () => {
    expect(t.foreignKeyOn('organization_id')?.onDelete).toBe('cascade')
    expect(t.referencedTableOf('campaign_id')).toBe('campaign')
    expect(t.foreignKeyOn('campaign_id')?.onDelete).toBe('cascade')
    expect(t.uniqueColumns()).toContainEqual(['campaign_id', 'number'])
  })
})

describe('campaign (ADR 051)', () => {
  const t = describeTable(campaign)

  it('porte les colonnes du plan, et elles seules', () => {
    expect(t.config.name).toBe('campaign')
    expect(t.config.columns.map((c) => c.name).sort()).toEqual(
      [
        'id',
        'organization_id',
        'submission_id',
        'subject',
        'preheader',
        'body_markdown',
        'template_id',
        'target_kind',
        'recipient_count',
        'without_email_count',
        'unsubscribed_count',
        'sent_count',
        'status',
        'send_date',
        'author_user_id',
        'author_name',
        'on_behalf_of_user_id',
        'on_behalf_of_name',
        'created_at',
        'updated_at',
        'finished_at',
      ].sort()
    )
  })

  it('exige le contenu et les décomptes ; aperçu, modèle et fin nullables', () => {
    for (const name of [
      'organization_id',
      'submission_id',
      'subject',
      'body_markdown',
      'target_kind',
      'recipient_count',
      'without_email_count',
      'unsubscribed_count',
      'sent_count',
      'status',
      'send_date',
      'created_at',
      'updated_at',
    ]) {
      expect(t.column(name)?.notNull, name).toBe(true)
    }
    expect(t.column('preheader')?.notNull).toBe(false)
    expect(t.column('template_id')?.notNull).toBe(false)
    expect(t.column('finished_at')?.notNull).toBe(false)
    expect(t.column('sent_count')?.hasDefault).toBe(true)
    expect(t.column('status')?.getSQLType()).toBe('campaign_status')
    expect(t.column('send_date')?.getSQLType()).toBe('date')
  })

  it('suit son association (cascade) et garde l’auteur copié (SET NULL)', () => {
    expect(t.referencedTableOf('organization_id')).toBe(
      getTableConfig(organization).name
    )
    expect(t.foreignKeyOn('organization_id')?.onDelete).toBe('cascade')
    for (const name of ['author_user_id', 'on_behalf_of_user_id']) {
      expect(t.referencedTableOf(name)).toBe(getTableConfig(user).name)
      expect(t.foreignKeyOn(name)?.onDelete).toBe('set null')
    }
  })

  it('rend la soumission unique par association (idempotence)', () => {
    expect(t.uniqueColumns()).toContainEqual([
      'organization_id',
      'submission_id',
    ])
  })

  it('indexe l’archive dans l’ordre de lecture', () => {
    expect(t.indexColumns('campaign_organization_created_idx')).toEqual([
      'organization_id',
      'created_at',
    ])
  })
})

describe('campaign_recipient (ADR 051)', () => {
  const t = describeTable(campaignRecipient)

  it('porte les colonnes du plan, et elles seules', () => {
    expect(t.config.name).toBe('campaign_recipient')
    expect(t.config.columns.map((c) => c.name).sort()).toEqual(
      [
        'id',
        'organization_id',
        'campaign_id',
        'member_profile_id',
        'part_id',
        'status',
        'unsubscribe_token',
        'sent_at',
        'claimed_at',
      ].sort()
    )
    expect(t.column('part_id')?.notNull).toBe(true)
    expect(t.referencedTableOf('part_id')).toBe('campaign_part')
    expect(t.column('claimed_at')?.notNull).toBe(false)
    expect(t.column('status')?.getSQLType()).toBe('campaign_recipient_status')
    expect(t.column('unsubscribe_token')?.notNull).toBe(true)
    expect(t.column('sent_at')?.notNull).toBe(false)
    expect(t.column('member_profile_id')?.notNull).toBe(false)
  })

  it('suit son association et sa campagne, survit à la fiche (SET NULL)', () => {
    expect(t.foreignKeyOn('organization_id')?.onDelete).toBe('cascade')
    expect(t.referencedTableOf('campaign_id')).toBe('campaign')
    expect(t.foreignKeyOn('campaign_id')?.onDelete).toBe('cascade')
    expect(t.referencedTableOf('member_profile_id')).toBe(
      getTableConfig(memberProfile).name
    )
    expect(t.foreignKeyOn('member_profile_id')?.onDelete).toBe('set null')
  })

  it('n’écrit jamais deux fois à la même fiche, et un jeton est unique', () => {
    expect(t.uniqueColumns()).toContainEqual([
      'campaign_id',
      'member_profile_id',
    ])
    expect(t.uniqueColumns()).toContainEqual([
      'organization_id',
      'unsubscribe_token',
    ])
    expect(t.indexColumns('campaign_recipient_campaign_status_idx')).toEqual([
      'campaign_id',
      'status',
    ])
  })
})

describe('member_unsubscribe (ADR 051)', () => {
  const t = describeTable(memberUnsubscribe)

  it('porte le refus d’une fiche, une ligne par fiche', () => {
    expect(t.config.name).toBe('member_unsubscribe')
    expect(t.config.columns.map((c) => c.name).sort()).toEqual(
      [
        'id',
        'organization_id',
        'member_profile_id',
        'campaign_id',
        'created_at',
      ].sort()
    )
    expect(t.column('member_profile_id')?.notNull).toBe(true)
    expect(t.uniqueColumns()).toContainEqual([
      'organization_id',
      'member_profile_id',
    ])
  })

  it('disparaît avec la fiche (CASCADE), survit à la campagne (SET NULL)', () => {
    expect(t.foreignKeyOn('organization_id')?.onDelete).toBe('cascade')
    expect(t.foreignKeyOn('member_profile_id')?.onDelete).toBe('cascade')
    expect(t.referencedTableOf('campaign_id')).toBe('campaign')
    expect(t.foreignKeyOn('campaign_id')?.onDelete).toBe('set null')
  })
})
