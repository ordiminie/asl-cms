import {is} from 'drizzle-orm'
import {getTableConfig, PgTable} from 'drizzle-orm/pg-core'
import {describe, expect, it} from 'vitest'

import {memberInvoice} from './models/member-invoice-model'

/**
 * Garde de schema de s21 (critere 4, ADR 063) : le paiement est un lien
 * sortant, aucun moyen de paiement n'est stocke. Parcourt toutes les tables
 * `pgTable` exportees par les modeles et refuse toute colonne dont un mot du
 * nom evoque un moyen de paiement.
 *
 * Vit hors de `src/db/models/` : un fichier de test dans ce dossier casse
 * drizzle-kit (voir `rls-inventory.test.ts`).
 */

const modelModules = import.meta.glob('./models/*-model.ts', {
  eager: true,
}) as Record<string, Record<string, unknown>>

const tables = Object.values(modelModules)
  .flatMap((module) => Object.values(module))
  .filter((value): value is PgTable => is(value, PgTable))
  .map((table) => getTableConfig(table))

/** Les mots d'un nom de colonne qui evoquent un moyen de paiement. */
const PAYMENT_METHOD_WORDS = new Set([
  'iban',
  'bic',
  'card',
  'pan',
  'cvv',
  'cvc',
  'mandate',
  'rum',
  'bank',
])

/**
 * Vrai pour un nom qui evoque un moyen de paiement. Compare mot a mot (le
 * nom decoupe sur `_`) : `pan` ne doit pas refuser `company`, ni `bic`
 * refuser `public`.
 */
const evokesPaymentMethod = (columnName: string): boolean =>
  columnName.includes('payment_method') ||
  columnName
    .toLowerCase()
    .split('_')
    .some((word) => PAYMENT_METHOD_WORDS.has(word))

describe('aucun moyen de paiement dans le schéma (s21, critère 4, ADR 063)', () => {
  it('parcourt réellement les tables des modèles', () => {
    expect(tables.map((table) => table.name)).toEqual(
      expect.arrayContaining(['member_invoice', 'member_profile'])
    )
  })

  it('aucune colonne d’aucune table n’évoque un moyen de paiement', () => {
    const offending = tables.flatMap((table) =>
      table.columns
        .filter((column) => evokesPaymentMethod(column.name))
        .map((column) => `${table.name}.${column.name}`)
    )

    expect(offending).toEqual([])
  })

  it('la facture d’un membre ne stocke pas de lien de paiement : il vient du fournisseur', () => {
    expect(
      getTableConfig(memberInvoice).columns.map((column) => column.name)
    ).not.toContain('payment_url')
  })
})
