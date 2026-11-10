import 'server-only'

import {z} from 'zod'

import {
  createMemberNoteTxnDao,
  deleteMemberNoteTxnDao,
  getMemberNotesPageDao,
  updateMemberNoteTxnDao,
} from '@/db/repositories/member-note-repository'
import {getMemberProfileByIdDao} from '@/db/repositories/member-profile-repository'
import {withTenant} from '@/db/tenant-scope'

import {getActingContext, getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {toMemberNoteDto} from './rules/member-note-rules'
import {ActionIdConst} from './types/domain/action-registry-types'
import {effectiveAuthor, TraceAuthor} from './types/domain/impersonation-types'
import {
  AddMemberExchangeInput,
  AddMemberNoteInput,
  DeleteMemberNoteInput,
  MEMBER_NOTES_PAGE_SIZE,
  MemberNoteChannel,
  MemberNoteDeleteResult,
  MemberNoteKind,
  MemberNotesPageDTO,
  MemberNotesPageInput,
  MemberNoteWriteResult,
  UpdateMemberExchangeInput,
  UpdateMemberNoteInput,
} from './types/domain/member-note-types'
import {calendarDayOf} from './types/domain/water-analysis-types'
import {
  addMemberExchangeServiceSchema,
  addMemberNoteServiceSchema,
  deleteMemberNoteServiceSchema,
  memberNotesPageServiceSchema,
  updateMemberExchangeServiceSchema,
  updateMemberNoteServiceSchema,
} from './validation/member-note-validation'

/**
 * Notes internes et echanges d'un membre (s24, ADR 050). Reserves au bureau :
 * chaque fonction valide l'entree, puis exige `member.note.manage` sur
 * l'association, puis lit l'auteur **avant** `withTenant`, puis verifie la
 * fiche sous le scope du tenant avant toute lecture ou ecriture du fil.
 *
 * Un membre simple n'y a aucun acces, ni le SuperAdmin pendant qu'il agit a
 * la place d'un membre simple : c'est le compte vu que l'autorisation juge.
 * Le texte n'est jamais journalise (intercepteur sans details).
 */

const NOTES_DENIED =
  "Seul le bureau de l'association peut tenir les notes internes d'un membre"

const parseOrThrow = <S extends z.ZodType>(
  schema: S,
  input: unknown
): z.output<S> => {
  const parsed = schema.safeParse(input)
  if (!parsed.success) throw new ValidationParsedZodError(parsed.error)
  return parsed.data
}

const requireNotesManager = async (organizationId: string) => {
  const authUser = await getAuthUser()
  if (
    !authUser ||
    !canPerformAction(
      authUser,
      organizationId,
      ActionIdConst.MEMBER_NOTE_MANAGE
    )
  ) {
    throw new AuthorizationError(NOTES_DENIED)
  }
  return authUser
}

/** L'auteur copie sur l'entree, lu hors du scope du tenant (s48). */
const authorOf = async (authUser: {
  id: string
  name: string
}): Promise<TraceAuthor> =>
  effectiveAuthor(authUser, (await getActingContext())?.impersonator)

/** La fiche existe dans l'association du scope ; sinon rien n'est lu. */
const profileExists = async (memberProfileId: string): Promise<boolean> =>
  (await getMemberProfileByIdDao(memberProfileId)) !== undefined

/** Le fil d'une fiche, une page a la fois ; `undefined` si la fiche manque. */
export const listMemberNotesService = async (
  input: MemberNotesPageInput
): Promise<MemberNotesPageDTO | undefined> => {
  const data = parseOrThrow(memberNotesPageServiceSchema, input)
  await requireNotesManager(data.organizationId)

  return withTenant(data.organizationId, async () => {
    if (!(await profileExists(data.memberProfileId))) return undefined
    const {rows, total} = await getMemberNotesPageDao(data.memberProfileId, {
      limit: MEMBER_NOTES_PAGE_SIZE,
      offset: (data.page - 1) * MEMBER_NOTES_PAGE_SIZE,
    })
    return {
      items: rows.map(toMemberNoteDto),
      page: data.page,
      pageSize: MEMBER_NOTES_PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / MEMBER_NOTES_PAGE_SIZE),
    }
  })
}

