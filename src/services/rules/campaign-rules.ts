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
  CampaignTargetCountsDTO,
  CampaignTargetKind,
  CampaignTemplateId,
  CampaignVariable,
  CampaignVariableValues,
} from '../types/domain/campaign-types'
import {orderMyProfiles} from './my-profiles-order-rules'

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

/**
 * Une ligne de la cible : une par (fiche, adresse active), une par fiche sans
 * adresse active, `email` nul (s54, ADR 057).
 */
export type CampaignTargetRow = {
  memberProfileId: string
  name: string
  email: string | null
  unsubscribed: boolean
  /** Parcelles actuelles : l'ordre des fiches d'une adresse (ADR 054 §7). */
  currentParcelNumbers: readonly string[]
  /** Nom du compte de l'adresse relie a la fiche, `null` sans compte. */
  accountName: string | null
}

export type ComputedCampaignTarget<Row extends CampaignTargetRow> = {
  /** Un destinataire par adresse (ADR 055, ADR 057), qui la porte. */
  recipients: (Row & {email: string})[]
  /** Des fiches ciblees sans adresse active. */
  withoutEmail: number
  /** Des adresses. */
  unsubscribed: number
  /**
   * Des fiches ciblees avec au moins une adresse active (critere 5 de s27),
   * desinscrites comprises.
   */
  profilesWithEmail: number
}

/** Le predicat d'une cible (ADR 060 §2) : la fiche de la ligne est-elle visee ? */
export type CampaignTargetPredicate = (row: {
  memberProfileId: string
}) => boolean

const everyProfile: CampaignTargetPredicate = () => true

const emailKeyOf = (email: string): string => email.trim().toLowerCase()

/** La fiche qui porte l'envoi d'une adresse : la premiere de l'ordre ADR 054. */
const carrierOf = <Row extends CampaignTargetRow>(group: Row[]): Row =>
  orderMyProfiles(
    group.map((row) => ({
      row,
      id: row.memberProfileId,
      currentParcelNumbers: [...row.currentParcelNumbers],
    }))
  )[0].row

/**
 * Le calcul de la cible, point de passage unique des trois types (s25, s27,
 * ADR 060 §2) : les lignes de **toutes** les fiches (une par fiche et par
 * adresse active, s54, ADR 057) sont groupees par adresse (s53, ADR 055),
 * **puis** filtrees par `isTargeted`. Une adresse est retenue si une de ses
 * fiches est ciblee ; une adresse desinscrite l'est quelle que soit la fiche
 * qui la porte ; la porteuse vient des seules fiches ciblees. Une fiche sans
 * adresse n'est jamais comptee desinscrite. s27b y reintegre les statutaires.
 */
export const computeCampaignTarget = <Row extends CampaignTargetRow>(
  rows: readonly Row[],
  isTargeted: CampaignTargetPredicate = everyProfile
): ComputedCampaignTarget<Row> => {
  const groups = new Map<string, (Row & {email: string})[]>()
  const withoutEmailIds = new Set<string>()
  const withEmailIds = new Set<string>()
  for (const row of rows) {
    if (!row.email) {
      if (isTargeted(row)) withoutEmailIds.add(row.memberProfileId)
      continue
    }
    if (isTargeted(row)) withEmailIds.add(row.memberProfileId)
    const key = emailKeyOf(row.email)
    groups.set(key, [...(groups.get(key) ?? []), {...row, email: row.email}])
  }

  const recipients: (Row & {email: string})[] = []
  let unsubscribed = 0
  for (const group of groups.values()) {
    const targeted = group.filter((row) => isTargeted(row))
    if (targeted.length === 0) continue
    if (group.some((row) => row.unsubscribed)) unsubscribed += 1
    else recipients.push(carrierOf(targeted))
  }
  return {
    recipients,
    withoutEmail: withoutEmailIds.size,
    unsubscribed,
    profilesWithEmail: withEmailIds.size,
  }
}

/**
 * Le decompte affiche avant l'envoi (critere 5 de s27) : en fiches d'abord,
 * avec et sans adresse active, puis en adresses destinataires et desinscrites.
 */
export const campaignTargetCountsOf = (
  target: ComputedCampaignTarget<CampaignTargetRow>
): CampaignTargetCountsDTO => ({
  profilesWithEmail: target.profilesWithEmail,
  profilesWithoutEmail: target.withoutEmail,
  profiles: target.profilesWithEmail + target.withoutEmail,
  recipients: target.recipients.length,
  unsubscribed: target.unsubscribed,
})

/**
 * Les fiches **ciblees** qui portent l'adresse de ce destinataire, lui
 * compris (s53, ADR 055 ; s27, ADR 060 §2) ; lui seul s'il n'a pas d'adresse.
 */
export const sameAddressRowsOf = <Row extends CampaignTargetRow>(
  rows: readonly Row[],
  recipient: Row,
  isTargeted: CampaignTargetPredicate = everyProfile
): Row[] => {
  const {email} = recipient
  if (!email) return [recipient]
  return rows.filter(
    (row) =>
      row.email !== null &&
      emailKeyOf(row.email) === emailKeyOf(email) &&
      isTargeted(row)
  )
}

/**
 * `{nom}` et `{parcelle}` d'un envoi (s53, ADR 055) : pour une adresse a
 * plusieurs fiches, le nom du compte relie et les parcelles actuelles de
 * toutes ses fiches, en ordre numerique ; pour une seule, inchange.
 */
export const addressValuesOf = (recipient: {
  name: string
  accountName: string | null
  addressProfileCount: number
  parcelNumbers: readonly string[]
}): {name: string; parcelNumbers: string[]} => ({
  name:
    recipient.addressProfileCount > 1 && recipient.accountName
      ? recipient.accountName
      : recipient.name,
  parcelNumbers: [...recipient.parcelNumbers].sort((a, b) =>
    a.localeCompare(b, 'fr', {numeric: true})
  ),
})

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
  targetGroupId: string | null
  targetGroupName: string | null
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
  /** Jour ou part le reste reporte faute de budget (s52), ou rien. */
  deferredTo?: string | null
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

/**
 * Le jour ou part le reste d'une part non close que le budget du jour a
 * reporte (s52, ADR 053 §5), pose par le report lui-meme : une nouvelle
 * tentative qui passe minuit n'en est pas un (revue s52, n° 3). Rien sinon.
 */
export const deferredDayOf = (
  part: Pick<CampaignPartRow, 'status' | 'scheduledFor' | 'deferredTo'>
): string | null => {
  if (part.status === 'sent' || part.status === 'failed') return null
  return part.deferredTo && part.deferredTo > part.scheduledFor
    ? part.deferredTo
    : null
}

const toPartDto = (
  part: CampaignPartRow,
  countRows: readonly CampaignRecipientCountRow[]
): CampaignPartDTO => {
  const counts = recipientCountsOf(
    countRows.filter((row) => row.partId === part.id)
  )
  const deferredUntil = deferredDayOf(part)
  return {
    number: part.number,
    day: part.scheduledFor,
    recipientCount: part.recipientCount,
    receivedCount: counts.received,
    toVerifyCount: counts.toVerify,
    displayState: deferredUntil
      ? 'scheduled'
      : partDisplayStateOf(part.status, counts.toVerify),
    deferredUntil,
    deferredCount: deferredUntil ? counts.scheduled : 0,
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
    targetGroupName: row.targetGroupName,
    targetGroupDeleted:
      row.targetKind === 'group' && row.targetGroupId === null,
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
