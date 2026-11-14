import {and, eq, sql} from 'drizzle-orm'

import {emailSendBudget} from '@/db/models/email-send-budget-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Compteur du budget d'envoi quotidien (s52, ADR 053). Sous RLS forcee : a
 * appeler dans `withTenant(organizationId, ...)`, sans quoi rien ne se lit ni
 * ne s'ecrit.
 */

export type SendBudgetKey = {
  organizationId: string
  /** Jour de Paris, `YYYY-MM-DD`. */
  day: string
}

export type SendBudgetCounts = {reportableCount: number; loginCount: number}

/**
 * Accorde un envoi reportable si le compteur du jour reste sous `allowance`
 * (`limite − reserve`), **en une seule instruction** : la ligne du jour est
 * creee a 1, ou incrementee seulement si `reportable_count + 1 <= allowance`.
 * Aucune ligne rendue = budget epuise. Deux envois simultanes ne peuvent pas
 * depasser ensemble.
 */
export const claimReportableSendTxnDao = async ({
  organizationId,
  day,
  allowance,
}: SendBudgetKey & {allowance: number}): Promise<boolean> => {
  if (allowance < 1) return false
  const rows = await getDb()
    .insert(emailSendBudget)
    .values({organizationId, day, reportableCount: 1, loginCount: 0})
    .onConflictDoUpdate({
      target: [emailSendBudget.organizationId, emailSendBudget.day],
      set: {reportableCount: sql`${emailSendBudget.reportableCount} + 1`},
      setWhere: sql`${emailSendBudget.reportableCount} + 1 <= ${allowance}`,
    })
    .returning({reportableCount: emailSendBudget.reportableCount})
  return rows.length > 0
}

/** Decompte un email de connexion : toujours accorde, sans plafond. */
export const countLoginSendTxnDao = async ({
  organizationId,
  day,
}: SendBudgetKey): Promise<void> => {
  await getDb()
    .insert(emailSendBudget)
    .values({organizationId, day, reportableCount: 0, loginCount: 1})
    .onConflictDoUpdate({
      target: [emailSendBudget.organizationId, emailSendBudget.day],
      set: {loginCount: sql`${emailSendBudget.loginCount} + 1`},
    })
    .returning({loginCount: emailSendBudget.loginCount})
}

/**
 * Rend l'unite d'un envoi reportable refuse avec certitude par le
 * fournisseur. Jamais sous zero.
 */
export const refundReportableSendTxnDao = async ({
  organizationId,
  day,
}: SendBudgetKey): Promise<void> => {
  await getDb()
    .update(emailSendBudget)
    .set({
      reportableCount: sql`greatest(${emailSendBudget.reportableCount} - 1, 0)`,
    })
    .where(
      and(
        eq(emailSendBudget.organizationId, organizationId),
        eq(emailSendBudget.day, day)
      )
    )
}

/** Les compteurs du jour ; zero sans ligne. */
export const getSendBudgetDao = async ({
  organizationId,
  day,
}: SendBudgetKey): Promise<SendBudgetCounts> => {
  const [row] = await getDb()
    .select({
      reportableCount: emailSendBudget.reportableCount,
      loginCount: emailSendBudget.loginCount,
    })
    .from(emailSendBudget)
    .where(
      and(
        eq(emailSendBudget.organizationId, organizationId),
        eq(emailSendBudget.day, day)
      )
    )
  return row ?? {reportableCount: 0, loginCount: 0}
}
