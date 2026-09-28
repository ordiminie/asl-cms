import 'server-only'

import {WaterAnalysisModel} from '@/db/models/water-analysis-model'
import {
  countWaterAnalysesDao,
  createWaterAnalysisDao,
  deleteWaterAnalysisDao,
  getPublishedWaterAnalysisPageDao,
  getWaterAnalysisByIdDao,
  getWaterAnalysisPageByOrganizationDao,
  updateWaterAnalysisDao,
  WaterAnalysisPageRows,
} from '@/db/repositories/water-analysis-repository'
import {withTenant} from '@/db/tenant-scope'
import {logger} from '@/lib/logger'

import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {getContentFileStorage} from './content-file-service'
import {AuthorizationError} from './errors/authorization-error'
import {NotFoundError} from './errors/not-found-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  buildContentFileKey,
  ContentFileFormat,
  ContentFileKind,
  ContentFileScopeConst,
  validateContentFile,
} from './types/domain/content-file-types'
import {
  countWaterAnalysisPages,
  isSampledOnInFuture,
  WATER_ANALYSIS_BUREAU_PAGE_SIZE,
  WATER_ANALYSIS_CONTENT_MAX_LENGTH,
  WATER_ANALYSIS_POSTER_SLOT,
  WATER_ANALYSIS_PUBLIC_PAGE_SIZE,
  WATER_ANALYSIS_REPORT_SLOT,
  WaterAnalysisDeleteResult,
  WaterAnalysisDTO,
  WaterAnalysisIssue,
  WaterAnalysisIssueConst,
  WaterAnalysisListPageDTO,
  WaterAnalysisPublishResult,
  WaterAnalysisSaveResult,
} from './types/domain/water-analysis-types'
import {
  publishWaterAnalysisServiceSchema,
  updateWaterAnalysisServiceSchema,
  waterAnalysisListServiceSchema,
  waterAnalysisOrganizationIdSchema,
  waterAnalysisReferenceServiceSchema,
} from './validation/water-analysis-validation'

const MANAGE_DENIED =
  "Seul le bureau de l'association peut gérer les analyses d'eau"
const ANALYSIS_NOT_FOUND = "Analyse d'eau introuvable"

type FilesInput = {poster?: File | null; report?: File | null}

/** Un fichier accepte : ses octets, et le format lu dans sa signature. */
type CheckedFile = {file: File; format: ContentFileFormat; bytes: number}

type FileCheck =
  | {accepted: true; checked: CheckedFile}
  | {accepted: false; issue: WaterAnalysisIssue}

