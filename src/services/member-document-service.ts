import 'server-only'

import {listActiveCategoriesDao} from '@/db/repositories/association-category-repository'
import {
  BureauMemberDocumentRow,
  countMemberDocumentsByCategoryDao,
  countMemberProfilesWithoutReferenceDao,
  createMemberDocumentDao,
  deleteMemberDocumentDao,
  getMemberDocumentByIdDao,
  getMemberProfileIdsByPennylaneReferenceDao,
  listMemberDocumentsByProfileDao,
  listMemberDocumentsByProfilesDao,
  listMemberDocumentsForBureauDao,
  MemberDocumentRow,
} from '@/db/repositories/member-document-repository'
import {
  countMemberProfilesDao,
  getCurrentParcelNumbersByProfileDao,
  getMemberProfileByIdDao,
} from '@/db/repositories/member-profile-repository'
import {listOwnershipPeriodsByProfilesDao} from '@/db/repositories/parcel-ownership-repository'
import {withTenant} from '@/db/tenant-scope'
import {createStorage} from '@/lib/files/storage/storage-factory'
import {StorageOperations} from '@/lib/files/storage/types'
import {logger} from '@/lib/logger'

import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {NotFoundError} from './errors/not-found-error'
import {UnauthenticatedError} from './errors/unauthenticated-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {getMyMemberProfiles} from './member-account-service'
import {referenceOfBatchFileName} from './rules/member-document-batch-rules'
import {
  OwnershipPeriod,
  parcelsOwnedOn,
} from './rules/pennylane-invoice-mapping'
import {ActionIdConst} from './types/domain/action-registry-types'
import {CategoryDomainConst} from './types/domain/association-category-types'
import {
  CONTENT_FILE_CONTENT_TYPES,
  CONTENT_FILE_MAX_BYTES,
  validateContentFile,
} from './types/domain/content-file-types'
import {
  buildMemberDocumentFileKey,
  BureauMemberDocumentDTO,
  BureauMemberDocumentPageDTO,
  isMemberDocumentKeyOf,
  MEMBER_DOCUMENT_PAGE_SIZE,
  MEMBER_DOCUMENT_TITLE_MAX_LENGTH,
  MemberDocumentBatchLineResult,
  MemberDocumentBatchReachDTO,
  MemberDocumentBatchRejection,
  MemberDocumentBatchRejectionConst,
  MemberDocumentDepositResult,
  memberDocumentFolderOf,
  MemberDocumentIssue,
  MemberDocumentIssueConst,
  MemberDocumentRemoveResult,
  MyMemberDocumentDTO,
} from './types/domain/member-document-types'
import {calendarDayOf} from './types/domain/water-analysis-types'
import {
  bureauMemberDocumentsServiceSchema,
  depositMemberDocumentBatchLineServiceSchema,
  depositMemberDocumentServiceSchema,
  memberDocumentDateSchema,
  memberDocumentOrganizationIdSchema,
  memberDocumentReferenceServiceSchema,
  memberDocumentsOfProfileServiceSchema,
} from './validation/member-document-validation'

const MANAGE_DENIED =
  "Seul le bureau de l'association peut gérer les documents nominatifs"
const DOCUMENT_NOT_FOUND = 'Document introuvable'
const PROFILE_NOT_FOUND = 'Fiche introuvable'
const READ_UNAUTHENTICATED = 'Connectez-vous pour voir vos documents'

/** Le fichier d'un document, et le titre qui nomme son telechargement. */
export type MemberDocumentFile = {content: Blob; title: string}

type CheckedFile = {file: File; bytes: number}

/** Les champs communs d'un depot, deja passes par `safeParse`. */
type DepositFields = {
  organizationId: string
  title: string
  categoryId: string
  documentDate: string
}

/** La fiche visee par un depot, lue sous le tenant. */
type TargetProfile = {id: string; name: string}

/**
 * Le stockage **ouvert sur le dossier d'une fiche** (ADR 073 §3) : son
 * `basePath` est `{org}/member-documents/{profileId}` et il ne recoit que le
 * nom du fichier. L'adaptateur refuse donc, a lui seul, toute cle qui
 * sortirait du dossier de cette fiche.
 */
