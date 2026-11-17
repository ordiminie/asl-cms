import {getTableConfig} from 'drizzle-orm/pg-core'
import {describe, expect, it} from 'vitest'

import {organization} from './models/auth-model'
import {
  invoiceStatusAlert,
  memberInvoice,
  memberInvoiceSourceEnum,
} from './models/member-invoice-model'
import {memberProfile} from './models/member-profile-model'
import {parcel} from './models/parcel-model'

/**
 * Factures des membres et alertes de statut (s19, ADR 059 §1 et §5). Vit hors
 * de `src/db/models/` : un fichier de test dans ce dossier casse drizzle-kit
 * (voir `rls-inventory.test.ts`).
 */
describe('member_invoice (s19, ADR 059 §1)', () => {
  const config = getTableConfig(memberInvoice)
  const column = (name: string) => config.columns.find((c) => c.name === name)
  const foreignKeyOn = (name: string) =>
    config.foreignKeys.find((fk) =>
      fk.reference().columns.some((c) => c.name === name)
    )
  const targetOf = (name: string) => {
    const reference = foreignKeyOn(name)?.reference()
    return reference && getTableConfig(reference.foreignTable).name
  }

  it('porte les colonnes de l’ADR, et elles seules — aucun champ de paiement', () => {
    expect(config.name).toBe('member_invoice')
    expect(config.columns.map((c) => c.name).sort()).toEqual(
      [
        'id',
        'organization_id',
        'member_profile_id',
        'parcel_id',
        'source',
        'external_id',
        'year',
        'issued_on',
        'due_on',
        'amount_cents',
        'status',
        'created_at',
        'updated_at',
      ].sort()
    )
  })

  it('exige tout sauf l’identifiant chez la source', () => {
    for (const name of [
      'organization_id',
      'member_profile_id',
      'parcel_id',
      'source',
      'year',
      'issued_on',
      'due_on',
      'amount_cents',
      'status',
      'created_at',
      'updated_at',
    ]) {
      expect(column(name)?.notNull, name).toBe(true)
    }
    expect(column('external_id')?.notNull).toBe(false)
  })

  it('le statut est un texte opaque, la source un ensemble fermé du produit', () => {
    expect(column('status')?.columnType).toBe('PgText')
    expect(memberInvoiceSourceEnum.enumValues).toEqual(['site', 'pennylane'])
    expect(column('amount_cents')?.columnType).toBe('PgInteger')
    expect(column('issued_on')?.columnType).toBe('PgDateString')
    expect(column('due_on')?.columnType).toBe('PgDateString')
  })

  it('rattache la facture à la fiche facturée, la parcelle en description, sans ricochet', () => {
    expect(targetOf('organization_id')).toBe(getTableConfig(organization).name)
    expect(foreignKeyOn('organization_id')?.onDelete).toBe('cascade')
    expect(targetOf('member_profile_id')).toBe(
      getTableConfig(memberProfile).name
    )
    expect(foreignKeyOn('member_profile_id')?.onDelete).toBe('restrict')
    expect(targetOf('parcel_id')).toBe(getTableConfig(parcel).name)
    expect(foreignKeyOn('parcel_id')?.onDelete).toBe('restrict')
  })

  it('contrôle montant positif et échéance au plus tôt à l’émission', () => {
    expect(config.checks.map((c) => c.name).sort()).toEqual(
      [
        'member_invoice_amount_positive_check',
        'member_invoice_due_on_check',
      ].sort()
    )
  })

  it('l’identifiant chez la source est unique par association quand il est renseigné', () => {
    const unique = config.indexes.find(
      (candidate) =>
        candidate.config.name === 'member_invoice_organization_external_id_idx'
    )
    expect(unique?.config.unique).toBe(true)
    expect(unique?.config.where).toBeDefined()
  })
})

describe('invoice_status_alert (s19, ADR 059 §5)', () => {
  const config = getTableConfig(invoiceStatusAlert)

  it('une ligne par statut signalé et par association', () => {
    expect(config.name).toBe('invoice_status_alert')
    expect(config.columns.map((c) => c.name).sort()).toEqual(
      ['id', 'organization_id', 'status', 'notified_at'].sort()
    )
    expect(
      config.uniqueConstraints.map((constraint) => ({
        name: constraint.name,
        columns: constraint.columns.map((c) => c.name),
      }))
    ).toEqual([
      {
        name: 'invoice_status_alert_organization_status_unique',
        columns: ['organization_id', 'status'],
      },
    ])
  })
})
