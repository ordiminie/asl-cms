import 'server-only'

import {withTenant} from '@/db/tenant-scope'
import {readCsv} from '@/lib/import/csv-reader'
import {mapPennylaneClients} from '@/lib/import/pennylane-clients-mapper'
import {logger} from '@/lib/logger'

import {canImportMembers} from './authorization/member-import-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {
  isValidationParsedZodError,
  ValidationParsedZodError,
} from './errors/validation-error'
import {
  createMemberProfileService,
  findMemberProfileIdByPennylaneIdService,
} from './member-profile-service'
import {getOrganizationByIdService} from './organization-service'
import {attachParcelService} from './parcel-ownership-service'
import {
  ImportFileRefusalConst,
  ImportMemberCandidate,
  ImportMembersInput,
  ImportMembersResult,
  ImportPlan,
  ImportRejection,
  ImportRejectionConst,
  ImportRejectionDTO,
  ImportReportDTO,
  MEMBER_IMPORT_MAX_LINES,
  OWNERSHIP_BEFORE_IMPORT_DATE,
} from './types/domain/member-import-types'
import {importMembersServiceSchema} from './validation/member-import-validation'

/**
 * Import initial des membres d'une association (s13, ADR 046 et 047).
 *
 * Une transaction de tenant **par membre** : sa fiche, son compte et ses
 * parcelles s'ecrivent en entier ou pas du tout, et un rejet n'arrete pas les
 * suivants. Tout passe par les services existants, jamais par un DAO direct
 * (ADR 029) ; chacun rappelle ses propres gardes. Le journal ne recoit que des
 * comptages : le rapport porte des donnees personnelles.
 */

const IMPORT_DENIED =
  "Seul le SuperAdmin Zourite Studio peut importer les membres d'une association"

/** Leve dans le scope du membre pour en annuler toutes les ecritures. */
class MemberRejected extends Error {
  constructor(readonly reason: ImportRejection) {
    super(reason)
    this.name = 'MemberRejected'
  }
}

type MemberOutcome =
  | {
      kind: 'created'
      accountOpened: boolean
      mailOnly: boolean
      parcels: number
    }
  | {kind: 'already_present'; parcels: number}
  | {kind: 'rejected'; reason: ImportRejection}

const FIELD_REJECTIONS: Record<string, ImportRejection> = {
  email: ImportRejectionConst.INVALID_EMAIL,
  postalCode: ImportRejectionConst.INVALID_POSTAL_CODE,
  phone: ImportRejectionConst.INVALID_PHONE,
}

/** Le premier champ refuse par la validation des services, en motif. */
const rejectionOfValidation = (
  error: ValidationParsedZodError
): ImportRejection => {
  const field = error.zodErrorFields?.issues[0]?.path[0]
  return (
    (typeof field === 'string' ? FIELD_REJECTIONS[field] : undefined) ??
    ImportRejectionConst.INVALID_FIELD
  )
}

const createProfile = async (
  organizationId: string,
  member: ImportMemberCandidate
): Promise<{id: string; accountOpened: boolean; mailOnly: boolean}> => {
  const result = await createMemberProfileService({
    organizationId,
    name: member.name,
    email: member.email,
    phone: member.phone,
    addressLine: member.addressLine,
    postalCode: member.postalCode,
    city: member.city,
    pennylaneCustomerId: member.pennylaneCustomerId,
  })
  if (result.status === 'email_taken') {
    throw new MemberRejected(ImportRejectionConst.EMAIL_TAKEN)
  }
  if (result.status !== 'saved') {
    throw new MemberRejected(ImportRejectionConst.INVALID_FIELD)
  }
  return {
    id: result.profile.id,
    accountOpened: result.accountChange === 'opened',
    mailOnly: result.profile.mailOnly,
  }
}

/** Rattache les parcelles ; rend le nombre de rattachements nouveaux. */
const attachParcels = async (
  organizationId: string,
  memberProfileId: string,
  member: ImportMemberCandidate
): Promise<number> => {
  let attached = 0
  for (const parcel of member.parcels) {
    const result = await attachParcelService({
      organizationId,
      memberProfileId,
      parcelNumber: parcel.parcelNumber,
      meterNumber: parcel.meterNumber,
      startsOn: OWNERSHIP_BEFORE_IMPORT_DATE,
    })
    if (result.status === 'attached') attached += 1
    else if (
      result.status !== 'overlap' ||
      result.conflict.memberProfileId !== memberProfileId
    ) {
      throw new MemberRejected(
        result.status === 'overlap'
          ? ImportRejectionConst.PARCEL_TAKEN
          : ImportRejectionConst.INVALID_FIELD
      )
    }
  }
  return attached
}