const getMemberDocumentStorage = (
  organizationId: string,
  memberProfileId: string
): StorageOperations =>
  createStorage('local', {
    bucket: 'member-documents',
    basePath: memberDocumentFolderOf(organizationId, memberProfileId),
    maxFileSize: CONTENT_FILE_MAX_BYTES.document,
    allowedMimeTypes: [CONTENT_FILE_CONTENT_TYPES.pdf],
  })

/**
 * Le nom du fichier dans le dossier de sa fiche, ou rien si la cle lue en
 * base n'est pas coherente avec la fiche de la ligne (ADR 073 §4.3).
 */
const fileNameInProfileFolder = (
  fileKey: string,
  organizationId: string,
  memberProfileId: string
): string | undefined =>
  isMemberDocumentKeyOf(fileKey, organizationId, memberProfileId)
    ? fileKey.slice(
        memberDocumentFolderOf(organizationId, memberProfileId).length + 1
      )
    : undefined

/** Une cle incoherente : refus journalise, sans nom de membre. */
const logIncoherentKey = (documentId: string, operation: string): void => {
  logger.warn('[MEMBER-DOCUMENT] Clé incohérente avec la fiche, refusée', {
    documentId,
    operation,
  })
}

const toBureauDto = (
  row: MemberDocumentRow,
  memberProfileName: string
): BureauMemberDocumentDTO => ({
  id: row.id,
  title: row.title,
  categoryId: row.categoryId,
  categoryName: row.categoryName,
  documentDate: row.documentDate,
  fileBytes: row.fileBytes,
  createdAt: row.createdAt,
  memberProfileId: row.memberProfileId,
  memberProfileName,
})

const requireManager = async (organizationId: string): Promise<void> => {
  const authUser = await getAuthUser()
  if (
    !canPerformAction(
      authUser,
      organizationId,
      ActionIdConst.MEMBER_DOCUMENT_MANAGE
    )
  ) {
    throw new AuthorizationError(MANAGE_DENIED)
  }
}

const hasFile = (file: File | null | undefined): file is File =>
  file instanceof File && file.size > 0

const checkTitle = (title: string): MemberDocumentIssue[] => {
  if (title === '') return [MemberDocumentIssueConst.TITLE_MISSING]
  if (title.length > MEMBER_DOCUMENT_TITLE_MAX_LENGTH) {
    return [MemberDocumentIssueConst.TITLE_TOO_LONG]
  }
  return []
}

/** Sans date saisie : le jour du depot (ADR 073 §1). */
const checkDate = (
  documentDate: string
): {issues: MemberDocumentIssue[]; date?: string} => {
  if (documentDate === '') return {issues: [], date: calendarDayOf(new Date())}
  return memberDocumentDateSchema.safeParse(documentDate).success
    ? {issues: [], date: documentDate}
    : {issues: [MemberDocumentIssueConst.DATE_INVALID]}
}

/**
 * La categorie choisie, **active et du domaine `member_document`**, lue dans
 * le scope du tenant : un identifiant supprime, d'un autre domaine ou d'une
 * autre association n'y est pas visible, donc refuse.
 */
const checkCategory = async (
  organizationId: string,
  categoryId: string
): Promise<{issues: MemberDocumentIssue[]; name?: string}> => {
  if (categoryId === '') {
    return {issues: [MemberDocumentIssueConst.CATEGORY_MISSING]}
  }

  const offered = await withTenant(organizationId, () =>
    listActiveCategoriesDao(organizationId, CategoryDomainConst.MEMBER_DOCUMENT)
  )
  const category = offered.find((candidate) => candidate.id === categoryId)
  return category
    ? {issues: [], name: category.name}
    : {issues: [MemberDocumentIssueConst.CATEGORY_UNAVAILABLE]}
}

