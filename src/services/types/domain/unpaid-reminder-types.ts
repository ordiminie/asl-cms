import type {CampaignDisplayState} from './campaign-types'

/**
 * Types de domaine des relances d'impayes (s29, ADR 070). Ecrits **sans
 * importer le modele Drizzle** (`rule-architecture`). Liste blanche : ni
 * adresse, ni jeton, ni contenu de facture au-dela de ses dates et de sa
 * parcelle.
 */

/** Lignes par page du tableau « Impayes ». */
export const UNPAID_REMINDERS_PAGE_SIZE = 25

/** Le canal par lequel une fiche est relancee. */
export type UnpaidReminderChannel = 'email' | 'letter'

/** Un rang deja cree : l'etat de sa campagne, tel que s26 le lit. */
export type UnpaidReminderCreatedRankDTO = {
  rank: number
  status: 'created'
  campaignId: string
  /** Jour de Paris de l'envoi reel, sinon du lancement. */
  day: string
  displayState: CampaignDisplayState
  /** Adresses destinataires. */
  recipientCount: number
  /** Fiches au courrier (s28). */
  letterCount: number
  receivedCount: number
  /** Destinataires reportes faute de budget (s52), et le jour ou ils partent. */
  deferredCount: number
  deferredUntil: string | null
}

/**
 * Un rang pas encore cree : `scheduled` (le prochain, la relance activee),
 * `upcoming` (plus tard), `not_scheduled` (la relance desactivee). Le jour
 * est celui que le calage prevoit (ADR 070 §5).
 */
export type UnpaidReminderPlannedRankDTO = {
  rank: number
  status: 'scheduled' | 'upcoming' | 'not_scheduled'
  day: string
}

export type UnpaidReminderRankDTO =
  UnpaidReminderCreatedRankDTO | UnpaidReminderPlannedRankDTO

/** Le calendrier d'une echeance qui porte au moins un impaye. */
export type UnpaidReminderScheduleDTO = {
  dueOn: string
  ranks: UnpaidReminderRankDTO[]
}

export type UnpaidReminderInvoiceDTO = {
  issuedOn: string
  dueOn: string
  parcelNumber: string | null
}

/** Une relance recue par une fiche : son rang, son jour, son canal. */
export type UnpaidReminderReceivedDTO = {
  rank: number
  day: string
  channel: UnpaidReminderChannel
}

/** Une fiche en impaye, telle que le tableau la montre. */
export type UnpaidReminderMemberDTO = {
  id: string
  name: string
  parcelNumbers: string[]
  invoices: UnpaidReminderInvoiceDTO[]
  reminders: UnpaidReminderReceivedDTO[]
  channel: UnpaidReminderChannel
}

export type UnpaidReminderMembersPageDTO = {
  items: UnpaidReminderMemberDTO[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type UnpaidRemindersOverviewDTO =
  | {
      status: 'ready'
      enabled: boolean
      delaysWeeks: readonly number[] | null
      /** Le nombre de relances d'une serie. */
      rankCount: number
      schedules: UnpaidReminderScheduleDTO[]
      members: UnpaidReminderMembersPageDTO
      counts: {unpaid: number; byEmail: number; byLetter: number}
    }
  /** Factures illisibles : jamais une liste vide trompeuse. */
  | {
      status: 'unavailable'
      enabled: boolean
      delaysWeeks: readonly number[] | null
    }

export type UnpaidRemindersOverviewInput = {
  organizationId: string
  page: number
}
