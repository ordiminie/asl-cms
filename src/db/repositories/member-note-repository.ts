import {and, count, desc, eq, sql} from 'drizzle-orm'

import {
  AddMemberNoteModel,
  memberNote,
  MemberNoteChannelModel,
  MemberNoteKindModel,
  MemberNoteModel,
} from '@/db/models/member-note-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Notes internes et echanges d'un membre (s24, ADR 050). Sous RLS forcee :
 * hors `withTenant(organizationId, ...)`, rien ne sort et rien ne s'ecrit.
 * Les ecritures s'executent dans la transaction du scope de tenant.
 */

/** Ce que le fil lit d'une entree : ni le compte auteur, ni l'imitation. */
export type MemberNoteRowModel = Pick<
  MemberNoteModel,
  | 'id'
  | 'kind'
  | 'channel'
  | 'entryDate'
  | 'body'
  | 'authorName'
  | 'createdAt'
  | 'updatedAt'
>

export type MemberNotePageRows = {rows: MemberNoteRowModel[]; total: number}

const MEMBER_NOTE_ROW = {
  id: memberNote.id,
  kind: memberNote.kind,
  channel: memberNote.channel,
  entryDate: memberNote.entryDate,
  body: memberNote.body,
  authorName: memberNote.authorName,
  createdAt: memberNote.createdAt,
  updatedAt: memberNote.updatedAt,
}

/**
 * Le jour de l'entree d'abord, puis l'instant de saisie, puis l'identifiant :
 * un departage stable, pour que la pagination ne saute ni ne repete une ligne.
 */
const MEMBER_NOTE_ORDER = [
  desc(memberNote.entryDate),
  desc(memberNote.createdAt),
  desc(memberNote.id),
] as const

export const getMemberNotesPageDao = async (
  memberProfileId: string,
  page: {limit: number; offset: number}
): Promise<MemberNotePageRows> => {
  const where = eq(memberNote.memberProfileId, memberProfileId)
  const [rows, [{total}]] = await Promise.all([
    getDb()
      .select(MEMBER_NOTE_ROW)
      .from(memberNote)
      .where(where)
      .orderBy(...MEMBER_NOTE_ORDER)
      .limit(page.limit)
      .offset(page.offset),
    getDb().select({total: count()}).from(memberNote).where(where),
  ])
  return {rows, total}
}

export const createMemberNoteTxnDao = async (
  input: Pick<
    AddMemberNoteModel,
    | 'organizationId'
    | 'memberProfileId'
    | 'kind'
    | 'channel'
    | 'entryDate'
    | 'body'
    | 'authorUserId'
    | 'authorName'
    | 'onBehalfOfUserId'
    | 'onBehalfOfName'
  >
): Promise<MemberNoteRowModel | undefined> => {
  const [row] = await getDb()
    .insert(memberNote)
    .values(input)
    .returning(MEMBER_NOTE_ROW)
  return row
}

/**
 * Modifie le texte d'une entree (et, pour un echange, son canal et son jour).
 * La cible porte le type : une note ne devient jamais un echange. L'auteur
 * d'origine n'est jamais reecrit.
 */
export const updateMemberNoteTxnDao = async (
  noteId: string,
  memberProfileId: string,
  kind: MemberNoteKindModel,
  patch: {body: string; channel?: MemberNoteChannelModel; entryDate?: string}
): Promise<MemberNoteRowModel | undefined> => {
  const [row] = await getDb()
    .update(memberNote)
    .set({...patch, updatedAt: sql`now()`})
    .where(
      and(
        eq(memberNote.id, noteId),
        eq(memberNote.memberProfileId, memberProfileId),
        eq(memberNote.kind, kind)
      )
    )
    .returning(MEMBER_NOTE_ROW)
  return row
}

/** Suppression physique (ADR 050). */
export const deleteMemberNoteTxnDao = async (
  noteId: string,
  memberProfileId: string
): Promise<{id: string} | undefined> => {
  const [row] = await getDb()
    .delete(memberNote)
    .where(
      and(
        eq(memberNote.id, noteId),
        eq(memberNote.memberProfileId, memberProfileId)
      )
    )
    .returning({id: memberNote.id})
  return row
}