/** Valide le fichier par **signature binaire** (PDF, 10 Mo), sans rien ecrire. */
const checkFile = async (
  file: File | null | undefined
): Promise<{issues: MemberDocumentIssue[]; checked?: CheckedFile}> => {
  if (!hasFile(file)) return {issues: [MemberDocumentIssueConst.FILE_MISSING]}

  const content = new Uint8Array(await file.arrayBuffer())
  const validation = validateContentFile('document', content)
  if (validation.valid) {
    return {issues: [], checked: {file, bytes: content.length}}
  }
  return {
    issues: [
      validation.reason === 'size'
        ? MemberDocumentIssueConst.FILE_SIZE
        : MemberDocumentIssueConst.FILE_FORMAT,
    ],
  }
}

/**
 * Un echec d'effacement laisse un fichier orphelin, jamais une operation en
 * echec : la ligne est deja juste en base.
 */
const deleteFileQuietly = async (
  storage: StorageOperations,
  fileName: string,
  documentId: string
): Promise<void> => {
  try {
    await storage.delete(fileName)
  } catch (error) {
    logger.warn('[MEMBER-DOCUMENT] Fichier laissé orphelin', {
      documentId,
      error: (error as Error).message,
    })
  }
}

/** La fiche visee, lue **sous le tenant** : celle d'une autre association n'existe pas. */
const readTargetProfile = async (
  organizationId: string,
  memberProfileId: string
): Promise<TargetProfile> => {
  const profile = await withTenant(organizationId, () =>
    getMemberProfileByIdDao(memberProfileId)
  )
  if (!profile) {
    throw new NotFoundError(PROFILE_NOT_FOUND)
  }
  return {id: profile.id, name: profile.name}
}

/**
 * Le chemin d'ecriture commun au depot unitaire et au lot : controles avant
 * toute ecriture, puis fichier dans le dossier de la fiche, puis ligne. Si
 * l'insertion echoue, le fichier tout juste ecrit est efface et l'erreur
 * propagee : une ligne ne pointe jamais vers un fichier absent.
 */
const depositIntoProfile = async (
  fields: DepositFields,
  profile: TargetProfile,
  file: File | null | undefined
): Promise<MemberDocumentDepositResult> => {
  const {organizationId, title, categoryId} = fields

  const category = await checkCategory(organizationId, categoryId)
  const date = checkDate(fields.documentDate)
  const checkedFile = await checkFile(file)
  const issues = [
    ...checkTitle(title),
    ...category.issues,
    ...date.issues,
    ...checkedFile.issues,
  ]
  if (issues.length > 0 || !checkedFile.checked || !date.date) {
    return {status: 'rejected', issues}
  }

  const documentId = crypto.randomUUID()
  const fileKey = buildMemberDocumentFileKey(
    organizationId,
    profile.id,
    documentId
  )
  const fileName = fileKey.slice(
    memberDocumentFolderOf(organizationId, profile.id).length + 1
  )
  const storage = getMemberDocumentStorage(organizationId, profile.id)
  await storage.upload(checkedFile.checked.file, fileName)

  try {
    const created = await withTenant(organizationId, () =>
      createMemberDocumentDao({
        id: documentId,
        organizationId,
        memberProfileId: profile.id,
        title,
        categoryId,
        documentDate: date.date ?? '',
        fileKey,
        fileBytes: checkedFile.checked?.bytes ?? 0,
      })
    )
    return {
      status: 'deposited',
      document: toBureauDto(
        {...created, categoryName: category.name ?? ''},
        profile.name
      ),
    }
  } catch (error) {
    await deleteFileQuietly(storage, fileName, documentId)
    throw error
  }
}

/**
 * Depose un document nominatif pour une fiche (critere 1, ADR 073).
 * Appelable par un service (s36, s57), pas seulement par un formulaire.
 *
 * Ordre : `safeParse` -> `member.document.manage` -> fiche lue sous le
 * tenant -> titre, categorie active du domaine `member_document`, date et PDF
 * par signature binaire, **avant toute ecriture** -> fichier puis ligne.
 */
export const depositMemberDocumentService = async (input: {
  organizationId: string
  memberProfileId: string
  title: string
  categoryId: string
  documentDate?: string
  file?: File | null
}): Promise<MemberDocumentDepositResult> => {
  const parsed = depositMemberDocumentServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {memberProfileId, ...fields} = parsed.data
  await requireManager(fields.organizationId)

  const profile = await readTargetProfile(
    fields.organizationId,
    memberProfileId
  )
  return depositIntoProfile(fields, profile, input.file)
}

