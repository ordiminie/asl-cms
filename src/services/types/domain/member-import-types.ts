/**
 * Types de domaine de l'import initial des membres (s13, ADR 047 et 048).
 * Motifs et remarques sont des **codes** : les phrases vivent dans
 * `messages/fr.json`, jamais dans le service.
 *
 * Le rapport est ephemere : rendu avec le resultat de l'action, jamais stocke
 * ni journalise (il contient des donnees personnelles).
 */

/**
 * Debut de propriete des parcelles importees : une date sentinelle fixe,
 * anterieure a toute vente, pour qu'une vente saisie apres l'import ne soit
 * jamais refusee. Affichee « avant l'import », jamais comme une date.
 */
export const OWNERSHIP_BEFORE_IMPORT_DATE = '1900-01-01'

/** Le debut de propriete est-il la date sentinelle de l'import ? */
export const isOwnershipBeforeImport = (startsOn: string): boolean =>
  startsOn === OWNERSHIP_BEFORE_IMPORT_DATE

/** Au-dela, le fichier est refuse avant tout traitement (limite technique). */
export const MEMBER_IMPORT_MAX_LINES = 2000

/** Pourquoi un fichier entier est refuse : rien n'est importe. */
export const ImportFileRefusalConst = {
  EMPTY: 'empty',
  BINARY: 'binary',
  NO_HEADERS: 'no_headers',
  UNCLOSED_QUOTE: 'unclosed_quote',
  MISSING_COLUMNS: 'missing_columns',
  TOO_MANY_LINES: 'too_many_lines',
} as const

export type ImportFileRefusal =
  (typeof ImportFileRefusalConst)[keyof typeof ImportFileRefusalConst]

/** Pourquoi une ligne est rejetee : rien n'est ecrit pour elle. */
export const ImportRejectionConst = {
  MALFORMED_LINE: 'malformed_line',
  MISSING_CUSTOMER_ID: 'missing_customer_id',
  MISSING_NAME: 'missing_name',
  NO_CONTACT: 'no_contact',
  MISSING_REFERENCE: 'missing_reference',
  EMAIL_TAKEN: 'email_taken',
  PARCEL_TAKEN: 'parcel_taken',
  INVALID_EMAIL: 'invalid_email',
  INVALID_POSTAL_CODE: 'invalid_postal_code',
  INVALID_PHONE: 'invalid_phone',
  INVALID_FIELD: 'invalid_field',
} as const

export type ImportRejection =
  (typeof ImportRejectionConst)[keyof typeof ImportRejectionConst]

/** Ce qu'une ligne importee merite qu'on relise. */
export const ImportRemarkConst = {
  SEVERAL_EMAILS: 'several_emails',
  POSTAL_CODE_PADDED: 'postal_code_padded',
  NO_METER: 'no_meter',
  SAME_NAME_AND_ADDRESS: 'same_name_and_address',
} as const

export type ImportRemark =
  (typeof ImportRemarkConst)[keyof typeof ImportRemarkConst]

export type ImportRejectionDTO = {
  line: number
  /** La denomination lue sur la ligne, vide si absente. */
  client: string
  reason: ImportRejection
}

export type ImportRemarkDTO = {
  line: number
  client: string
  remark: ImportRemark
  /** Pour `same_name_and_address` : la premiere ligne de meme nom et adresse. */
  relatedLine?: number
}

/** Une parcelle lue dans la `Reference Client`. */
export type ImportParcelCandidate = {
  line: number
  parcelNumber: string
  meterNumber?: string
}

/**
 * Un membre a importer : les lignes valides d'un meme identifiant client
 * Pennylane, regroupees. Ses coordonnees viennent de la premiere ligne.
 */
export type ImportMemberCandidate = {
  pennylaneCustomerId: string
  lines: number[]
  name: string
  email?: string
  phone?: string
  addressLine?: string
  postalCode?: string
  city?: string
  parcels: ImportParcelCandidate[]
}

/** Le fichier lu et mappe, avant toute ecriture. */
export type ImportPlan = {
  linesRead: number
  members: ImportMemberCandidate[]
  rejections: ImportRejectionDTO[]
  remarks: ImportRemarkDTO[]
}

export type ImportReportDTO = {
  linesRead: number
  membersCreated: number
  accountsOpened: number
  mailOnlyMembers: number
  parcelsAttached: number
  linesRejected: number
  /** Membres deja importes, inchanges (relance du meme fichier). */
  alreadyPresent: number
  rejections: ImportRejectionDTO[]
  remarks: ImportRemarkDTO[]
}

export type ImportMembersInput = {
  organizationId: string
  /** Le contenu brut du fichier televerse. */
  content: Uint8Array
}

export type ImportMembersResult =
  | {status: 'imported'; report: ImportReportDTO}
  | {status: 'organization_not_found'}
  | {
      status: 'file_refused'
      reason: ImportFileRefusal
      /** Pour `missing_columns` : les titres attendus absents du fichier. */
      missingColumns?: string[]
      /** Pour `too_many_lines` : le plafond. */
      maxLines?: number
    }

/** Poids maximal d'un fichier importe : la limite des Server Actions. */
export const MEMBER_IMPORT_MAX_FILE_BYTES = 16 * 1024 * 1024
export const MEMBER_IMPORT_FILE_EXTENSION = '.csv'
