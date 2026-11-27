import 'server-only'

import {setMemberProfileImportSnapshotDao} from '@/db/repositories/member-profile-repository'
import {withTenant} from '@/db/tenant-scope'
import {readCsv} from '@/lib/import/csv-reader'
import {mapPennylaneClients} from '@/lib/import/pennylane-clients-mapper'
import {logger} from '@/lib/logger'

import {getAssociationSettingsService} from './association-settings-service'
import {canImportMembers} from './authorization/member-import-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {
  isValidationParsedZodError,
  ValidationParsedZodError,
} from './errors/validation-error'
import {rejectionOfValidation} from './member-import-rejection'
import {addMemberProfileEmailService} from './member-profile-email-service'
import {
  createMemberProfileService,
  findMemberProfileIdByPennylaneIdService,
} from './member-profile-service'
import {getOrganizationByIdService} from './organization-service'
import {attachParcelService} from './parcel-ownership-service'
import {importedEmailsPlan} from './rules/member-email-rules'
import {getDefaultLandAddress} from './types/domain/association-settings-types'
import {PennylaneImportSnapshot} from './types/domain/member-annual-import-types'
import {MemberEmailOriginConst} from './types/domain/member-email-types'
import {
  ImportFileRefusalConst,
  ImportMemberCandidate,
  ImportMembersInput,
  ImportMembersResult,
  ImportPlan,
  ImportRejection,
  ImportRejectionConst,
  ImportRejectionDTO,
  ImportRemarkConst,
  ImportRemarkDTO,
  ImportReportDTO,
  MEMBER_IMPORT_MAX_LINES,
  OWNERSHIP_BEFORE_IMPORT_DATE,
} from './types/domain/member-import-types'
import {importMembersServiceSchema} from './validation/member-import-validation'

/**
 * Import initial des membres d'une association (s13, ADR 047 et 048).
 *
 * Une transaction de tenant **par membre** : sa fiche, son compte et ses
 * parcelles s'ecrivent en entier ou pas du tout, et un rejet n'arrete pas les
 * suivants. Une adresse deja celle d'un compte de l'association relie la
 * fiche a ce compte, et le regroupement est signale au rapport (s53). Toutes
 * les adresses d'une cellule sont reprises (s54) : la premiere titulaire, les
 * suivantes supplementaires. Une fiche creee sans terrain recoit le terrain
 * par defaut de l'association (s55, ADR 058). Tout passe par les services existants, jamais par un DAO direct
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
      /** La fiche a rejoint le compte qui portait deja son adresse (s53). */
      accountJoined: boolean
      mailOnly: boolean
      parcels: number
    }
  | {kind: 'already_present'; parcels: number}
  | {kind: 'rejected'; reason: ImportRejection}

/**
 * Code postal et commune du terrain par defaut de l'association (s55, ADR
 * 058), lus une fois par import ; `null` quand le bureau ne les a pas
 * renseignes.
 */
type DefaultLandAddress = {postalCode: string | null; city: string | null}

/**
 * Le terrain d'une fiche creee : celui du fichier, sinon — aucune de ses
 * parties renseignee — le code postal et la commune par defaut, sans rue.
 */
const landOf = (
  member: ImportMemberCandidate,
  defaultLand: DefaultLandAddress
): {landAddressLine?: string; landPostalCode?: string; landCity?: string} => {
  if (member.landAddressLine || member.landPostalCode || member.landCity) {
    return {
      landAddressLine: member.landAddressLine,
      landPostalCode: member.landPostalCode,
      landCity: member.landCity,
    }
  }
  return {
    landPostalCode: defaultLand.postalCode ?? undefined,
    landCity: defaultLand.city ?? undefined,
  }
}

const addressOrNull = (address: {
  line?: string
  postalCode?: string
  city?: string
}): PennylaneImportSnapshot['home'] =>
  address.line || address.postalCode || address.city
    ? {
        line: address.line ?? null,
        postalCode: address.postalCode ?? null,
        city: address.city ?? null,
      }
    : null

/**
 * L'instantane d'une fiche creee (s56, ADR 077 §1) : les valeurs que l'import
 * a ecrites, terrain par defaut compris — la mise a jour annuelle les
 * reconnaitra comme venues de l'import, pas du site.
 */
const snapshotOf = (
  member: ImportMemberCandidate,
  defaultLand: DefaultLandAddress
): PennylaneImportSnapshot => {
  const land = landOf(member, defaultLand)
  return {
    home: addressOrNull({
      line: member.homeAddressLine,
      postalCode: member.homePostalCode,
      city: member.homeCity,
    }),
    land: addressOrNull({
      line: land.landAddressLine,
      postalCode: land.landPostalCode,
      city: land.landCity,
    }),
    phone: member.phone ?? null,
    emails: [member.email, ...(member.additionalEmails ?? [])]
      .filter((email): email is string => Boolean(email))
      .map((email) => email.toLowerCase()),
  }
}