/**
 * Retire un document, definitivement : la ligne d'abord, le fichier ensuite,
 * dans le dossier de **sa** fiche — un echec disque ne laisse qu'un orphelin
 * journalise. Une cle incoherente avec la fiche n'efface rien.
 */
export const removeMemberDocumentService = async (input: {
  organizationId: string
  documentId: string
}): Promise<MemberDocumentRemoveResult> => {
  const parsed = memberDocumentReferenceServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, documentId} = parsed.data
  await requireManager(organizationId)

  const removed = await withTenant(organizationId, () =>
    deleteMemberDocumentDao(documentId)
  )
  if (!removed) {
    throw new NotFoundError(DOCUMENT_NOT_FOUND)
  }

  const fileName = fileNameInProfileFolder(
    removed.fileKey,
    organizationId,
    removed.memberProfileId
  )
  if (fileName) {
    await deleteFileQuietly(
      getMemberDocumentStorage(organizationId, removed.memberProfileId),
      fileName,
      documentId
    )
  } else {
    logIncoherentKey(documentId, 'remove')
  }

  return {
    status: 'removed',
    title: removed.title,
    memberProfileId: removed.memberProfileId,
  }
}

/** Les documents d'une fiche, pour sa section du back-office. */
export const getMemberDocumentsOfProfileForBureauService = async (
  organizationId: string,
  memberProfileId: string
): Promise<BureauMemberDocumentDTO[]> => {
  const parsed = memberDocumentsOfProfileServiceSchema.safeParse({
    organizationId,
    memberProfileId,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireManager(parsed.data.organizationId)

  const profile = await readTargetProfile(
    parsed.data.organizationId,
    parsed.data.memberProfileId
  )
  const rows = await withTenant(parsed.data.organizationId, () =>
    listMemberDocumentsByProfileDao(profile.id)
  )
  return rows.map((row) => toBureauDto(row, profile.name))
}

/**
 * Tous les documents nominatifs de l'association (critere 6), filtres et
 * pagines cote serveur, avec le decompte par categorie du filtre.
 */
export const getMemberDocumentsForBureauService = async (input: {
  organizationId: string
  search?: string
  categoryId?: string
  page?: number
}): Promise<BureauMemberDocumentPageDTO> => {
  const parsed = bureauMemberDocumentsServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, search, categoryId, page} = parsed.data
  await requireManager(organizationId)

  const {rows, total, countsByCategory, parcelNumbersByProfile} =
    await withTenant(organizationId, async () => {
      const found = await listMemberDocumentsForBureauDao(organizationId, {
        search,
        categoryId,
        page,
        pageSize: MEMBER_DOCUMENT_PAGE_SIZE,
      })
      const profileIds = [
        ...new Set(found.rows.map((row) => row.memberProfileId)),
      ]
      return {
        ...found,
        countsByCategory:
          await countMemberDocumentsByCategoryDao(organizationId),
        parcelNumbersByProfile:
          profileIds.length > 0
            ? await getCurrentParcelNumbersByProfileDao(profileIds)
            : {},
      }
    })

  return {
    documents: rows.map((row: BureauMemberDocumentRow) =>
      toBureauDto(row, row.memberProfileName)
    ),
    total,
    page,
    pageSize: MEMBER_DOCUMENT_PAGE_SIZE,
    countsByCategory,
    parcelNumbersByProfile,
  }
}

/**
 * L'utilisateur connecte peut-il gerer les documents nominatifs de cette
 * association ? Sert l'interface ; chaque mutation reverifie.
 */
export const canManageMemberDocumentsService = async (
  organizationId: string
): Promise<boolean> => {
  const parsed = memberDocumentOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) return false

  const authUser = await getAuthUser()
  return canPerformAction(
    authUser,
    parsed.data,
    ActionIdConst.MEMBER_DOCUMENT_MANAGE
  )
}

