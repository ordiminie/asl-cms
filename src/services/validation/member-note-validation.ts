import {z} from 'zod'

import {
  MEMBER_NOTE_BODY_MAX,
  MEMBER_NOTE_CHANNELS,
} from '../types/domain/member-note-types'
import {calendarDayOf} from '../types/domain/water-analysis-types'
import {newsDateSchema} from './news-validation'

/**
 * Validation des notes internes et des echanges (s24, ADR 050). Le texte est
 * borne ici **et** par le formulaire : le schema du formulaire n'est pas la
 * garde.
 */

const uuid = z.string().uuid()

const isNotBlank = (value: string) => value.trim().length > 0

export const memberNoteBodySchema = z
  .string()
  .max(MEMBER_NOTE_BODY_MAX)
  .refine(isNotBlank)

export const memberNoteChannelSchema = z.enum(MEMBER_NOTE_CHANNELS)

/**
 * Le jour d'un echange : une date ISO qui existe, jamais future. « Aujourd'hui »
 * est le jour calendaire de Paris, lu a la validation.
 */
export const memberExchangeDateSchema = newsDateSchema.refine(
  (value) => value <= calendarDayOf(new Date())
)

const memberNoteScopeSchema = z.object({
  organizationId: uuid,
  memberProfileId: uuid,
})

export const memberNotesPageServiceSchema = memberNoteScopeSchema.extend({
  page: z.number().int().min(1),
})

export const addMemberNoteServiceSchema = memberNoteScopeSchema.extend({
  body: memberNoteBodySchema,
})

export const addMemberExchangeServiceSchema = addMemberNoteServiceSchema.extend(
  {
    channel: memberNoteChannelSchema,
    entryDate: memberExchangeDateSchema,
  }
)

export const updateMemberNoteServiceSchema = addMemberNoteServiceSchema.extend({
  noteId: uuid,
})

export const updateMemberExchangeServiceSchema =
  addMemberExchangeServiceSchema.extend({noteId: uuid})

export const deleteMemberNoteServiceSchema = memberNoteScopeSchema.extend({
  noteId: uuid,
})
