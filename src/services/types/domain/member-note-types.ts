/**
 * Types de domaine des notes internes d'un membre (s24, ADR 050). Ecrits
 * **sans importer le modele Drizzle** (`rule-architecture`).
 *
 * Reserves au bureau : aucun de ces types n'entre dans `MemberProfileDTO` ni
 * dans une reponse lue par la presentation cote membre.
 */

/** Les deux types d'entree du fil. Immuables une fois ecrits. */
export const MEMBER_NOTE_KINDS = ['note', 'exchange'] as const
export type MemberNoteKind = (typeof MEMBER_NOTE_KINDS)[number]

/** Les canaux d'un echange : liste fermee de code (ADR 050). */
export const MEMBER_NOTE_CHANNELS = [
  'phone',
  'mail',
  'in_person',
  'email',
] as const
export type MemberNoteChannel = (typeof MEMBER_NOTE_CHANNELS)[number]

/** Plafond du texte d'une note ou du resume d'un echange. */
export const MEMBER_NOTE_BODY_MAX = 2000

/** Nombre d'entrees par page du fil. */
export const MEMBER_NOTES_PAGE_SIZE = 10

/**
 * Une entree du fil telle que le bureau la lit. Ni l'identifiant du compte
 * auteur, ni l'association, ni le compte « pour le compte de » : la signature
 * est le nom copie a l'ecriture.
 */
export type MemberNoteDTO = {
  id: string
  kind: MemberNoteKind
  /** Renseigne si et seulement si l'entree est un echange. */
  channel: MemberNoteChannel | null
  /** Jour ISO `YYYY-MM-DD` : choisi pour un echange, de saisie pour une note. */
  entryDate: string
  body: string
  authorName: string | null
  /** Instant de saisie, ISO. */
  createdAt: string
  /** Instant de la derniere modification, ISO ; `null` si jamais modifiee. */
  updatedAt: string | null
}

export type MemberNotesPageDTO = {
  items: MemberNoteDTO[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type MemberNotesPageInput = {
  organizationId: string
  memberProfileId: string
  page: number
}

export type AddMemberNoteInput = {
  organizationId: string
  memberProfileId: string
  body: string
}

export type AddMemberExchangeInput = AddMemberNoteInput & {
  channel: MemberNoteChannel
  entryDate: string
}

export type UpdateMemberNoteInput = AddMemberNoteInput & {noteId: string}

export type UpdateMemberExchangeInput = AddMemberExchangeInput & {
  noteId: string
}

export type DeleteMemberNoteInput = {
  organizationId: string
  memberProfileId: string
  noteId: string
}

/** Resultat d'une ecriture : l'entree ecrite, ou la fiche/l'entree absente. */
export type MemberNoteWriteResult =
  {status: 'saved'; note: MemberNoteDTO} | {status: 'not_found'}

export type MemberNoteDeleteResult = {status: 'deleted'} | {status: 'not_found'}
