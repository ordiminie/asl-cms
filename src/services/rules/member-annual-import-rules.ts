import {
  AnnualContactGroupConst,
  AnnualContactPlan,
  AnnualCurrentContact,
  AnnualEmailFinding,
  AnnualEmailOperation,
  AnnualEmailPlan,
  AnnualEmailPlanInput,
  AnnualEmailRow,
  AnnualFileContact,
  AnnualGroupOutcome,
  ImportedAddress,
  PennylaneImportSnapshot,
} from '../types/domain/member-annual-import-types'
import {
  MemberEmailRole,
  MemberEmailRoleConst,
  MemberEmailStatusConst,
} from '../types/domain/member-email-types'
import {sameEmail} from './member-account-rules'

/**
 * Regles pures de la mise a jour annuelle (s56, ADR 076, 077). Isomorphe : ni
 * base, ni horloge.
 *
 * Par groupe (domicile, terrain, telephone, adresses email), fichier `F`,
 * valeur actuelle `C`, instantane `S` : `F` vide ou absent → rien n'est
 * efface ; `F = C` → inchange ; `S` connu : `C = S` → `F` ecrit, sinon garde
 * et signale si `F ≠ S` ; `S` inconnu : ecrit si la fiche n'a jamais ete
 * touchee depuis sa creation, sinon garde et signale.
 */

const clean = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

const cleanAddress = (
  address: ImportedAddress | null | undefined
): ImportedAddress | null => {
  if (!address) return null
  const cleaned = {
    line: clean(address.line),
    postalCode: clean(address.postalCode),
    city: clean(address.city),
  }
  return cleaned.line || cleaned.postalCode || cleaned.city ? cleaned : null
}

const sameAddress = (
  a: ImportedAddress | null,
  b: ImportedAddress | null
): boolean =>
  (a?.line ?? null) === (b?.line ?? null) &&
  (a?.postalCode ?? null) === (b?.postalCode ?? null) &&
  (a?.city ?? null) === (b?.city ?? null)

/** Une adresse postale telle que le rapport l'affiche. */
const displayAddress = (address: ImportedAddress | null): string | null => {
  if (!address) return null
  const town = [address.postalCode, address.city].filter(Boolean).join(' ')
  return [address.line, town].filter(Boolean).join(', ') || null
}

type GroupDecision = {status: AnnualGroupOutcome['status']; reported: boolean}

/** La regle d'un groupe, la valeur du fichier etant non vide. */
const decideGroup = <Value>(
  fileValue: Value,
  currentValue: Value,
  snapshotValue: {known: true; value: Value} | {known: false},
  touchedSinceCreation: boolean,
  same: (a: Value, b: Value) => boolean
): GroupDecision => {
  if (same(fileValue, currentValue)) {
    return {status: 'unchanged', reported: false}
  }
  if (!snapshotValue.known) {
    return touchedSinceCreation
      ? {status: 'kept', reported: true}
      : {status: 'updated', reported: false}
  }
  if (same(currentValue, snapshotValue.value)) {
    return {status: 'updated', reported: false}
  }
  return {status: 'kept', reported: !same(fileValue, snapshotValue.value)}
}

type AddressGroup =
  typeof AnnualContactGroupConst.HOME | typeof AnnualContactGroupConst.LAND

const ADDRESS_FIELDS = {
  home: {
    line: 'homeAddressLine',
    postalCode: 'homePostalCode',
    city: 'homeCity',
  },
  land: {
    line: 'landAddressLine',
    postalCode: 'landPostalCode',
    city: 'landCity',
  },
} as const satisfies Record<
  AddressGroup,
  Record<keyof ImportedAddress, keyof AnnualCurrentContact>
>

const currentAddressOf = (
  contact: AnnualCurrentContact,
  group: AddressGroup
): ImportedAddress | null => {
  const fields = ADDRESS_FIELDS[group]
  return cleanAddress({
    line: contact[fields.line],
    postalCode: contact[fields.postalCode],
    city: contact[fields.city],
  })
}

type GroupPlan = {
  outcome: AnnualGroupOutcome
  write: Partial<AnnualCurrentContact>
}

