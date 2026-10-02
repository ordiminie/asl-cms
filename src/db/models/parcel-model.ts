import {sql} from 'drizzle-orm'
import {
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization} from './auth-model'
import {memberProfile} from './member-profile-model'

/**
 * Parcelle d'une association (s12, ADR 029). Table metier : RLS forcee,
 * policy `tenant_isolation` (ADR 002).
 *
 * - `number` est un texte, tel que l'association le note ; unique **par
 *   association**, jamais globalement.
 * - **Aucune colonne « proprietaire actuel »** : le proprietaire se lit
 *   toujours par date, dans `parcel_ownership`.
 */
export const parcel = pgTable(
  'parcel',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    number: text('number').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('parcel_organization_number_unique').on(
      table.organizationId,
      table.number
    ),
  ]
)

/**
 * Periode de propriete d'une parcelle (s12, ADR 029) : la relation **datee**
 * fiche ↔ parcelle. Table metier : RLS forcee, policy `tenant_isolation`.
 *
 * - Periode demi-ouverte `[starts_on, ends_on)` : `ends_on` est le jour de la
 *   vente, premier jour de l'acquereur ; nul tant que la periode est ouverte.
 * - `ON DELETE RESTRICT` sur la parcelle et sur la fiche : un historique ne
 *   disparait pas par ricochet.
 * - Porte son propre `organization_id` : la policy n'a pas de jointure a
 *   faire.
 * - Le non-chevauchement est controle par le service, sous verrou de la ligne
 *   `parcel` (ADR 029 §3) : aucune contrainte d'exclusion.
 */
export const parcelOwnership = pgTable(
  'parcel_ownership',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    parcelId: uuid('parcel_id')
      .notNull()
      .references(() => parcel.id, {onDelete: 'restrict'}),
    memberProfileId: uuid('member_profile_id')
      .notNull()
      .references(() => memberProfile.id, {onDelete: 'restrict'}),
    startsOn: date('starts_on', {mode: 'string'}).notNull(),
    endsOn: date('ends_on', {mode: 'string'}),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('parcel_ownership_parcel_starts_on_idx').on(
      table.parcelId,
      table.startsOn
    ),
    index('parcel_ownership_member_profile_idx').on(table.memberProfileId),
    check(
      'parcel_ownership_period_check',
      sql`${table.endsOn} IS NULL OR ${table.endsOn} > ${table.startsOn}`
    ),
  ]
)

export type ParcelModel = typeof parcel.$inferSelect
export type AddParcelModel = typeof parcel.$inferInsert
export type ParcelOwnershipModel = typeof parcelOwnership.$inferSelect
export type AddParcelOwnershipModel = typeof parcelOwnership.$inferInsert