const toWaterAnalysisDto = (row: WaterAnalysisModel): WaterAnalysisDTO => ({
  id: row.id,
  organizationId: row.organizationId,
  sampledOn: row.sampledOn,
  posterKey: row.posterKey,
  reportKey: row.reportKey,
  reportBytes: row.reportBytes,
  content: row.content,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

const toListPageDto = (
  result: WaterAnalysisPageRows,
  page: number,
  pageSize: number
): WaterAnalysisListPageDTO => ({
  items: result.rows.map((row) => toWaterAnalysisDto(row)),
  page,
  pageSize,
  total: result.total,
  totalPages: countWaterAnalysisPages(result.total, pageSize),
})

const requireWaterAnalysisManager = async (
  organizationId: string
): Promise<void> => {
  const authUser = await getAuthUser()
  if (
    !canPerformAction(
      authUser,
      organizationId,
      ActionIdConst.WATER_ANALYSIS_MANAGE
    )
  ) {
    throw new AuthorizationError(MANAGE_DENIED)
  }
}

const requireWaterAnalysis = async (
  organizationId: string,
  analysisId: string
): Promise<WaterAnalysisModel> => {
  const row = await withTenant(organizationId, () =>
    getWaterAnalysisByIdDao(analysisId)
  )
  if (!row) {
    throw new NotFoundError(ANALYSIS_NOT_FOUND)
  }
  return row
}

const hasFile = (file: File | null | undefined): file is File =>
  file instanceof File && file.size > 0

/** Valide un fichier par **signature binaire**, sans rien ecrire. */
const checkFile = async (
  file: File,
  kind: ContentFileKind,
  issues: {format: WaterAnalysisIssue; size: WaterAnalysisIssue}
): Promise<FileCheck> => {
  const content = new Uint8Array(await file.arrayBuffer())
  const validation = validateContentFile(kind, content)
  if (validation.valid) {
    return {
      accepted: true,
      checked: {file, format: validation.format, bytes: content.length},
    }
  }
  return {
    accepted: false,
    issue: validation.reason === 'size' ? issues.size : issues.format,
  }
}

const checkPoster = (file: File) =>
  checkFile(file, 'image', {
    format: WaterAnalysisIssueConst.POSTER_FORMAT,
    size: WaterAnalysisIssueConst.POSTER_SIZE,
  })

const checkReport = (file: File) =>
  checkFile(file, 'document', {
    format: WaterAnalysisIssueConst.REPORT_FORMAT,
    size: WaterAnalysisIssueConst.REPORT_SIZE,
  })

/**
 * Tous les controles d'une soumission, **avant toute ecriture** : date,
 * longueur du texte, puis chaque fichier present. Les refus sont cumules pour
 * que le bureau les corrige en une fois. `required` exige les deux fichiers
 * (publication) ; a la correction, un fichier absent garde celui en place.
 */
const checkSubmission = async (input: {
  sampledOn: string
  today: string
  content: string
  files: FilesInput
  required: boolean
}): Promise<{
  issues: WaterAnalysisIssue[]
  poster?: CheckedFile
  report?: CheckedFile
}> => {
  const issues: WaterAnalysisIssue[] = []

  if (isSampledOnInFuture(input.sampledOn, input.today)) {
    issues.push(WaterAnalysisIssueConst.FUTURE_DATE)
  }
  if (input.content.length > WATER_ANALYSIS_CONTENT_MAX_LENGTH) {
    issues.push(WaterAnalysisIssueConst.CONTENT_TOO_LONG)
  }

  const poster = hasFile(input.files.poster)
    ? await checkPoster(input.files.poster)
    : undefined
  const report = hasFile(input.files.report)
    ? await checkReport(input.files.report)
    : undefined

  if (poster && !poster.accepted) issues.push(poster.issue)
  if (!poster && input.required) {
    issues.push(WaterAnalysisIssueConst.MISSING_POSTER)
  }
  if (report && !report.accepted) issues.push(report.issue)
  if (!report && input.required) {
    issues.push(WaterAnalysisIssueConst.MISSING_REPORT)
  }

  return {
    issues,
    poster: poster?.accepted ? poster.checked : undefined,
    report: report?.accepted ? report.checked : undefined,
  }
}

/**
 * Un echec d'effacement laisse un fichier orphelin, jamais une operation en
 * echec : la ligne est deja juste en base. Seul precedent :
 * `association-identity-service.ts`.
 */
const deleteFilesQuietly = async (keys: string[]): Promise<void> => {
  for (const key of keys) {
    try {
      await getContentFileStorage().delete(key)
    } catch (error) {
      logger.warn('[WATER-ANALYSIS] Fichier laisse orphelin', {
        key,
        error: (error as Error).message,
      })
    }
  }
}

/**
 * Ecrit les fichiers acceptes sous des cles generees par le serveur, dans
 * l'ordre affiche puis PDF. Si une ecriture echoue, les fichiers deja ecrits
 * sont effaces avant de propager l'erreur.
 */
const storeFiles = async (
  organizationId: string,
  analysisId: string,
  files: {poster?: CheckedFile; report?: CheckedFile}
): Promise<{posterKey?: string; reportKey?: string}> => {
  const written: string[] = []
  const store = async (slot: string, checked: CheckedFile) => {
    const key = buildContentFileKey(
      organizationId,
      ContentFileScopeConst.WATER_ANALYSIS,
      analysisId,
      slot,
      checked.format
    )
    await getContentFileStorage().upload(checked.file, key)
    written.push(key)
    return key
  }

  try {
    const posterKey = files.poster
      ? await store(WATER_ANALYSIS_POSTER_SLOT, files.poster)
      : undefined
    const reportKey = files.report
      ? await store(WATER_ANALYSIS_REPORT_SLOT, files.report)
      : undefined
    return {posterKey, reportKey}
  } catch (error) {
    await deleteFilesQuietly(written)
    throw error
  }
}

/**
 * Publie une analyse en **une seule operation** (critere 4, ADR 026).
 *
 * Ordre : `safeParse` -> controle d'acces -> date, texte et les deux fichiers
 * par signature binaire, **avant toute ecriture** -> identifiant genere par le
 * serveur -> ecriture de l'affiche -> ecriture du PDF -> insertion. Si
 * l'insertion echoue, les deux fichiers tout juste ecrits sont effaces et
 * l'erreur est propagee : une ligne ne pointe jamais vers un fichier absent.
 *
 * Le jour courant (`today`) est fourni par l'appelant : le service ne lit pas
 * l'horloge.
 */
export const publishWaterAnalysisService = async (
  input: {
    organizationId: string
    sampledOn: string
    content: string
    today: string
  } & FilesInput
): Promise<WaterAnalysisPublishResult> => {
  const parsed = publishWaterAnalysisServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, sampledOn, content, today} = parsed.data
  await requireWaterAnalysisManager(organizationId)

  const checked = await checkSubmission({
    sampledOn,
    today,
    content,
    files: input,
    required: true,
  })
  if (checked.issues.length > 0 || !checked.poster || !checked.report) {
    return {status: 'rejected', issues: checked.issues}
  }

  const analysisId = crypto.randomUUID()
  const {posterKey, reportKey} = await storeFiles(organizationId, analysisId, {
    poster: checked.poster,
    report: checked.report,
  })
  const keys = [posterKey, reportKey].filter((key): key is string =>
    Boolean(key)
  )

  try {
    const created = await withTenant(organizationId, () =>
      createWaterAnalysisDao({
        id: analysisId,
        organizationId,
        sampledOn,
        posterKey: posterKey as string,
        reportKey: reportKey as string,
        reportBytes: checked.report?.bytes ?? 0,
        content,
      })
    )
    return {status: 'published', analysis: toWaterAnalysisDto(created)}
  } catch (error) {
    await deleteFilesQuietly(keys)
    throw error
  }
}

/**
 * Corrige une analyse publiee. Memes controles qu'a la publication ; un
 * fichier absent de la soumission laisse sa cle en place.
 *
 * Un fichier remplace disparait **apres** l'enregistrement, jamais avant :
 * nouvelle cle ecrite -> ligne mise a jour -> ancien fichier efface. Si la
 * mise a jour echoue, les fichiers tout juste ecrits sont effaces.
 */
export const updateWaterAnalysisService = async (
  input: {
    organizationId: string
    analysisId: string
    sampledOn: string
    content: string
    today: string
  } & FilesInput
): Promise<WaterAnalysisSaveResult> => {
  const parsed = updateWaterAnalysisServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, analysisId, sampledOn, content, today} = parsed.data
  await requireWaterAnalysisManager(organizationId)

  const checked = await checkSubmission({
    sampledOn,
    today,
    content,
    files: input,
    required: false,
  })
  if (checked.issues.length > 0) {
    return {status: 'rejected', issues: checked.issues}
  }

  const current = await requireWaterAnalysis(organizationId, analysisId)
  const written = await storeFiles(organizationId, analysisId, checked)
  const newKeys = [written.posterKey, written.reportKey].filter(
    (key): key is string => Boolean(key)
  )

  let saved: WaterAnalysisModel
  try {
    saved = await withTenant(organizationId, () =>
      updateWaterAnalysisDao(analysisId, {
        sampledOn,
        posterKey: written.posterKey ?? current.posterKey,
        reportKey: written.reportKey ?? current.reportKey,
        reportBytes: checked.report?.bytes ?? current.reportBytes,
        content,
      })
    )
  } catch (error) {
    await deleteFilesQuietly(newKeys)
    throw error
  }

  await deleteFilesQuietly([
    ...(written.posterKey ? [current.posterKey] : []),
    ...(written.reportKey ? [current.reportKey] : []),
  ])

  return {status: 'saved', analysis: toWaterAnalysisDto(saved)}
}

