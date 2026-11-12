import {
  CAMPAIGN_SUBJECT_MAX_TOTAL,
  CAMPAIGN_SUBJECT_SEPARATOR,
  CAMPAIGN_VARIABLES,
  CampaignDisplayState,
  CampaignDTO,
  CampaignPartDisplayState,
  CampaignPartDTO,
  CampaignPartStatus,
  CampaignRecipientCountsDTO,
  CampaignRecipientStatus,
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

/** Une part telle que le repository la rend. */
export type CampaignPartRow = {
  id: string
  campaignId: string
  number: number
  scheduledFor: string
  recipientCount: number
  status: CampaignPartStatus
}

/** Un decompte de destinataires par campagne, part et statut. */
export type CampaignRecipientCountRow = {
  campaignId: string
  partId: string
  status: CampaignRecipientStatus
  total: number
}

const COUNT_KEY_OF: Record<
  CampaignRecipientStatus,
  keyof CampaignRecipientCountsDTO
> = {
  sent: 'received',
  pending: 'scheduled',
  sending: 'sending',
  to_verify: 'toVerify',
  failed: 'failed',
  unsubscribed: 'unsubscribed',
}

/** Les decomptes par statut d'un ensemble de lignes. */
export const recipientCountsOf = (
  rows: readonly CampaignRecipientCountRow[]
): CampaignRecipientCountsDTO => {
  const counts: CampaignRecipientCountsDTO = {
    received: 0,
    scheduled: 0,
    sending: 0,
    toVerify: 0,
    failed: 0,
    unsubscribed: 0,
  }
  for (const row of rows) counts[COUNT_KEY_OF[row.status]] += row.total
  return counts
}

const partDisplayStateOf = (
  status: CampaignPartStatus,
  toVerify: number
): CampaignPartDisplayState =>
  status === 'sent' && toVerify > 0 ? 'to_verify' : status

/**
 * L'etat affiche d'une campagne (ADR 052) : en cours tant qu'elle est
 * `sending` (une part programmee a demain n'est pas un arret), a verifier si
 * elle est close avec des lignes `to_verify`, en echec si interrompue.
 */
export const campaignDisplayStateOf = (
  status: CampaignStatus,
  counts: CampaignRecipientCountsDTO
): CampaignDisplayState => {
  if (status === 'interrupted') return 'failed'
  if (status === 'sent') return counts.toVerify > 0 ? 'to_verify' : 'sent'
  return 'sending'
}

const toPartDto = (
  part: CampaignPartRow,
  countRows: readonly CampaignRecipientCountRow[]
): CampaignPartDTO => {
  const counts = recipientCountsOf(
    countRows.filter((row) => row.partId === part.id)
  )
  return {
    number: part.number,
    day: part.scheduledFor,
    recipientCount: part.recipientCount,
    receivedCount: counts.received,
    toVerifyCount: counts.toVerify,
    displayState: partDisplayStateOf(part.status, counts.toVerify),
  }
}

/**
 * La campagne telle que le bureau la lit : une liste blanche, recopiee champ
 * par champ, avec ses decomptes et ses parts (s26). Les parts et decomptes
 * d'autres campagnes passes avec elle sont ignores.
 */
export const toCampaignDto = (
  row: CampaignRow,
  partRows: readonly CampaignPartRow[],
  countRows: readonly CampaignRecipientCountRow[]
): CampaignDTO => {
  const ownCounts = countRows.filter((count) => count.campaignId === row.id)
  const recipientCounts = recipientCountsOf(ownCounts)
  return {
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
    displayState: campaignDisplayStateOf(row.status, recipientCounts),
    recipientCounts,
    parts: partRows
      .filter((part) => part.campaignId === row.id)
      .sort((a, b) => a.number - b.number)
      .map((part) => toPartDto(part, ownCounts)),
    sendDate: row.sendDate,
    authorName: row.authorName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
  }
}

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