/** Le terrain d'un document : les parcelles de sa fiche a sa date. */
const terrainOfDocument = (
  row: MemberDocumentRow,
  periods: readonly OwnershipPeriod[]
): {parcelNumbers: string[]; meterNumber: string | null} => {
  const parcels = parcelsOwnedOn(periods, row.memberProfileId, row.documentDate)
  return {
    parcelNumbers: parcels.map(({number}) => number),
    meterNumber:
      parcels.find(({meterNumber}) => meterNumber)?.meterNumber ?? null,
  }
}

/**
 * « Mes documents » du compte connecte (criteres 1, 3 et 5) : les documents
 * de **toutes** les fiches reliees au compte, et d'elles seules, chacun avec
 * le terrain de sa fiche a la date du document, date decroissante. La
 * lecture suit la **possession** (ADR 073 §6) : aucune action du registre.
 * Un compte sans fiche n'a pas de dossier : rien.
 */
export const getMyMemberDocumentsService = async (
  organizationId: string
): Promise<MyMemberDocumentDTO[]> => {
  const parsed = memberDocumentOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const authUser = await getAuthUser()
  if (!authUser) {
    throw new AuthorizationError(READ_UNAUTHENTICATED)
  }

  return withTenant(parsed.data, async () => {
    const profiles = await getMyMemberProfiles(parsed.data, authUser.id)
    if (profiles.length === 0) return []

    const profileIds = profiles.map((profile) => profile.id)
    const rows = await listMemberDocumentsByProfilesDao(profileIds)
    const periods =
      rows.length > 0 ? await listOwnershipPeriodsByProfilesDao(profileIds) : []
    const names = new Map(profiles.map(({id, name}) => [id, name]))

    return rows
      .toSorted((a, b) => b.documentDate.localeCompare(a.documentDate))
      .map((row) => {
        const name = names.get(row.memberProfileId)
        return {
          id: row.id,
          title: row.title,
          categoryName: row.categoryName,
          documentDate: row.documentDate,
          fileBytes: row.fileBytes,
          ...terrainOfDocument(row, periods),
          holderName: name && name !== authUser.name ? name : null,
        }
      })
  })
}

/**
 * Le fichier d'un document, pour la route `GET /api/member-documents/[id]`.
 * Trois controles **independants**, chacun suffisant a refuser (ADR 073 §4) :
 *
 * 1. la ligne est relue sous le tenant du domaine (RLS) ;
 * 2. possession : la fiche de la ligne est l'une des fiches du compte, ou
 *    l'utilisateur a `member.document.manage` dans cette association ;
 * 3. coherence cle ↔ fiche : la cle lue en base vit dans le dossier de
 *    **cette** fiche, et le stockage est ouvert sur ce dossier.
 *
 * Sans session : `UnauthenticatedError` (401), avant meme de valider
 * l'identifiant. Tout autre refus :
 * `NotFoundError` (404) — un membre n'apprend pas qu'un document existe.
 */
