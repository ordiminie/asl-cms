import {SQL, sql} from 'drizzle-orm'
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

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
 * - `email` est nul quand l'adresse est absente : aucune chaine vide, aucune
 *   adresse fictive n'est jamais ecrite. **Non unique** (s53, ADR 054) : une
 *   adresse portee par plusieurs fiches d'une association designe une seule
 *   personne, reliee a chacune par un seul compte.
 * - `mail_only` est **generee** (`email IS NULL`) : l'attribut que s25 et s28
 *   liront ne peut pas diverger de l'email.
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
    email: text('email'),
    phone: text('phone'),
    addressLine: text('address_line'),
    addressComplement: text('address_complement'),
    postalCode: text('postal_code'),
    city: text('city'),
    pennylaneCustomerId: text('pennylane_customer_id'),
    mailOnly: boolean('mail_only')
      .generatedAlwaysAs((): SQL => sql`"email" IS NULL`)
      .notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('member_profile_organization_email_idx')
      .on(table.organizationId, sql`lower(${table.email})`)
      .where(sql`${table.email} is not null`),
    uniqueIndex('member_profile_organization_pennylane_idx')
      .on(table.organizationId, table.pennylaneCustomerId)
      .where(sql`${table.pennylaneCustomerId} is not null`),
  ]
)

export type MemberProfileModel = typeof memberProfile.$inferSelect
export type AddMemberProfileModel = typeof memberProfile.$inferInsert
