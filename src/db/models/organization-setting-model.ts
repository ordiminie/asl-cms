import {pgTable, primaryKey, text, timestamp, uuid} from 'drizzle-orm/pg-core'

import {organization, user} from './auth-model'

/**
 * Valeurs des parametres d'une association (ADR 010, ADR 016). La definition
 * d'un parametre (type, obligatoire, defaut, libelles) vit dans le registre du
 * code ; la table ne porte que la valeur. Absence de ligne = valeur par
 * defaut. Table metier : RLS forcee, policy `tenant_isolation` (ADR 002).
 */
export const organizationSetting = pgTable(
  'organization_setting',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    key: text('key').notNull(),
    value: text('value').notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
    updatedBy: uuid('updated_by').references(() => user.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [primaryKey({columns: [table.organizationId, table.key]})]
)

export type OrganizationSettingModel = typeof organizationSetting.$inferSelect
export type AddOrganizationSettingModel =
  typeof organizationSetting.$inferInsert