const planAddressGroup = (
  group: AddressGroup,
  current: AnnualCurrentContact,
  fileAddress: ImportedAddress | null,
  snapshot: PennylaneImportSnapshot | null,
  touchedSinceCreation: boolean
): GroupPlan => {
  const currentAddress = currentAddressOf(current, group)
  const outcome = (decision: GroupDecision): AnnualGroupOutcome => ({
    group,
    ...decision,
    current: displayAddress(currentAddress),
    file: displayAddress(fileAddress),
  })
  if (!fileAddress) {
    return {outcome: outcome({status: 'unchanged', reported: false}), write: {}}
  }
  const decision = decideGroup(
    fileAddress,
    currentAddress,
    snapshot
      ? {known: true, value: cleanAddress(snapshot[group])}
      : {known: false},
    touchedSinceCreation,
    sameAddress
  )
  const fields = ADDRESS_FIELDS[group]
  return {
    outcome: outcome(decision),
    write:
      decision.status === 'updated'
        ? {
            [fields.line]: fileAddress.line,
            [fields.postalCode]: fileAddress.postalCode,
            [fields.city]: fileAddress.city,
          }
        : {},
  }
}

const planPhoneGroup = (
  current: AnnualCurrentContact,
  filePhone: string | null,
  snapshot: PennylaneImportSnapshot | null,
  touchedSinceCreation: boolean
): GroupPlan => {
  const currentPhone = clean(current.phone)
  const outcome = (decision: GroupDecision): AnnualGroupOutcome => ({
    group: AnnualContactGroupConst.PHONE,
    ...decision,
    current: currentPhone,
    file: filePhone,
  })
  if (!filePhone) {
    return {outcome: outcome({status: 'unchanged', reported: false}), write: {}}
  }
  const decision = decideGroup<string | null>(
    filePhone,
    currentPhone,
    snapshot ? {known: true, value: clean(snapshot.phone)} : {known: false},
    touchedSinceCreation,
    (a, b) => a === b
  )
  return {
    outcome: outcome(decision),
    write: decision.status === 'updated' ? {phone: filePhone} : {},
  }
}

/**
 * Le plan des coordonnees postales et du telephone d'une fiche : le sort de
 * chaque groupe, les dix champs fusionnes (complements et entreprise repris
 * de la fiche, jamais ecrits par le fichier) et l'instantane a ecrire. Un
 * groupe vide dans le fichier garde sa valeur precedente dans l'instantane.
 */
export const planAnnualContactUpdate = (
  current: AnnualCurrentContact,
  fileContact: AnnualFileContact,
  snapshot: PennylaneImportSnapshot | null,
  touchedSinceCreation: boolean
): AnnualContactPlan => {
  const fileHome = cleanAddress(fileContact.home)
  const fileLand = cleanAddress(fileContact.land)
  const filePhone = clean(fileContact.phone)
  const plans = [
    planAddressGroup('home', current, fileHome, snapshot, touchedSinceCreation),
    planAddressGroup('land', current, fileLand, snapshot, touchedSinceCreation),
    planPhoneGroup(current, filePhone, snapshot, touchedSinceCreation),
  ]
  const outcomes = plans.map((plan) => plan.outcome)

  return {
    outcomes,
    changed: outcomes.some((outcome) => outcome.status === 'updated'),
    contact: plans.reduce<AnnualCurrentContact>(
      (contact, plan) => ({...contact, ...plan.write}),
      current
    ),
    snapshot: {
      home: fileHome ?? snapshot?.home ?? null,
      land: fileLand ?? snapshot?.land ?? null,
      phone: filePhone ?? snapshot?.phone ?? null,
    },
  }
}

const lowerAll = (emails: readonly string[]): string[] =>
  emails.map((email) => email.trim().toLowerCase())

const uniqueCell = (cell: readonly string[]): string[] =>
  cell.filter(
    (email, index) =>
      cell.findIndex((other) => sameEmail(other, email)) === index
  )

const sameList = (a: readonly string[], b: readonly string[] | null): boolean =>
  b !== null &&
  a.length === b.length &&
  a.every((email, index) => sameEmail(email, b[index]))

const isActiveRow = (row: AnnualEmailRow): boolean =>
  row.status === MemberEmailStatusConst.ACTIVE