const writeMember = async (
  organizationId: string,
  member: ImportMemberCandidate
): Promise<MemberOutcome> => {
  const existingId = await findMemberProfileIdByPennylaneIdService(
    organizationId,
    member.pennylaneCustomerId
  )
  if (existingId) {
    return {
      kind: 'already_present',
      parcels: await attachParcels(organizationId, existingId, member),
    }
  }
  const profile = await createProfile(organizationId, member)
  return {
    kind: 'created',
    accountOpened: profile.accountOpened,
    mailOnly: profile.mailOnly,
    parcels: await attachParcels(organizationId, profile.id, member),
  }
}

/** Un membre, dans sa propre transaction ; un rejet n'y laisse rien. */
const importMember = async (
  organizationId: string,
  member: ImportMemberCandidate
): Promise<MemberOutcome> => {
  try {
    return await withTenant(organizationId, () =>
      writeMember(organizationId, member)
    )
  } catch (error) {
    if (error instanceof MemberRejected) {
      return {kind: 'rejected', reason: error.reason}
    }
    if (isValidationParsedZodError(error)) {
      return {kind: 'rejected', reason: rejectionOfValidation(error)}
    }
    throw error
  }
}

const buildReport = (
  plan: ImportPlan,
  outcomes: {member: ImportMemberCandidate; outcome: MemberOutcome}[]
): ImportReportDTO => {
  const count = (predicate: (outcome: MemberOutcome) => boolean) =>
    outcomes.filter(({outcome}) => predicate(outcome)).length
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
  const rejectedLines = new Set(writeRejections.map(({line}) => line))

  return {
    linesRead: plan.linesRead,
    membersCreated: count((o) => o.kind === 'created'),
    accountsOpened: count((o) => o.kind === 'created' && o.accountOpened),
    mailOnlyMembers: count((o) => o.kind === 'created' && o.mailOnly),
    parcelsAttached: outcomes.reduce(
      (total, {outcome}) =>
        total + (outcome.kind === 'rejected' ? 0 : outcome.parcels),
      0
    ),
    linesRejected: rejections.length,
    alreadyPresent: count((o) => o.kind === 'already_present'),
    rejections,
    remarks: plan.remarks.filter(({line}) => !rejectedLines.has(line)),
  }
}

type PlanOutcome =
  {ok: true; plan: ImportPlan} | {ok: false; result: ImportMembersResult}

/** Lit et mappe le fichier ; refuse le fichier entier avant toute ecriture. */
const planImport = (content: Uint8Array): PlanOutcome => {
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
  const mapped = mapPennylaneClients(read.table)
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
 * Importe un export clients Pennylane dans l'association visee (critere 1 a
 * 7). Relancer le meme fichier ne cree rien : une fiche se retrouve par son
 * identifiant Pennylane, une parcelle deja a ce membre est laissee telle quelle.
 */
export const importMembersService = async (
  input: ImportMembersInput
): Promise<ImportMembersResult> => {
  const parsed = importMembersServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }
  if (!(await canImportMembers())) {
    throw new AuthorizationError(IMPORT_DENIED)
  }

  const {organizationId, content} = parsed.data
  if (!(await getOrganizationByIdService(organizationId))) {
    return {status: 'organization_not_found'}
  }

  const planned = planImport(content)
  if (!planned.ok) return planned.result

  const outcomes: {member: ImportMemberCandidate; outcome: MemberOutcome}[] = []
  for (const member of planned.plan.members) {
    outcomes.push({member, outcome: await importMember(organizationId, member)})
  }

  const report = buildReport(planned.plan, outcomes)
  logger.info('[MEMBER-IMPORT-SERVICE] Import terminé', {
    linesRead: report.linesRead,
    membersCreated: report.membersCreated,
    alreadyPresent: report.alreadyPresent,
    linesRejected: report.linesRejected,
  })
  return {status: 'imported', report}
}
