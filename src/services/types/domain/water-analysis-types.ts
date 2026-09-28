import {WaterAnalysisModel} from '@/db/models/water-analysis-model'

import {
  ContentFileScopeConst,
  isContentFileKeyAllowed,
} from './content-file-types'

/**
 * Types de domaine des analyses d'eau (s09, ADR 026). La presentation ne
 * connait que ceux-ci, jamais les modeles Drizzle.
 */

export type WaterAnalysis = WaterAnalysisModel

export type WaterAnalysisDTO = {
  id: string
  organizationId: string
  /** Date ISO `YYYY-MM-DD` du prelevement, sans heure ni fuseau. */
  sampledOn: string
  posterKey: string
  reportKey: string
  /** Poids du PDF, le seul poids affiche au visiteur. */
  reportBytes: number
  /** Texte brut facultatif ; chaine vide quand il n'y en a pas. */
  content: string
  createdAt: Date
  updatedAt: Date
}

/** Une page de liste : les lignes, et de quoi ecrire « Page x sur y ». */
export type WaterAnalysisListPageDTO = {
  items: WaterAnalysisDTO[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/**
 * Tailles de page d'affichage (ADR 023, §4) : des conventions de
 * presentation, pas des parametres d'association.
 */
export const WATER_ANALYSIS_PUBLIC_PAGE_SIZE = 10
export const WATER_ANALYSIS_BUREAU_PAGE_SIZE = 25

/** Longueur maximale du texte facultatif, apres `trim`. */
export const WATER_ANALYSIS_CONTENT_MAX_LENGTH = 500

/** Emplacements des deux fichiers dans la cle de stockage (ADR 026). */
export const WATER_ANALYSIS_POSTER_SLOT = 'poster'
export const WATER_ANALYSIS_REPORT_SLOT = 'report'

/**
 * Codes de refus d'une publication ou d'une correction. Un refus n'ecrit
 * **rien** : ni fichier, ni ligne.
 */
export const WaterAnalysisIssueConst = {
  FUTURE_DATE: 'future_date',
  CONTENT_TOO_LONG: 'content_too_long',
  POSTER_FORMAT: 'poster_format',
  POSTER_SIZE: 'poster_size',
  REPORT_FORMAT: 'report_format',
  REPORT_SIZE: 'report_size',
  MISSING_POSTER: 'missing_poster',
  MISSING_REPORT: 'missing_report',
} as const

export type WaterAnalysisIssue =
  (typeof WaterAnalysisIssueConst)[keyof typeof WaterAnalysisIssueConst]

export type WaterAnalysisRejectedResult = {
  status: 'rejected'
  issues: WaterAnalysisIssue[]
}

export type WaterAnalysisPublishResult =
  | {status: 'published'; analysis: WaterAnalysisDTO}
  | WaterAnalysisRejectedResult

export type WaterAnalysisSaveResult =
  {status: 'saved'; analysis: WaterAnalysisDTO} | WaterAnalysisRejectedResult

export type WaterAnalysisDeleteResult = {status: 'deleted'}

/**
 * Une cle n'appartient a une analyse que si elle vit sous
 * `{organisation}/water-analysis/{analyse}/` — donc sous une cle que le
 * serveur a lui-meme generee pour **cette** analyse.
 */
export const isWaterAnalysisFileKeyAllowed = (
  organizationId: string,
  analysisId: string,
  key: string
): boolean =>
  key.startsWith(
    `${organizationId}/${ContentFileScopeConst.WATER_ANALYSIS}/${analysisId}/`
  ) &&
  isContentFileKeyAllowed(organizationId, key, [
    ContentFileScopeConst.WATER_ANALYSIS,
  ])

/** Nombre de pages d'une liste ; une liste vide a quand meme sa page 1. */
export const countWaterAnalysisPages = (
  total: number,
  pageSize: number
): number => Math.max(1, Math.ceil(total / pageSize))

const KILOBYTE = 1024
const MEGABYTE = 1024 * 1024

const frenchNumber = (value: number, maximumFractionDigits: number): string =>
  new Intl.NumberFormat('fr-FR', {maximumFractionDigits}).format(value)

/**
 * Poids d'un fichier en clair (« 320 Ko », « 4,2 Mo ») : kilo-octets entiers
 * sous le mega-octet, une decimale au-dela. Fonction pure, sans horloge.
 */
export const formatFileWeight = (bytes: number): string => {
  if (bytes < KILOBYTE) return `${frenchNumber(bytes, 0)} octets`

  const kilobytes = Math.round(bytes / KILOBYTE)
  if (kilobytes < KILOBYTE) return `${frenchNumber(kilobytes, 0)} Ko`

  return `${frenchNumber(bytes / MEGABYTE, 1)} Mo`
}

/**
 * Nom propose au telechargement du PDF : il ne peut pas venir de la cle (un
 * UUID), il se construit donc sur la date.
 */
export const waterAnalysisDownloadName = (sampledOn: string): string =>
  `analyse-eau-${sampledOn}.pdf`

/**
 * Une date de prelevement ne peut pas etre future. Le jour courant est un
 * **argument** : l'appelant lit l'horloge, la fonction reste pure. Deux dates
 * ISO `YYYY-MM-DD` se comparent comme des chaines.
 */
export const isSampledOnInFuture = (
  sampledOn: string,
  today: string
): boolean => sampledOn > today

/**
 * Fuseau du jour calendaire d'une association, celui de la limitation de
 * debit (`rate-limit-service.ts`) : le produit ne sert que des associations
 * francaises (ADR 008).
 */
const CALENDAR_TIME_ZONE = 'Europe/Paris'

/**
 * Le jour calendaire (ISO `YYYY-MM-DD`) d'un instant, a Paris. L'instant est un
 * argument : c'est l'appelant qui lit l'horloge.
 */
export const calendarDayOf = (instant: Date): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: CALENDAR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
