/**
 * Types de domaine de la mise a jour annuelle des coordonnees (s56, ADR 076,
 * 077). Ecrits sans importer le modele Drizzle (`rule-architecture`).
 *
 * Le rapport est ephemere (ADR 047) : rendu avec le resultat de l'action,
 * jamais stocke ni journalise (il porte noms et adresses).
 */

import {
  MemberEmailOrigin,
  MemberEmailRecord,
  MemberEmailRole,
} from './member-email-types'
import {ImportFileRefusal, ImportRejectionDTO} from './member-import-types'

/** Une adresse postale telle que lue dans le fichier, sans complement. */
export type ImportedAddress = {
  line: string | null
  postalCode: string | null
  city: string | null
}

/**
 * Les dernieres valeurs lues dans le fichier pour une fiche, par groupe
 * (ADR 077 §1) : la reference de la regle « le site l'emporte ». `emails` :
 * en minuscules, dans l'ordre de la cellule.
 */
export type PennylaneImportSnapshot = {
  home: ImportedAddress | null
  land: ImportedAddress | null
  phone: string | null
  emails: string[]
}

/** Les groupes de coordonnees que l'import met a jour (ADR 077 §2). */
export type AnnualContactGroup = 'home' | 'land' | 'phone' | 'emails'

export const AnnualContactGroupConst = {
  HOME: 'home',
  LAND: 'land',
  PHONE: 'phone',
  EMAILS: 'emails',
} as const satisfies Record<string, AnnualContactGroup>

/**
 * Ce que le fichier porte pour une fiche. Un groupe absent (terrain sans
 * `Adresse de Livraison`) ou vide n'efface rien.
 */
export type AnnualFileContact = {
  home?: ImportedAddress
  land?: ImportedAddress
  phone?: string
  /** Les adresses de la cellule, dans leur ordre (s54). */
  emails: string[]
}

/** Les coordonnees actuelles d'une fiche que la regle compare au fichier. */
export type AnnualCurrentContact = {
  phone: string | null
  homeAddressLine: string | null
  homeAddressComplement: string | null
  homePostalCode: string | null
  homeCity: string | null
  landAddressLine: string | null
  landAddressComplement: string | null
  landPostalCode: string | null
  landCity: string | null
  companyName: string | null
}

export type AnnualGroupStatus = 'unchanged' | 'updated' | 'kept'

/** Le sort d'un groupe postal ou du telephone. */
export type AnnualGroupOutcome = {
  group: Exclude<AnnualContactGroup, 'emails'>
  status: AnnualGroupStatus
  /** Gardee et signalee au rapport (le fichier apporte du neuf). */
  reported: boolean
  /** La valeur du site, telle qu'affichee au rapport. */
  current: string | null
  /** La valeur du fichier, telle qu'affichee au rapport. */
  file: string | null
}

/** Le plan des coordonnees d'une fiche (ADR 077 §3). */
export type AnnualContactPlan = {
  outcomes: AnnualGroupOutcome[]
  /** Faut-il reecrire les coordonnees ? */
  changed: boolean
  /** Les dix champs fusionnes : complements et entreprise repris de la fiche. */
  contact: AnnualCurrentContact
  /** L'instantane a ecrire, sans `emails` (decides par le plan des adresses). */
  snapshot: Omit<PennylaneImportSnapshot, 'emails'>
}

/** Une adresse d'une fiche telle que la regle annuelle la lit. */
export type AnnualEmailRow = MemberEmailRecord & {
  origin: MemberEmailOrigin
  createdAt: Date
  updatedAt: Date
}

/** Une ecriture d'adresse, dans l'ordre ou l'appliquer. */
export type AnnualEmailOperation =
  | {kind: 'add'; email: string; role: MemberEmailRole}
  | {kind: 'reactivate'; emailId: string; role: MemberEmailRole}
  | {kind: 'disable'; emailId: string}
  | {kind: 'promote'; emailId: string}

/** Ce que le plan des adresses signale au rapport. */
export type AnnualEmailFinding =
  | {kind: 'replaced'; oldEmail: string; newEmail: string}
  /** `newEmail` nul : aucune autre adresse active, courrier uniquement. */
  | {kind: 'designated'; oldEmail: string; newEmail: string | null}
  | {kind: 'disabled'; email: string}
  | {kind: 'kept'; current: string[]; file: string[]}
  | {kind: 'manual'; holderEmail: string | null; file: string[]}

export type AnnualEmailPlanInput = {
  rows: readonly AnnualEmailRow[]
  /** Les adresses de la cellule, dans leur ordre. */
  cell: readonly string[]
  /** `S.emails` ; nul sans instantane. */
  snapshotEmails: readonly string[] | null
  /** Les adresses dont le compte porte un role `board` ou `owner`. */
  roleBoundEmailIds: readonly string[]
  /** La titulaire porte un role (decision B) : aucune adresse n'est touchee. */
  holderRoleBound: boolean
}

export type AnnualEmailPlan = {
  operations: AnnualEmailOperation[]
  findings: AnnualEmailFinding[]
  /** `S.emails` a ecrire. */
  snapshotEmails: string[]
}

/** Une ligne du rapport, designee par sa fiche. */
type AnnualReportProfile = {memberProfileId: string; name: string}

export type AnnualUpdatedProfileDTO = AnnualReportProfile & {
  groups: AnnualContactGroup[]
}

export type AnnualKeptValueDTO = AnnualReportProfile & {
  group: AnnualContactGroup
  current: string | null
  file: string | null
}

export type AnnualHolderChangeDTO = AnnualReportProfile & {
  oldEmail: string
  newEmail: string | null
}

export type AnnualDisabledEmailDTO = AnnualReportProfile & {email: string}

export type AnnualManualEmailDTO = AnnualReportProfile & {
  holderEmail: string | null
  file: string
}

export type AnnualMemberToCreateDTO = {
  line: number
  pennylaneCustomerId: string
  client: string
}

/** Le rapport de la mise a jour (design s56, ecran 2). */
export type AnnualImportReportDTO = {
  linesRead: number
  profilesUpdated: number
  profilesUnchanged: number
  membersToCreate: number
  linesRejected: number
  updated: AnnualUpdatedProfileDTO[]
  kept: AnnualKeptValueDTO[]
  replaced: AnnualHolderChangeDTO[]
  designated: AnnualHolderChangeDTO[]
  disabled: AnnualDisabledEmailDTO[]
  manual: AnnualManualEmailDTO[]
  toCreate: AnnualMemberToCreateDTO[]
  rejections: ImportRejectionDTO[]
}

export type ImportAnnualMemberContactsInput = {
  organizationId: string
  /** Le contenu brut du fichier televerse. */
  content: Uint8Array
}

export type ImportAnnualMemberContactsResult =
  | {status: 'imported'; report: AnnualImportReportDTO}
  | {
      status: 'file_refused'
      reason: ImportFileRefusal
      missingColumns?: string[]
      maxLines?: number
    }