/**
 * Supprime une analyse, definitivement : la ligne d'abord, les deux fichiers
 * ensuite — dans cet ordre, un echec ne laisse qu'un fichier orphelin, jamais
 * une ligne sans fichier.
 */
export const deleteWaterAnalysisService = async (input: {
  organizationId: string
  analysisId: string
}): Promise<WaterAnalysisDeleteResult> => {
  const parsed = waterAnalysisReferenceServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, analysisId} = parsed.data
  await requireWaterAnalysisManager(organizationId)

  const removed = await withTenant(organizationId, () =>
    deleteWaterAnalysisDao(analysisId)
  )
  if (!removed) {
    throw new NotFoundError(ANALYSIS_NOT_FOUND)
  }

  await deleteFilesQuietly([removed.posterKey, removed.reportKey])

  return {status: 'deleted'}
}

/** Liste de gestion du bureau, paginee. */
export const getWaterAnalysesForBureauService = async (
  organizationId: string,
  page: number
): Promise<WaterAnalysisListPageDTO> => {
  const parsed = waterAnalysisListServiceSchema.safeParse({
    organizationId,
    page,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireWaterAnalysisManager(parsed.data.organizationId)

  const result = await withTenant(parsed.data.organizationId, () =>
    getWaterAnalysisPageByOrganizationDao({
      organizationId: parsed.data.organizationId,
      limit: WATER_ANALYSIS_BUREAU_PAGE_SIZE,
      offset: (parsed.data.page - 1) * WATER_ANALYSIS_BUREAU_PAGE_SIZE,
    })
  )

  return toListPageDto(
    result,
    parsed.data.page,
    WATER_ANALYSIS_BUREAU_PAGE_SIZE
  )
}

/** Une analyse du bureau, pour l'ecran de correction. */
export const getWaterAnalysisForBureauService = async (
  organizationId: string,
  analysisId: string
): Promise<WaterAnalysisDTO> => {
  const parsed = waterAnalysisReferenceServiceSchema.safeParse({
    organizationId,
    analysisId,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireWaterAnalysisManager(parsed.data.organizationId)

  return toWaterAnalysisDto(
    await requireWaterAnalysis(
      parsed.data.organizationId,
      parsed.data.analysisId
    )
  )
}

/**
 * Liste publique paginee.
 *
 * **Sans controle d'autorisation, et c'est delibere** : une analyse d'eau
 * publiee s'adresse a tout visiteur, sans compte (critere 2).
 */
export const getPublicWaterAnalysesPageService = async (
  organizationId: string,
  page: number
): Promise<WaterAnalysisListPageDTO> => {
  const parsed = waterAnalysisListServiceSchema.safeParse({
    organizationId,
    page,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const result = await withTenant(parsed.data.organizationId, () =>
    getPublishedWaterAnalysisPageDao({
      organizationId: parsed.data.organizationId,
      limit: WATER_ANALYSIS_PUBLIC_PAGE_SIZE,
      offset: (parsed.data.page - 1) * WATER_ANALYSIS_PUBLIC_PAGE_SIZE,
    })
  )

  return toListPageDto(
    result,
    parsed.data.page,
    WATER_ANALYSIS_PUBLIC_PAGE_SIZE
  )
}

/**
 * Nombre de pages de la liste publique. Une liste vide en compte **une** : sa
 * page 1 affiche l'etat vide, elle n'est pas introuvable. Il borne le numero
 * demande **avant** la lecture cachee par page (patron `news`).
 *
 * **Sans controle d'autorisation, et c'est delibere**, comme la liste
 * elle-meme.
 */
export const getPublicWaterAnalysisPageCountService = async (
  organizationId: string
): Promise<number> => {
  const parsed = waterAnalysisOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const total = await withTenant(parsed.data, () =>
    countWaterAnalysesDao(parsed.data)
  )

  return countWaterAnalysisPages(total, WATER_ANALYSIS_PUBLIC_PAGE_SIZE)
}

/**
 * L'utilisateur connecte peut-il gerer les analyses d'eau de cette
 * association ? Sert l'interface ; chaque mutation reverifie.
 */
export const canManageWaterAnalysisService = async (
  organizationId: string
): Promise<boolean> => {
  const parsed = waterAnalysisOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) return false

  const authUser = await getAuthUser()
  return canPerformAction(
    authUser,
    parsed.data,
    ActionIdConst.WATER_ANALYSIS_MANAGE
  )
}
