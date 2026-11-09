import {
  MemberNoteChannel,
  MemberNoteDTO,
  MemberNoteKind,
} from '../types/domain/member-note-types'

/** La ligne telle que le repository la rend, ecrite sans le modele Drizzle. */
export type MemberNoteRow = {
  id: string
  kind: MemberNoteKind
  channel: MemberNoteChannel | null
  entryDate: string
  body: string
  authorName: string | null
  createdAt: Date
  updatedAt: Date | null
}

/**
 * L'entree du fil telle que le bureau la lit (ADR 050) : une liste blanche,
 * recopiee champ par champ. Ni `author_user_id`, ni `organization_id`, ni
 * `on_behalf_of_*` ne sortent.
 */
export const toMemberNoteDto = (row: MemberNoteRow): MemberNoteDTO => ({
  id: row.id,
  kind: row.kind,
  channel: row.channel,
  entryDate: row.entryDate,
  body: row.body,
  authorName: row.authorName,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
})
