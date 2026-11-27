import 'server-only'

import {getMemberProfileEmailsDao} from '@/db/repositories/member-profile-email-repository'
import {
  getLinkedAccountsDao,
  getMemberProfileByIdDao,
  LinkedAccountRow,
  listMemberProfilesByPennylaneIdIgnoringCaseDao,
  MemberProfileReadRow,
  setMemberProfileImportSnapshotDao,
} from '@/db/repositories/member-profile-repository'
import {withTenant} from '@/db/tenant-scope'
import {readCsv} from '@/lib/import/csv-reader'
import {mapPennylaneClients} from '@/lib/import/pennylane-clients-mapper'
import {logger} from '@/lib/logger'

import {canImportMemberContacts} from './authorization/member-contact-import-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {
  isValidationParsedZodError,
  ValidationParsedZodError,
} from './errors/validation-error'
import {getLinkedAccountRole} from './member-account-service'
import {rejectionOfValidation} from './member-import-rejection'
import {
  addMemberProfileEmailService,
  designateMemberProfileHolderService,
  disableImportedEmail,
  reactivateImportedEmail,
} from './member-profile-email-service'
import {updateMemberProfileContactService} from './member-profile-service'
import {sameEmail} from './rules/member-account-rules'
import {
  planAnnualContactUpdate,
  planAnnualEmailUpdate,
} from './rules/member-annual-import-rules'
import {visibleEmails} from './rules/member-email-rules'
import {MemberAccountRoleConst} from './types/domain/member-account-types'
import {
  AnnualContactGroup,
  AnnualContactGroupConst,
  AnnualCurrentContact,
  AnnualEmailFinding,
  AnnualEmailOperation,
  AnnualEmailRow,
  AnnualFileContact,
  AnnualImportReportDTO,
  AnnualKeptValueDTO,
  ImportAnnualMemberContactsInput,
  ImportAnnualMemberContactsResult,
  PennylaneImportSnapshot,
} from './types/domain/member-annual-import-types'
import {MemberEmailOriginConst} from './types/domain/member-email-types'
import {
  ImportFileRefusalConst,
  ImportMemberCandidate,
  ImportPlan,
  ImportRejection,
  ImportRejectionConst,
  ImportRejectionDTO,
  MEMBER_IMPORT_MAX_LINES,
} from './types/domain/member-import-types'
import {importAnnualMemberContactsServiceSchema} from './validation/member-import-validation'
import {memberProfileOrganizationIdSchema} from './validation/member-profile-validation'

/**
 * Mise a jour annuelle des coordonnees depuis le fichier clients de Pennylane
 * (s56, ADR 047, 048, 076, 077).
 *
 * Reservee a la presidence (`member.contact.import`), garde en tete, avant
 * toute lecture du fichier. Le fichier entier est refuse avant toute
 * ecriture s'il est illisible. Puis une transaction de tenant **par fiche** :
 * ses coordonnees, ses adresses et son instantane s'ecrivent en entier ou
 * pas du tout, et un rejet n'arrete pas les suivantes. Aucune fiche n'est
 * creee, aucune parcelle touchee, aucun email envoye, rien n'est persiste du
 * rapport. Le journal ne recoit que des comptages.
 */

const IMPORT_DENIED =
  'Seule la présidence de l’association peut mettre à jour les coordonnées depuis le fichier'

/** Leve dans le scope de la fiche pour en annuler toutes les ecritures. */
class MemberRejected extends Error {
  constructor(readonly reason: ImportRejection) {
    super(reason)
    this.name = 'MemberRejected'
  }
}

/**
 * Un service a refuse de toucher l'adresse d'un compte a role (decision B,
 * defense) : la fiche est annulee et rapportee « a corriger a la main ».
 */
class ManualCorrection extends Error {
  constructor(readonly finding: AnnualEmailFinding) {
    super('manual_correction')
    this.name = 'ManualCorrection'
  }
}

/** L'utilisateur peut-il deposer le fichier de l'annee pour cette association ? */
export const canImportMemberContactsService = async (
  organizationId: string
): Promise<boolean> => {
  const parsed = memberProfileOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) return false

  return canImportMemberContacts(parsed.data)
}

