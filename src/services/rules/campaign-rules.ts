import {
  CAMPAIGN_STALE_AFTER_MS,
  CAMPAIGN_SUBJECT_MAX_TOTAL,
  CAMPAIGN_SUBJECT_SEPARATOR,
  CAMPAIGN_VARIABLES,
  CampaignDTO,
  CampaignStatus,
  CampaignTargetKind,
  CampaignTemplateId,
  CampaignVariable,
  CampaignVariableValues,
} from '../types/domain/campaign-types'

/**
 * Regles pures des campagnes (s25, ADR 051). Aucun acces a la base : le
 * service les appelle pour le decompte, l'apercu **et** l'envoi.
 */

const VARIABLE_PATTERN = /\{([\p{L}\p{N}_-]+)\}/gu

const isKnownVariable = (name: string): name is CampaignVariable =>
  (CAMPAIGN_VARIABLES as readonly string[]).includes(name)

/**
 * Les variables inconnues d'un ecrit brut (objet, texte d'apercu, corps),
 * chacune une fois, dans l'ordre d'apparition. Des accolades sans mot ne sont
 * pas une variable.
 */
export const findUnknownVariables = (text: string): string[] => {
  const unknown = new Set<string>()
  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    if (!isKnownVariable(match[1])) unknown.add(match[1])
  }
  return [...unknown]
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character])

/**
 * Remplace les variables connues par les valeurs du destinataire, passees par
 * `escape` (HTML pour le corps rendu, identite pour le texte brut). Une
 * accolade qui n'est pas une variable reste telle quelle : c'est
 * `findUnknownVariables` qui la refuse avant l'envoi.
 */
export const substituteVariables = (
  text: string,
  values: CampaignVariableValues,
  escape: (value: string) => string
): string =>
  text.replace(VARIABLE_PATTERN, (whole, name: string) =>
    isKnownVariable(name) ? escape(values[name]) : whole
  )

const PARCEL_LIST_FORMAT = new Intl.ListFormat('fr', {
  style: 'long',
  type: 'conjunction',
})

/** Les parcelles actuelles d'un membre, « 12, 14 et 16 » ; aucune → vide. */
export const joinParcelNumbers = (numbers: readonly string[]): string =>
  PARCEL_LIST_FORMAT.format(numbers)

/** Une fiche de l'association, telle que le calcul de cible la lit. */
export type CampaignTargetRow = {
  memberProfileId: string
  name: string
  email: string | null
  unsubscribed: boolean
}

export type CampaignTarget<Row extends CampaignTargetRow> = {
  recipients: Row[]
  withoutEmail: number
  unsubscribed: number
}

/**
 * La cible « tous les membres » (criteres 2 et 7) : partition sans reste en
 * membres sans email, membres avec email desinscrits, et destinataires. Un
 * membre sans email n'est jamais compte desinscrit. Point de passage unique
 * que s27 etend et que s27b reintegre.
 */
export const computeCampaignTarget = <Row extends CampaignTargetRow>(
  rows: readonly Row[]
): CampaignTarget<Row> => {
  const recipients: Row[] = []
  let withoutEmail = 0
  let unsubscribed = 0
  for (const row of rows) {
    if (!row.email) withoutEmail += 1
    else if (row.unsubscribed) unsubscribed += 1
    else recipients.push(row)
  }
  return {recipients, withoutEmail, unsubscribed}
}

const subjectPrefixOf = (associationName: string): string =>
  `${associationName}${CAMPAIGN_SUBJECT_SEPARATOR}`

/** Plafond du champ objet : le total moins le prefixe de l'association. */
export const subjectMaxLength = (associationName: string): number =>
  Math.max(
    0,
    CAMPAIGN_SUBJECT_MAX_TOTAL - subjectPrefixOf(associationName).length
  )

/** L'objet recu : « {association} — {objet} ». */
export const finalSubject = (
  associationName: string,
  subject: string
): string => `${subjectPrefixOf(associationName)}${subject}`

/**
 * Le statut affiche : une campagne `sending` sans progres depuis
 * `CAMPAIGN_STALE_AFTER_MS` est `interrupted` (redemarrage). `now` vient de
 * l'appelant, jamais d'un scope `'use cache'`.
 */
export const effectiveCampaignStatus = (
  campaign: {status: CampaignStatus; updatedAt: string},
  now: Date
): CampaignStatus => {
  if (campaign.status !== 'sending') return campaign.status
  const idle = now.getTime() - new Date(campaign.updatedAt).getTime()
  return idle > CAMPAIGN_STALE_AFTER_MS ? 'interrupted' : 'sending'
}

/** La ligne telle que le repository la rend, ecrite sans le modele Drizzle. */
export type CampaignRow = {
  id: string
  organizationId: string
  submissionId: string
  subject: string
  preheader: string | null
  bodyMarkdown: string
  templateId: string | null
  targetKind: string
  recipientCount: number
  withoutEmailCount: number
  unsubscribedCount: number
  sentCount: number
  status: CampaignStatus
  sendDate: string
  authorUserId: string | null
  authorName: string | null
  onBehalfOfUserId: string | null
  onBehalfOfName: string | null
  createdAt: Date
  updatedAt: Date
  finishedAt: Date | null
}

/**
 * La campagne telle que le bureau la lit : une liste blanche, recopiee champ
 * par champ.
 */
export const toCampaignDto = (row: CampaignRow): CampaignDTO => ({
  id: row.id,
  subject: row.subject,
  preheader: row.preheader,
  bodyMarkdown: row.bodyMarkdown,
  templateId: row.templateId as CampaignTemplateId | null,
  targetKind: row.targetKind as CampaignTargetKind,
  recipientCount: row.recipientCount,
  withoutEmailCount: row.withoutEmailCount,
  unsubscribedCount: row.unsubscribedCount,
  sentCount: row.sentCount,
  status: row.status,
  sendDate: row.sendDate,
  authorName: row.authorName,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
})

const CAMPAIGN_DATE_FORMAT = new Intl.DateTimeFormat('fr', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/**
 * La valeur de `{date}` : le jour d'envoi (`YYYY-MM-DD`, deja ramene a Paris
 * par `calendarDayOf`) en toutes lettres, « 12 novembre 2026 ».
 */
export const formatCampaignDate = (sendDate: string): string =>
  CAMPAIGN_DATE_FORMAT.format(new Date(`${sendDate}T00:00:00Z`))
