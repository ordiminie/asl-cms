import type {
  DeferredCampaignPart,
  PendingDeferredEmail,
  PendingSendDTO,
  TenantEmailNature,
} from '../types/domain/email-send-types'
import {calendarDayOf} from '../types/domain/water-analysis-types'
import {addDays, parisTwoAm} from './campaign-schedule-rules'

/**
 * Regles pures du budget d'envoi quotidien d'une association (s52, ADR 053).
 * Aucun acces a la base ni a l'horloge : l'instant vient de l'appelant. Le
 * jour est celui de Paris, au format ISO `YYYY-MM-DD`.
 */

/** Envois reportables accordes par jour : `limite − reserve`, jamais negatif. */
export const reportableAllowance = (limit: number, reserve: number): number =>
  Math.max(0, limit - reserve)

/** Envois reportables encore possibles aujourd'hui, jamais negatif. */
export const remainingReportable = (
  limit: number,
  reserve: number,
  reportableCount: number
): number => Math.max(0, reportableAllowance(limit, reserve) - reportableCount)

/** Seul un email de connexion n'est jamais reporte ni refuse (critere 3). */
export const isNeverDeferred = (nature: TenantEmailNature): boolean =>
  nature === 'login'

/**
 * Un envoi dont l'appelant tient lui-meme la file de report (ADR 053 §5) :
 * une campagne n'est jamais copiee, sa ligne de destinataire attend.
 */
export const isDeferredByCaller = (nature: TenantEmailNature): boolean =>
  nature === 'campaign'

/** Le jour du budget : le jour calendaire de Paris (critere 10). */
export const budgetDayOf = (now: Date): string => calendarDayOf(now)

/** Le jour d'envoi d'un email reporte le jour `day` : le lendemain. */
export const deferredSendOn = (day: string): string => addDays(day, 1)

/** L'echeance du rejeu d'un email reporte le jour `day` : lendemain, 02:00. */
export const deferredRunAfter = (day: string): Date =>
  parisTwoAm(deferredSendOn(day))

const REFERENCE_TYPES = new Set(['contact_message', 'incident_report'])

const referenceOf = (row: PendingDeferredEmail): PendingSendDTO['reference'] =>
  row.referenceType && row.referenceId && REFERENCE_TYPES.has(row.referenceType)
    ? {
        type: row.referenceType as 'contact_message' | 'incident_report',
        id: row.referenceId,
      }
    : null

/**
 * Les envois en attente du bureau (s52, ecran 1) : une part de campagne
 * reportee = une ligne ; une notification = une ligne, ses destinataires
 * regroupes par objet et par jour. Les parts d'abord, puis les emails dans
 * l'ordre recu.
 */
export const groupPendingSends = (
  deferredEmails: readonly PendingDeferredEmail[],
  campaignParts: readonly DeferredCampaignPart[]
): PendingSendDTO[] => {
  const groups = new Map<string, PendingSendDTO>()
  for (const part of campaignParts) {
    const key = `campaign:${part.campaignId}:${part.partNumber}`
    groups.set(key, {
      key,
      nature: 'campaign',
      reference: {type: 'campaign', id: part.campaignId},
      campaignSubject: part.campaignSubject,
      partNumber: part.partNumber,
      partCount: part.partCount,
      recipientCount: part.recipientCount,
      sendOn: part.sendOn,
    })
  }
  for (const row of deferredEmails) {
    const reference = referenceOf(row)
    const key = reference
      ? `${reference.type}:${reference.id}:${row.sendOn}`
      : row.id
    const existing = groups.get(key)
    if (existing) {
      existing.recipientCount += 1
      continue
    }
    groups.set(key, {
      key,
      nature: 'board_notification',
      reference,
      campaignSubject: null,
      partNumber: null,
      partCount: null,
      recipientCount: 1,
      sendOn: row.sendOn,
    })
  }
  return [...groups.values()]
}