const inList = (list: readonly string[] | null, email: string): boolean =>
  list?.some((other) => sameEmail(other, email)) ?? false

/**
 * Une adresse « venue du fichier » (ADR 077 §4) : origine `file` et portee par
 * l'instantane ; sans instantane, une ligne jamais modifiee. Sinon elle est
 * traitee comme une adresse du site, jamais desactivee (critere 9).
 */
const isFromFile = (
  row: AnnualEmailRow,
  snapshotEmails: readonly string[] | null
): boolean =>
  row.origin === 'file' &&
  (snapshotEmails === null
    ? row.updatedAt.getTime() === row.createdAt.getTime()
    : inList(snapshotEmails, row.email))

/** L'ordre de la designation : cellule, puis `created_at`, puis `id`. */
const designationOrder =
  (cell: readonly string[]) =>
  (a: AnnualEmailRow, b: AnnualEmailRow): number => {
    const rank = (row: AnnualEmailRow) => {
      const index = cell.findIndex((email) => sameEmail(email, row.email))
      return index === -1 ? cell.length : index
    }
    const byCell = rank(a) - rank(b)
    if (byCell !== 0) return byCell
    const byCreation = a.createdAt.getTime() - b.createdAt.getTime()
    if (byCreation !== 0) return byCreation
    return a.id.localeCompare(b.id)
  }

/** Une adresse de la cellule a rendre active : ajoutee ou reactivee. */
type FreshEmail =
  {kind: 'add'; email: string} | {kind: 'reactivate'; row: AnnualEmailRow}

type CellReading = {
  fresh: FreshEmail[]
  removedOnSite: boolean
}

/** (b) Les adresses de la cellule face a la fiche. */
const readCell = (
  rows: readonly AnnualEmailRow[],
  cell: readonly string[],
  snapshotEmails: readonly string[] | null
): CellReading => {
  const fresh: FreshEmail[] = []
  let removedOnSite = false
  for (const email of cell) {
    const known = rows.find((row) => sameEmail(row.email, email))
    if (known?.status === MemberEmailStatusConst.DISABLED_BY_IMPORT) {
      fresh.push({kind: 'reactivate', row: known})
    } else if (!known && inList(snapshotEmails, email)) {
      removedOnSite = true
    } else if (!known) {
      fresh.push({kind: 'add', email})
    }
  }
  return {fresh, removedOnSite}
}

const freshOperation = (
  fresh: FreshEmail,
  role: MemberEmailRole
): AnnualEmailOperation =>
  fresh.kind === 'add'
    ? {kind: 'add', email: fresh.email, role}
    : {kind: 'reactivate', emailId: fresh.row.id, role}

const freshEmailOf = (fresh: FreshEmail): string =>
  fresh.kind === 'add' ? fresh.email : fresh.row.email

type HolderDecision = {
  operations: AnnualEmailOperation[]
  findings: AnnualEmailFinding[]
  /** La premiere adresse nouvelle prend le titre. */
  freshHolder: boolean
  /** La titulaire du site est gardee hors du fichier. */
  keptHolder: boolean
}

/** (d) Le sort de la titulaire active. */
const decideHolder = (
  holder: AnnualEmailRow | undefined,
  remaining: readonly AnnualEmailRow[],
  {fresh}: CellReading,
  input: AnnualEmailPlanInput,
  cell: readonly string[]
): HolderDecision => {
  const none = {
    operations: [],
    findings: [],
    freshHolder: false,
    keptHolder: false,
  }
  if (!holder) {
    return {...none, freshHolder: !remaining.some(isActiveRow)}
  }
  if (inList(cell, holder.email)) return none
  if (!isFromFile(holder, input.snapshotEmails)) {
    return {...none, keptHolder: true}
  }
  const disable: AnnualEmailOperation = {kind: 'disable', emailId: holder.id}
  if (fresh.length > 0) {
    return {
      operations: [disable],
      findings: [
        {
          kind: 'replaced',
          oldEmail: holder.email,
          newEmail: freshEmailOf(fresh[0]),
        },
      ],
      freshHolder: true,
      keptHolder: false,
    }
  }
  const successor = remaining
    .filter((row) => row.id !== holder.id && isActiveRow(row))
    .sort(designationOrder(cell))[0]
  return {
    operations: successor
      ? [disable, {kind: 'promote', emailId: successor.id}]
      : [disable],
    findings: [
      {
        kind: 'designated',
        oldEmail: holder.email,
        newEmail: successor?.email ?? null,
      },
    ],
    freshHolder: false,
    keptHolder: false,
  }
}

