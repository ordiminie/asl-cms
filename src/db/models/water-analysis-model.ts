import {sql} from 'drizzle-orm'
import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization} from './auth-model'

/**
 * Analyse d'eau d'une association (s09, ADR 026) : un modele a **champs
 * fixes** (ADR 007) — date, affiche, texte facultatif, PDF. Table metier : RLS
 * forcee, policy `tenant_isolation` (ADR 002).
 *
 * - **Pas de colonne `status`** : la publication est directe (critere 4), la
 *   suppression definitive. Une colonne que rien ne fait changer serait un
 *   etat fantome.
 * - **Pas de colonne `image_alt`** : le texte alternatif de l'affiche est
 *   derive de `sampled_on` au rendu. Corriger la date corrige l'`alt`.
 * - `sampled_on` est une `date` sans heure ni fuseau : la date du prelevement,
 *   qui ordonne la liste.
 * - `poster_key` et `report_key` suivent la convention de colonne de cle de
 *   fichier (`_key`) que l'inventaire de s12c lira ; toutes deux obligatoires.
 * - `report_bytes` porte le poids du PDF, le seul poids affiche au visiteur.
 */
export const waterAnalysis = pgTable(
  'water_analysis',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    sampledOn: date('sampled_on', {mode: 'string'}).notNull(),
    posterKey: text('poster_key').notNull(),
    reportKey: text('report_key').notNull(),
    reportBytes: integer('report_bytes').notNull(),
    content: text('content').default('').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('water_analysis_organization_sampled_on_idx').on(
      table.organizationId,
      table.sampledOn
    ),
  ]
)

export type WaterAnalysisModel = typeof waterAnalysis.$inferSelect
export type AddWaterAnalysisModel = typeof waterAnalysis.$inferInsert