type NewEntry = {
  organizationId: string
  memberProfileId: string
  kind: MemberNoteKind
  channel: MemberNoteChannel | null
  entryDate: string
  body: string
}

const createEntry = async (entry: NewEntry): Promise<MemberNoteWriteResult> => {
  const authUser = await requireNotesManager(entry.organizationId)
  const author = await authorOf(authUser)

  return withTenant(entry.organizationId, async () => {
    if (!(await profileExists(entry.memberProfileId))) {
      return {status: 'not_found'}
    }
    const row = await createMemberNoteTxnDao({...entry, ...author})
    return row
      ? {status: 'saved', note: toMemberNoteDto(row)}
      : {status: 'not_found'}
  })
}

/** Ajoute une note, datee du jour de saisie (Paris). */
export const addMemberNoteService = async (
  input: AddMemberNoteInput
): Promise<MemberNoteWriteResult> => {
  const data = parseOrThrow(addMemberNoteServiceSchema, input)
  return createEntry({
    organizationId: data.organizationId,
    memberProfileId: data.memberProfileId,
    kind: 'note',
    channel: null,
    entryDate: calendarDayOf(new Date()),
    body: data.body,
  })
}

/** Consigne un echange : jour choisi (jamais futur), canal, resume. */
export const addMemberExchangeService = async (
  input: AddMemberExchangeInput
): Promise<MemberNoteWriteResult> => {
  const data = parseOrThrow(addMemberExchangeServiceSchema, input)
  return createEntry({
    organizationId: data.organizationId,
    memberProfileId: data.memberProfileId,
    kind: 'exchange',
    channel: data.channel,
    entryDate: data.entryDate,
    body: data.body,
  })
}

const updateEntry = async (
  target: {
    organizationId: string
    memberProfileId: string
    noteId: string
    kind: MemberNoteKind
  },
  patch: {body: string; channel?: MemberNoteChannel; entryDate?: string}
): Promise<MemberNoteWriteResult> => {
  await requireNotesManager(target.organizationId)

  return withTenant(target.organizationId, async () => {
    if (!(await profileExists(target.memberProfileId))) {
      return {status: 'not_found'}
    }
    const row = await updateMemberNoteTxnDao(
      target.noteId,
      target.memberProfileId,
      target.kind,
      patch
    )
    return row
      ? {status: 'saved', note: toMemberNoteDto(row)}
      : {status: 'not_found'}
  })
}

/** Modifie le texte d'une note. L'auteur et le type ne changent pas. */
export const updateMemberNoteService = async (
  input: UpdateMemberNoteInput
): Promise<MemberNoteWriteResult> => {
  const data = parseOrThrow(updateMemberNoteServiceSchema, input)
  return updateEntry({...data, kind: 'note'}, {body: data.body})
}

/** Modifie le jour, le canal et le resume d'un echange. */
export const updateMemberExchangeService = async (
  input: UpdateMemberExchangeInput
): Promise<MemberNoteWriteResult> => {
  const data = parseOrThrow(updateMemberExchangeServiceSchema, input)
  return updateEntry(
    {...data, kind: 'exchange'},
    {body: data.body, channel: data.channel, entryDate: data.entryDate}
  )
}

/** Supprime une note ou un echange, physiquement (ADR 050). */
export const deleteMemberNoteService = async (
  input: DeleteMemberNoteInput
): Promise<MemberNoteDeleteResult> => {
  const data = parseOrThrow(deleteMemberNoteServiceSchema, input)
  await requireNotesManager(data.organizationId)

  return withTenant(data.organizationId, async () => {
    if (!(await profileExists(data.memberProfileId))) {
      return {status: 'not_found'}
    }
    const row = await deleteMemberNoteTxnDao(data.noteId, data.memberProfileId)
    return row ? {status: 'deleted'} : {status: 'not_found'}
  })
}