const activeEmailsOf = (rows: readonly AnnualEmailRow[]): string[] =>
  [...rows]
    .filter(isActiveRow)
    .sort(
      (a, b) =>
        Number(b.role === MemberEmailRoleConst.HOLDER) -
        Number(a.role === MemberEmailRoleConst.HOLDER)
    )
    .map((row) => row.email)

/**
 * Le plan des adresses email d'une fiche (s56, decision 2, B, D ; ADR 076,
 * 077 §4) : operations ordonnees — la titulaire est desactivee (donc
 * retrogradee) avant qu'une autre prenne le titre — et constats du rapport.
 * Une cellule vide n'efface rien. Une fiche dont la titulaire porte un role
 * n'est jamais touchee : elle est signalee « a corriger a la main ».
 */
export const planAnnualEmailUpdate = (
  input: AnnualEmailPlanInput
): AnnualEmailPlan => {
  const cell = uniqueCell(
    input.cell.map((email) => email.trim()).filter(Boolean)
  )
  const previousSnapshot = [...(input.snapshotEmails ?? [])]
  if (cell.length === 0) {
    return {operations: [], findings: [], snapshotEmails: previousSnapshot}
  }

  const {rows, snapshotEmails} = input
  const reading = readCell(rows, cell, snapshotEmails)
  const roleBound = (row: AnnualEmailRow) =>
    input.roleBoundEmailIds.includes(row.id)
  const stale = rows.filter(
    (row) =>
      isActiveRow(row) &&
      row.role === MemberEmailRoleConst.ADDITIONAL &&
      isFromFile(row, snapshotEmails) &&
      !inList(cell, row.email)
  )
  const disabledExtras = stale.filter((row) => !roleBound(row))
  const boundExtras = stale.filter(roleBound)
  const remaining = rows.filter((row) => !disabledExtras.includes(row))
  const holder = rows.find(
    (row) => isActiveRow(row) && row.role === MemberEmailRoleConst.HOLDER
  )
  const holderDecision = decideHolder(holder, remaining, reading, input, cell)
  const operations: AnnualEmailOperation[] = [
    ...holderDecision.operations.filter((op) => op.kind === 'disable'),
    ...disabledExtras.map((row): AnnualEmailOperation => ({
      kind: 'disable',
      emailId: row.id,
    })),
    ...reading.fresh.map((fresh, index) =>
      freshOperation(
        fresh,
        holderDecision.freshHolder && index === 0
          ? MemberEmailRoleConst.HOLDER
          : MemberEmailRoleConst.ADDITIONAL
      )
    ),
    ...holderDecision.operations.filter((op) => op.kind === 'promote'),
  ]
  const fileChanged = !sameList(lowerAll(cell), snapshotEmails)
  const kept: AnnualEmailFinding[] =
    fileChanged && (holderDecision.keptHolder || reading.removedOnSite)
      ? [{kind: 'kept', current: activeEmailsOf(rows), file: cell}]
      : []
  const manual: AnnualEmailFinding = {
    kind: 'manual',
    holderEmail: holder?.email ?? null,
    file: cell,
  }

  const holderBound =
    input.holderRoleBound || (holder !== undefined && roleBound(holder))
  if (holderBound) {
    return {
      operations: [],
      findings: operations.length > 0 ? [manual] : [],
      snapshotEmails: previousSnapshot,
    }
  }

  return {
    operations,
    findings: [
      ...holderDecision.findings,
      ...disabledExtras.map((row): AnnualEmailFinding => ({
        kind: 'disabled',
        email: row.email,
      })),
      ...kept,
      ...(boundExtras.length > 0 ? [manual] : []),
    ],
    snapshotEmails: lowerAll([...cell, ...boundExtras.map((row) => row.email)]),
  }
}