type ProfileRef = {memberProfileId: string; name: string}

type MemberOutcome =
  | {kind: 'to_create'}
  | {kind: 'rejected'; reason: ImportRejection}
  | {
      kind: 'matched'
      profile: ProfileRef
      groups: AnnualContactGroup[]
      kept: AnnualKeptValueDTO[]
      findings: AnnualEmailFinding[]
    }

type CandidateOutcome = {member: ImportMemberCandidate; outcome: MemberOutcome}

type ProfileContext = {
  organizationId: string
  profile: MemberProfileReadRow
  importedAt: Date
}

const fileAddressOf = (
  line: string | undefined,
  postalCode: string | undefined,
  city: string | undefined
) =>
  line || postalCode || city
    ? {line: line ?? null, postalCode: postalCode ?? null, city: city ?? null}
    : undefined

/** Ce que le fichier porte pour la fiche, par groupe. */
const fileContactOf = (member: ImportMemberCandidate): AnnualFileContact => ({
  home: fileAddressOf(
    member.homeAddressLine,
    member.homePostalCode,
    member.homeCity
  ),
  land: fileAddressOf(
    member.landAddressLine,
    member.landPostalCode,
    member.landCity
  ),
  phone: member.phone,
  emails: [member.email, ...(member.additionalEmails ?? [])].filter(
    (email): email is string => Boolean(email)
  ),
})

const currentContactOf = (
  profile: MemberProfileReadRow
): AnnualCurrentContact => ({
  phone: profile.phone,
  homeAddressLine: profile.homeAddressLine,
  homeAddressComplement: profile.homeAddressComplement,
  homePostalCode: profile.homePostalCode,
  homeCity: profile.homeCity,
  landAddressLine: profile.landAddressLine,
  landAddressComplement: profile.landAddressComplement,
  landPostalCode: profile.landPostalCode,
  landCity: profile.landCity,
  companyName: profile.companyName,
})