type CreatedProfile = {
  id: string
  accountOpened: boolean
  accountJoined: boolean
  mailOnly: boolean
}

/**
 * Cree la fiche. Une adresse deja celle d'un compte de l'association n'est
 * pas un rejet (s53, ADR 054 §4) : l'import confirme de lui-meme le compte
 * detenteur, que le service revérifie.
 */
const createProfile = async (
  organizationId: string,
  member: ImportMemberCandidate,
  defaultLand: DefaultLandAddress
): Promise<CreatedProfile> => {
  const input = {
    organizationId,
    name: member.name,
    email: member.email,
    phone: member.phone,
    homeAddressLine: member.homeAddressLine,
    homePostalCode: member.homePostalCode,
    homeCity: member.homeCity,
    ...landOf(member, defaultLand),
    companyName: member.companyName,
    pennylaneCustomerId: member.pennylaneCustomerId,
  }
  const first = await createMemberProfileService(input)
  const result =
    first.status === 'email_shared'
      ? await createMemberProfileService({
          ...input,
          confirmedAccountUserId: first.holder.userId,
        })
      : first
  if (result.status !== 'saved') {
    throw new MemberRejected(ImportRejectionConst.INVALID_FIELD)
  }
  return {
    id: result.profile.id,
    accountOpened: result.accountChange === 'opened',
    accountJoined: result.accountChange === 'linked',
    mailOnly: result.profile.mailOnly,
  }
}

/**
 * Les adresses suivantes de la cellule (s54, critere 11) : supplementaires,
 * actives, d'origine fichier. Une adresse deja celle d'un compte de
 * l'association rejoint ce compte (s53), avec le role de la cellule sur
 * cette fiche (critere 8) ; l'import confirme de lui-meme, le service
 * revérifie.
 */
const addCellEmails = async (
  organizationId: string,
  memberProfileId: string,
  member: ImportMemberCandidate
): Promise<void> => {
  const cell = [member.email, ...(member.additionalEmails ?? [])].filter(
    (email): email is string => Boolean(email)
  )
  for (const {email, role} of importedEmailsPlan([], cell).slice(1)) {
    const input = {
      organizationId,
      memberProfileId,
      email,
      role,
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
  member: ImportMemberCandidate,
  defaultLand: DefaultLandAddress
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
  const profile = await createProfile(organizationId, member, defaultLand)
  await addCellEmails(organizationId, profile.id, member)
  await setMemberProfileImportSnapshotDao(profile.id, {
    snapshot: snapshotOf(member, defaultLand),
    importedAt: new Date(),
  })
  return {
    kind: 'created',
    accountOpened: profile.accountOpened,
    accountJoined: profile.accountJoined,
    mailOnly: profile.mailOnly,
    parcels: await attachParcels(organizationId, profile.id, member),
  }
}

/** Un membre, dans sa propre transaction ; un rejet n'y laisse rien. */
const importMember = async (
  organizationId: string,
  member: ImportMemberCandidate,
  defaultLand: DefaultLandAddress
): Promise<MemberOutcome> => {
  try {
    return await withTenant(organizationId, () =>
      writeMember(organizationId, member, defaultLand)
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

const emailKeyOf = (member: ImportMemberCandidate): string | undefined =>
  member.email?.trim().toLowerCase()

/**
 * Chaque fiche qui a rejoint un compte deja ouvert (s53, critere 5) : avec la
 * premiere ligne importee du fichier a la meme adresse, sinon comme une
 * adresse deja portee par une fiche existante.
 */
const sharedEmailRemarks = (
  outcomes: {member: ImportMemberCandidate; outcome: MemberOutcome}[]
): ImportRemarkDTO[] => {
  const firstLineByEmail = new Map<string, number>()
  return outcomes.flatMap(({member, outcome}): ImportRemarkDTO[] => {
    const email = emailKeyOf(member)
    if (!email || outcome.kind === 'rejected') return []
    const relatedLine = firstLineByEmail.get(email)
    if (relatedLine === undefined) firstLineByEmail.set(email, member.lines[0])
    if (outcome.kind !== 'created' || !outcome.accountJoined) return []
    const base = {line: member.lines[0], client: member.name}
    return relatedLine === undefined
      ? [{...base, remark: ImportRemarkConst.SHARED_EMAIL_EXISTING}]
      : [{...base, remark: ImportRemarkConst.SHARED_EMAIL, relatedLine}]
  })
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
    remarks: [
      ...plan.remarks.filter(({line}) => !rejectedLines.has(line)),
      ...sharedEmailRemarks(outcomes),
    ].sort((a, b) => a.line - b.line),
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

  const defaultLand = getDefaultLandAddress(
    await getAssociationSettingsService(organizationId)
  )
  const outcomes: {member: ImportMemberCandidate; outcome: MemberOutcome}[] = []
  for (const member of planned.plan.members) {
    outcomes.push({
      member,
      outcome: await importMember(organizationId, member, defaultLand),
    })
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