export const readMemberDocumentFileService = async (
  organizationId: string,
  documentId: string
): Promise<MemberDocumentFile> => {
  const authUser = await getAuthUser()
  if (!authUser) {
    throw new UnauthenticatedError()
  }

  const parsed = memberDocumentReferenceServiceSchema.safeParse({
    organizationId,
    documentId,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const orgId = parsed.data.organizationId
  const row = await withTenant(orgId, async () => {
    const found = await getMemberDocumentByIdDao(parsed.data.documentId)
    if (!found) return undefined
    if (
      canPerformAction(authUser, orgId, ActionIdConst.MEMBER_DOCUMENT_MANAGE)
    ) {
      return found
    }
    const profiles = await getMyMemberProfiles(orgId, authUser.id)
    return profiles.some((profile) => profile.id === found.memberProfileId)
      ? found
      : undefined
  })
  if (!row) {
    throw new NotFoundError(DOCUMENT_NOT_FOUND)
  }

  const fileName = fileNameInProfileFolder(
    row.fileKey,
    orgId,
    row.memberProfileId
  )
  if (!fileName) {
    logIncoherentKey(row.id, 'read')
    throw new NotFoundError(DOCUMENT_NOT_FOUND)
  }

  return {
    content: await getMemberDocumentStorage(
      orgId,
      row.memberProfileId
    ).download(fileName),
    title: row.title,
  }
}

/** La raison d'ecarter une ligne dont le depot a ete refuse. */
const batchRejectionOf = (
  issues: readonly MemberDocumentIssue[]
): MemberDocumentBatchRejection => {
  if (issues.includes(MemberDocumentIssueConst.FILE_SIZE)) {
    return MemberDocumentBatchRejectionConst.TOO_LARGE
  }
  if (
    issues.includes(MemberDocumentIssueConst.FILE_FORMAT) ||
    issues.includes(MemberDocumentIssueConst.FILE_MISSING)
  ) {
    return MemberDocumentBatchRejectionConst.INVALID_FILE
  }
  return MemberDocumentBatchRejectionConst.INVALID_INPUT
}

/**
 * Une ligne d'un depot en lot (critere 7, ADR 073 §8) : **un fichier par
 * appel**. La fiche se trouve par la reference client Pennylane qui ouvre le
 * nom du fichier, comparee exactement sous le tenant ; puis le meme chemin
 * que le depot unitaire. Sans reference, sans correspondance, fichier ou
 * champs refuses : la ligne est ecartee avec sa raison, **jamais rattachee a
 * une fiche par defaut**. Rien n'est journalise (ADR 047).
 */
export const depositMemberDocumentBatchLineService = async (input: {
  organizationId: string
  fileName: string
  title: string
  categoryId: string
  documentDate?: string
  file?: File | null
}): Promise<MemberDocumentBatchLineResult> => {
  const parsed = depositMemberDocumentBatchLineServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {fileName, ...fields} = parsed.data
  await requireManager(fields.organizationId)

  const reference = referenceOfBatchFileName(fileName)
  if (!reference) {
    return {
      status: 'rejected',
      fileName,
      reason: MemberDocumentBatchRejectionConst.NO_REFERENCE_IN_NAME,
    }
  }

  const memberProfileIds = await withTenant(fields.organizationId, () =>
    getMemberProfileIdsByPennylaneReferenceDao(fields.organizationId, reference)
  )
  if (memberProfileIds.length !== 1) {
    return {
      status: 'rejected',
      fileName,
      reason:
        memberProfileIds.length === 0
          ? MemberDocumentBatchRejectionConst.UNKNOWN_REFERENCE
          : MemberDocumentBatchRejectionConst.AMBIGUOUS_REFERENCE,
      reference,
    }
  }

  const profile = await readTargetProfile(
    fields.organizationId,
    memberProfileIds[0]
  )
  const deposit = await depositIntoProfile(fields, profile, input.file)
  if (deposit.status === 'rejected') {
    return {
      status: 'rejected',
      fileName,
      reason: batchRejectionOf(deposit.issues),
    }
  }

  const periods = await withTenant(fields.organizationId, () =>
    listOwnershipPeriodsByProfilesDao([profile.id])
  )
  const parcels = parcelsOwnedOn(
    periods,
    profile.id,
    deposit.document.documentDate
  )
  return {
    status: 'deposited',
    fileName,
    memberProfileId: profile.id,
    memberProfileName: profile.name,
    parcelNumbers: parcels.map(({number}) => number),
    meterNumber:
      parcels.find(({meterNumber}) => meterNumber)?.meterNumber ?? null,
  }
}

/**
 * Combien de fiches un lot peut atteindre (design s32, 5d et 5e) : celles qui
 * portent un identifiant client Pennylane, et celles qui n'en portent pas.
 */
export const getMemberDocumentBatchReachService = async (
  organizationId: string
): Promise<MemberDocumentBatchReachDTO> => {
  const parsed = memberDocumentOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireManager(parsed.data)

  return withTenant(parsed.data, async () => {
    const withoutReference = await countMemberProfilesWithoutReferenceDao(
      parsed.data
    )
    const {total} = await countMemberProfilesDao(parsed.data)
    return {
      profilesWithReference: Math.max(total - withoutReference, 0),
      profilesWithoutReference: withoutReference,
    }
  })
}
