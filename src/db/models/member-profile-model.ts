import {sql} from 'drizzle-orm'
import {pgTable, text, timestamp, uniqueIndex, uuid} from 'drizzle-orm/pg-core'

import {organization} from './auth-model'

/**
 * Fiche d'un proprietaire (s12, ADR 029). Table metier : RLS forcee, policy
 * `tenant_isolation` (ADR 002). A ne pas confondre avec `member` (Better
 * Auth, plan identite, ADR 014) : une fiche existe **sans compte**.
 *
 * - `id` est **la seule identite** d'un proprietaire : jamais l'email (absent,
 *   changeant, partage dans un foyer), jamais un numero de parcelle (transmis
 *   a la vente).
 * - `name` est un seul champ, tel qu'il s'ecrit sur un courrier : « Jean et
 *   Odile Dubois », « SCI Les Pins ».
 * - Aucune colonne d'adresse **email** : les adresses email d'une fiche vivent
 *   dans `member_profile_email` (s54, ADR 056, remplace l'ADR 040). « Courrier
 *   uniquement » = aucune adresse email **active**, calcule a la lecture.
 * - Deux adresses **postales** typees, facultatives (s55, ADR 058) : le
 *   domicile (`home_*`, l'adresse postale de la fiche, celle du courrier) et le
 *   terrain (`land_*`, le terrain de vacances dans l'association). Le domicile
 *   est l'adresse postale de s12, renommee sans perte. `company_name` est le
 *   libelle « nom de l'entreprise » : il ne change ni le role, ni les
 *   factures, ni le droit de vote.
 * - Aucune colonne de parcelle : le lien fiche ↔ parcelle est date, dans
 *   `parcel_ownership`.
 * - Aucune colonne de compte : le lien fiche ↔ compte vit dans
 *   `member_profile_account` (s53, ADR 054, remplace l'ADR 037).
 * - `pennylane_customer_id` est la cle d'import d'un client Pennylane (s13,
 *   ADR 048) : unique par association quand elle est presente. Elle identifie
 *   un client Pennylane, **jamais** la fiche, dont l'identite reste `id`.
 */
export const memberProfile = pgTable(
  'member_profile',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    name: text('name').notNull(),
    phone: text('phone'),
    homeAddressLine: text('home_address_line'),
    homeAddressComplement: text('home_address_complement'),
    homePostalCode: text('home_postal_code'),
    homeCity: text('home_city'),
    landAddressLine: text('land_address_line'),
    landAddressComplement: text('land_address_complement'),
    landPostalCode: text('land_postal_code'),
    landCity: text('land_city'),
    companyName: text('company_name'),
    pennylaneCustomerId: text('pennylane_customer_id'),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('member_profile_organization_pennylane_idx')
      .on(table.organizationId, table.pennylaneCustomerId)
      .where(sql`${table.pennylaneCustomerId} is not null`),
  ]
)

export type MemberProfileModel = typeof memberProfile.$inferSelect
export type AddMemberProfileModel = typeof memberProfile.$inferInsert
