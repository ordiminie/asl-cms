import {getTableConfig} from 'drizzle-orm/pg-core'
import {describe, expect, it} from 'vitest'

import {organization, user} from './models/auth-model'
import * as campaignModels from './models/campaign-model'
import {
  campaign,
  campaignLetterProfile,
  campaignNatureEnum,
  campaignPart,
  campaignPartStatusEnum,
  campaignRecipient,
  campaignRecipientProfile,
  campaignRecipientStatusEnum,
  campaignStatusEnum,
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
      'settled',
      'superseded',
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
        'deferred_to',
        'deferred_count',
      ].sort()
    )
    expect(t.column('scheduled_for')?.getSQLType()).toBe('date')
    expect(t.column('status')?.getSQLType()).toBe('campaign_part_status')
  })

  it('porte le jour et la taille du reste reporté faute de budget, vides sans report (revue s52, n° 1)', () => {
    expect(t.column('deferred_to')?.getSQLType()).toBe('date')
    expect(t.column('deferred_to')?.notNull).toBe(false)
    expect(t.column('deferred_count')?.getSQLType()).toBe('integer')
    expect(t.column('deferred_count')?.notNull).toBe(false)
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
        'nature',
        'target_kind',
        'target_group_id',
        'target_group_name',
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
        'stats_tracked',
        'stats_unique_opens',
        'stats_unique_clicks',
        'stats_read_at',
        'letter_text',
      ].sort()
    )
  })

  it('fige le texte du courrier de lancement (s42b, ADR 072 §6) : texte nullable', () => {
    expect(t.column('letter_text')?.getSQLType()).toBe('text')
    expect(t.column('letter_text')?.notNull).toBe(false)
  })

  it('statistiques (s30, ADR 068) : suivi non nul, faux par défaut ; relevé nullable', () => {
    expect(t.column('stats_tracked')?.getSQLType()).toBe('boolean')
    expect(t.column('stats_tracked')?.notNull).toBe(true)
    expect(t.column('stats_tracked')?.default).toBe(false)
    for (const name of ['stats_unique_opens', 'stats_unique_clicks']) {
      expect(t.column(name)?.getSQLType(), name).toBe('integer')
      expect(t.column(name)?.notNull, name).toBe(false)
    }
    expect(t.column('stats_read_at')?.getSQLType()).toBe(
      'timestamp with time zone'
    )
    expect(t.column('stats_read_at')?.notNull).toBe(false)
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

  it('fige la nature de l’envoi (s27b, ADR 064) : requise, facultative par défaut', () => {
    expect(campaignNatureEnum.enumName).toBe('campaign_nature')
    expect([...campaignNatureEnum.enumValues]).toEqual([
      'facultative',
      'statutaire',
    ])
    expect(t.column('nature')?.notNull).toBe(true)
    expect(t.column('nature')?.getSQLType()).toBe('campaign_nature')
    expect(t.column('nature')?.default).toBe('facultative')
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
        'email',
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
    expect(t.column('email')?.notNull).toBe(true)
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

  it('n’écrit jamais deux fois à la même adresse, et un jeton est unique (ADR 057)', () => {
    expect(t.uniqueColumns()).not.toContainEqual([
      'campaign_id',
      'member_profile_id',
    ])
    const byAddress = t.config.indexes.find(
      (i) => i.config.name === 'campaign_recipient_campaign_email_idx'
    )
    expect(byAddress?.config.unique).toBe(true)
    expect(byAddress?.config.columns).toHaveLength(2)
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

describe('member_unsubscribe (ADR 057)', () => {
  it('a disparu : le refus est porté par l’adresse de fiche', () => {
    expect('memberUnsubscribe' in campaignModels).toBe(false)
  })
})

describe('campaign_recipient_profile (s27, ADR 061)', () => {
  const t = describeTable(campaignRecipientProfile)

  it('porte les colonnes de l’ADR, et elles seules', () => {
    expect(t.config.name).toBe('campaign_recipient_profile')
    expect(t.config.columns.map((c) => c.name).sort()).toEqual(
      ['organization_id', 'campaign_recipient_id', 'member_profile_id'].sort()
    )
    for (const name of [
      'organization_id',
      'campaign_recipient_id',
      'member_profile_id',
    ]) {
      expect(t.column(name)?.notNull, name).toBe(true)
    }
  })

  it('disparaît avec son destinataire comme avec sa fiche (cascade)', () => {
    expect(t.referencedTableOf('organization_id')).toBe(
      getTableConfig(organization).name
    )
    expect(t.foreignKeyOn('organization_id')?.onDelete).toBe('cascade')
    expect(t.referencedTableOf('campaign_recipient_id')).toBe(
      'campaign_recipient'
    )
    expect(t.foreignKeyOn('campaign_recipient_id')?.onDelete).toBe('cascade')
    expect(t.referencedTableOf('member_profile_id')).toBe(
      getTableConfig(memberProfile).name
    )
    expect(t.foreignKeyOn('member_profile_id')?.onDelete).toBe('cascade')
  })

  it('une fiche n’est figée qu’une fois par destinataire (clé primaire composée)', () => {
    expect(
      t.config.primaryKeys.map((pk) => pk.columns.map((c) => c.name))
    ).toEqual([['campaign_recipient_id', 'member_profile_id']])
  })
})

describe('campaign_letter_profile (s28, ADR 065)', () => {
  const t = describeTable(campaignLetterProfile)

  it('porte les colonnes de l’ADR, et elles seules', () => {
    expect(t.config.name).toBe('campaign_letter_profile')
    expect(t.config.columns.map((c) => c.name).sort()).toEqual(
      ['organization_id', 'campaign_id', 'member_profile_id'].sort()
    )
    for (const name of [
      'organization_id',
      'campaign_id',
      'member_profile_id',
    ]) {
      expect(t.column(name)?.notNull, name).toBe(true)
    }
  })

  it('disparaît avec sa campagne, son association comme avec sa fiche (cascade)', () => {
    expect(t.referencedTableOf('organization_id')).toBe(
      getTableConfig(organization).name
    )
    expect(t.foreignKeyOn('organization_id')?.onDelete).toBe('cascade')
    expect(t.referencedTableOf('campaign_id')).toBe('campaign')
    expect(t.foreignKeyOn('campaign_id')?.onDelete).toBe('cascade')
    expect(t.referencedTableOf('member_profile_id')).toBe(
      getTableConfig(memberProfile).name
    )
    expect(t.foreignKeyOn('member_profile_id')?.onDelete).toBe('cascade')
  })

  it('une fiche n’est figée qu’une fois par campagne (clé primaire composée)', () => {
    expect(
      t.config.primaryKeys.map((pk) => pk.columns.map((c) => c.name))
    ).toEqual([['campaign_id', 'member_profile_id']])
  })
})