/** Les adresses de la fiche, telles que la regle annuelle les lit. */
const readEmailRows = async (
  memberProfileId: string,
  now: Date
): Promise<AnnualEmailRow[]> =>
  visibleEmails(await getMemberProfileEmailsDao([memberProfileId]), now).map(
    (row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      status: row.status,
      origin: row.origin,
      addedByUserId: row.addedByUserId,
      replacesEmailId: row.replacesEmailId,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  )

/** Les adresses actives dont le compte porte un role `board` ou `owner`. */
const roleBoundEmailIdsOf = async (
  organizationId: string,
  rows: readonly AnnualEmailRow[],
  accounts: readonly LinkedAccountRow[]
): Promise<string[]> => {
  const bound: string[] = []
  for (const row of rows) {
    if (row.status !== 'active') continue
    const account = accounts.find((linked) =>
      sameEmail(linked.email, row.email)
    )
    const role = await getLinkedAccountRole(
      organizationId,
      account?.userId ?? null
    )
    if (role !== null && role !== MemberAccountRoleConst.MEMBER) {
      bound.push(row.id)
    }
  }
  return bound
}

/** Ecrit les coordonnees fusionnees par le service du bureau. */
const writeContact = async (
  context: ProfileContext,
  contact: AnnualCurrentContact
): Promise<void> => {
  const result = await updateMemberProfileContactService({
    organizationId: context.organizationId,
    memberProfileId: context.profile.id,
    ...Object.fromEntries(
      Object.entries(contact).map(([key, value]) => [key, value ?? undefined])
    ),
  })
  if (result.status !== 'saved') {
    throw new MemberRejected(ImportRejectionConst.INVALID_FIELD)
  }
}

/**
 * Ajoute une adresse de la cellule, origine fichier. Une adresse deja celle
 * d'un compte de l'association rejoint ce compte : l'import confirme de
 * lui-meme (patron s13), le service revérifie.
 */
const addEmail = async (
  context: ProfileContext,
  operation: Extract<AnnualEmailOperation, {kind: 'add'}>
): Promise<void> => {
  const input = {
    organizationId: context.organizationId,
    memberProfileId: context.profile.id,
    email: operation.email,
    role: operation.role,
    origin: MemberEmailOriginConst.FILE,
  }
  const first = await addMemberProfileEmailService(input)
  const result =
    first.status === 'email_shared'
      ? await addMemberProfileEmailService({
          ...input,
          confirmedAccountUserId: first.holder.userId,
        })
      : first
  if (result.status !== 'saved' && result.status !== 'already_listed') {
    throw new MemberRejected(ImportRejectionConst.INVALID_FIELD)
  }
}

/** Applique une operation du plan des adresses, dans l'ordre du plan. */
const applyEmailOperation = async (
  context: ProfileContext,
  operation: AnnualEmailOperation,
  manual: AnnualEmailFinding
): Promise<void> => {
  const target = {
    organizationId: context.organizationId,
    memberProfileId: context.profile.id,
  }
  if (operation.kind === 'add') return addEmail(context, operation)
  if (operation.kind === 'disable') {
    const result = await disableImportedEmail({
      ...target,
      emailId: operation.emailId,
    })
    if (result.status === 'board_email_required') {
      throw new ManualCorrection(manual)
    }
    if (result.status !== 'disabled') {
      throw new MemberRejected(ImportRejectionConst.INVALID_FIELD)
    }
    return
  }
  if (operation.kind === 'reactivate') {
    const result = await reactivateImportedEmail({
      ...target,
      emailId: operation.emailId,
      role: operation.role,
    })
    if (result.status !== 'reactivated') {
      throw new MemberRejected(ImportRejectionConst.INVALID_FIELD)
    }
    return
  }
  const result = await designateMemberProfileHolderService({
    ...target,
    emailId: operation.emailId,
  })
  if (result.status !== 'saved') {
    throw new MemberRejected(ImportRejectionConst.INVALID_FIELD)
  }
}

const keptEmailsOf = (
  profile: ProfileRef,
  findings: readonly AnnualEmailFinding[]
): AnnualKeptValueDTO[] =>
  findings.flatMap((finding) =>
    finding.kind === 'kept'
      ? [
          {
            ...profile,
            group: AnnualContactGroupConst.EMAILS,
            current: finding.current.join(', ') || null,
            file: finding.file.join(', ') || null,
          },
        ]
      : []
  )

/** La fiche rapprochee de la ligne, ou rien ; plusieurs : rejet. */
const findProfile = async (
  organizationId: string,
  member: ImportMemberCandidate
): Promise<MemberProfileReadRow | undefined> => {
  const matches = await listMemberProfilesByPennylaneIdIgnoringCaseDao(
    organizationId,
    member.pennylaneCustomerId
  )
  if (matches.length > 1) {
    throw new MemberRejected(ImportRejectionConst.AMBIGUOUS_CUSTOMER_ID)
  }
  return matches[0] ? getMemberProfileByIdDao(matches[0].id) : undefined
}

/** Met a jour une fiche, sous le scope de sa transaction. */
const writeMember = async (
  organizationId: string,
  member: ImportMemberCandidate,
  importedAt: Date
): Promise<MemberOutcome> => {
  const profile = await findProfile(organizationId, member)
  if (!profile) return {kind: 'to_create'}
  const context = {organizationId, profile, importedAt}
  const ref = {memberProfileId: profile.id, name: profile.name}
  const snapshot =
    profile.pennylaneImportSnapshot as PennylaneImportSnapshot | null

  const rows = await readEmailRows(profile.id, importedAt)
  const accounts = await getLinkedAccountsDao(profile.id)
  const roleBoundEmailIds = await roleBoundEmailIdsOf(
    organizationId,
    rows,
    accounts
  )
  const fileContact = fileContactOf(member)
  const contactPlan = planAnnualContactUpdate(
    currentContactOf(profile),
    fileContact,
    snapshot,
    profile.updatedAt.getTime() !== profile.createdAt.getTime()
  )
  const holder = rows.find(
    (row) => row.status === 'active' && row.role === 'holder'
  )
  const emailPlan = planAnnualEmailUpdate({
    rows,
    cell: fileContact.emails,
    snapshotEmails: snapshot?.emails ?? null,
    roleBoundEmailIds,
    holderRoleBound: holder ? roleBoundEmailIds.includes(holder.id) : false,
  })
  const manual: AnnualEmailFinding = {
    kind: 'manual',
    holderEmail: holder?.email ?? null,
    file: fileContact.emails,
  }

  if (contactPlan.changed) await writeContact(context, contactPlan.contact)
  for (const operation of emailPlan.operations) {
    await applyEmailOperation(context, operation, manual)
  }
  await setMemberProfileImportSnapshotDao(profile.id, {
    snapshot: {...contactPlan.snapshot, emails: emailPlan.snapshotEmails},
    importedAt,
  })

  return {
    kind: 'matched',
    profile: ref,
    groups: [
      ...contactPlan.outcomes
        .filter((outcome) => outcome.status === 'updated')
        .map((outcome) => outcome.group),
      ...(emailPlan.operations.length > 0
        ? [AnnualContactGroupConst.EMAILS]
        : []),
    ],
    kept: [
      ...contactPlan.outcomes
        .filter((outcome) => outcome.status === 'kept' && outcome.reported)
        .map((outcome) => ({
          ...ref,
          group: outcome.group,
          current: outcome.current,
          file: outcome.file,
        })),
      ...keptEmailsOf(ref, emailPlan.findings),
    ],
    findings: emailPlan.findings.filter((finding) => finding.kind !== 'kept'),
  }
}

/** Une fiche, dans sa propre transaction ; un rejet n'y laisse rien. */
const updateMember = async (
  organizationId: string,
  member: ImportMemberCandidate,
  importedAt: Date
): Promise<MemberOutcome> => {
  try {
    return await withTenant(organizationId, () =>
      writeMember(organizationId, member, importedAt)
    )
  } catch (error) {
    if (error instanceof ManualCorrection) {
      return manualOutcomeOf(organizationId, member, error.finding)
    }
    if (error instanceof MemberRejected) {
      return {kind: 'rejected', reason: error.reason}
    }
    if (isValidationParsedZodError(error)) {
      return {kind: 'rejected', reason: rejectionOfValidation(error)}
    }
    throw error
  }
}

/** La fiche annulee par un refus de role, relue pour le rapport. */
const manualOutcomeOf = async (
  organizationId: string,
  member: ImportMemberCandidate,
  finding: AnnualEmailFinding
): Promise<MemberOutcome> => {
  const profile = await withTenant(organizationId, () =>
    findProfile(organizationId, member)
  )
  if (!profile) return {kind: 'to_create'}
  return {
    kind: 'matched',
    profile: {memberProfileId: profile.id, name: profile.name},
    groups: [],
    kept: [],
    findings: [finding],
  }
}

type MatchedOutcome = Extract<MemberOutcome, {kind: 'matched'}>

const matchedOf = (outcomes: readonly CandidateOutcome[]): MatchedOutcome[] =>
  outcomes.flatMap(({outcome}) => (outcome.kind === 'matched' ? [outcome] : []))

/** Les constats d'un genre, nommes par leur fiche. */
const findingsOf = <Kind extends AnnualEmailFinding['kind']>(
  matched: readonly MatchedOutcome[],
  kind: Kind
): (ProfileRef & Omit<Extract<AnnualEmailFinding, {kind: Kind}>, 'kind'>)[] =>
  matched.flatMap((outcome) =>
    outcome.findings.flatMap((finding) => {
      if (finding.kind !== kind) return []
      const fields = Object.fromEntries(
        Object.entries(finding).filter(([key]) => key !== 'kind')
      )
      return [{...outcome.profile, ...fields}] as never
    })
  )

/** Le rapport ephemere (design s56, ecran 2) : jamais stocke ni journalise. */
const buildAnnualReport = (
  plan: ImportPlan,
  outcomes: readonly CandidateOutcome[]
): AnnualImportReportDTO => {
  const matched = matchedOf(outcomes)
  const writeRejections: ImportRejectionDTO[] = outcomes.flatMap(
    ({member, outcome}) =>
      outcome.kind === 'rejected'
        ? member.lines.map((line) => ({
            line,
            client: member.name,
            reason: outcome.reason,
          }))
        : []
  )
  const rejections = [...plan.rejections, ...writeRejections].sort(
    (a, b) => a.line - b.line
  )
  const toCreate = outcomes.flatMap(({member, outcome}) =>
    outcome.kind === 'to_create'
      ? [
          {
            line: member.lines[0],
            pennylaneCustomerId: member.pennylaneCustomerId,
            client: member.name,
          },
        ]
      : []
  )
  const updated = matched.filter((outcome) => outcome.groups.length > 0)

  return {
    linesRead: plan.linesRead,
    profilesUpdated: updated.length,
    profilesUnchanged: matched.length - updated.length,
    membersToCreate: toCreate.length,
    linesRejected: rejections.length,
    updated: updated.map((outcome) => ({
      ...outcome.profile,
      groups: outcome.groups,
    })),
    kept: matched.flatMap((outcome) => outcome.kept),
    replaced: findingsOf(matched, 'replaced'),
    designated: findingsOf(matched, 'designated'),
    disabled: findingsOf(matched, 'disabled'),
    manual: findingsOf(matched, 'manual').map((finding) => ({
      ...finding,
      file: finding.file.join(', '),
    })),
    toCreate,
    rejections,
  }
}

type PlanOutcome =
  | {ok: true; plan: ImportPlan}
  | {ok: false; result: ImportAnnualMemberContactsResult}

/** Lit et mappe le fichier ; refuse le fichier entier avant toute ecriture. */
const planAnnualImport = (content: Uint8Array): PlanOutcome => {
  const read = readCsv(content)
  if (!read.ok) {
    return {ok: false, result: {status: 'file_refused', reason: read.reason}}
  }
  if (read.table.records.length > MEMBER_IMPORT_MAX_LINES) {
    return {
      ok: false,
      result: {
        status: 'file_refused',
        reason: ImportFileRefusalConst.TOO_MANY_LINES,
        maxLines: MEMBER_IMPORT_MAX_LINES,
      },
    }
  }
  const mapped = mapPennylaneClients(read.table, {mode: 'annual'})
  if (!mapped.ok) {
    return {
      ok: false,
      result: {
        status: 'file_refused',
        reason: ImportFileRefusalConst.MISSING_COLUMNS,
        missingColumns: mapped.missingColumns,
      },
    }
  }
  return {ok: true, plan: mapped.plan}
}

/**
 * Met a jour les coordonnees des fiches de l'association depuis le fichier
 * de l'annee (criteres 1 a 10). Relancer le meme fichier ne change rien : la
 * regle compare fichier, fiche et instantane, et n'ecrit que ce qui change.
 */
export const importAnnualMemberContactsService = async (
  input: ImportAnnualMemberContactsInput
): Promise<ImportAnnualMemberContactsResult> => {
  const parsed = importAnnualMemberContactsServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }
  const {organizationId, content} = parsed.data
  if (!(await canImportMemberContacts(organizationId))) {
    throw new AuthorizationError(IMPORT_DENIED)
  }

  const planned = planAnnualImport(content)
  if (!planned.ok) return planned.result

  const importedAt = new Date()
  const outcomes: CandidateOutcome[] = []
  for (const member of planned.plan.members) {
    outcomes.push({
      member,
      outcome: await updateMember(organizationId, member, importedAt),
    })
  }

  const report = buildAnnualReport(planned.plan, outcomes)
  logger.info('[MEMBER-ANNUAL-IMPORT-SERVICE] Mise à jour terminée', {
    linesRead: report.linesRead,
    profilesUpdated: report.profilesUpdated,
    profilesUnchanged: report.profilesUnchanged,
    membersToCreate: report.membersToCreate,
    linesRejected: report.linesRejected,
  })
  return {status: 'imported', report}
}
