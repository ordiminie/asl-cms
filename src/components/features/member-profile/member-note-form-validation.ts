import {z} from 'zod'

import {frenchDateToIso} from '@/components/ui/date-field-format'
import {
  MEMBER_NOTE_BODY_MAX,
  MEMBER_NOTE_CHANNELS,
  type MemberNoteKind,
} from '@/services/types/domain/member-note-types'

/**
 * Formulaires des notes internes et des echanges (s24, etats d a k du design).
 * Partages par le client (React Hook Form) et par les actions serveur. Le
 * service revalide tout : ce schema n'est pas la garde.
 */
type Translate = (
  key: string,
  values?: Record<string, string | number>
) => string

export const memberNoteFormSchema = z.object({
  body: z.string(),
  channel: z.string(),
  entryDate: z.string(),
})

export type MemberNoteFormSchemaType = z.infer<typeof memberNoteFormSchema>

export const MEMBER_NOTE_FORM_FIELDS = [
  'entryDate',
  'channel',
  'body',
] as const satisfies readonly (keyof MemberNoteFormSchemaType)[]

export type MemberNoteFormField = (typeof MEMBER_NOTE_FORM_FIELDS)[number]

/** Les champs ouverts selon le type : une note n'a que son texte. */
export const memberNoteFieldsOf = (
  kind: MemberNoteKind
): readonly MemberNoteFormField[] =>
  kind === 'note' ? ['body'] : MEMBER_NOTE_FORM_FIELDS

/** Nombre de caracteres au-dela du plafond, zero en deca. */
export const charactersOverLimit = (body: string): number =>
  Math.max(0, body.length - MEMBER_NOTE_BODY_MAX)

const bodySchema = (t: Translate, kind: MemberNoteKind) =>
  z.string().superRefine((value, context) => {
    if (value.trim().length === 0) {
      context.addIssue({
        code: 'custom',
        message: t(`detail.notes.validation.bodyRequired.${kind}`),
      })
      return
    }
    const over = charactersOverLimit(value)
    if (over > 0) {
      context.addIssue({
        code: 'custom',
        message: t('detail.notes.tooLong', {count: over}),
      })
    }
  })

const channelSchema = (t: Translate) =>
  z
    .string()
    .refine(
      (value) => (MEMBER_NOTE_CHANNELS as readonly string[]).includes(value),
      {message: t('detail.notes.validation.channelRequired')}
    )

/**
 * Le jour d'un echange, saisi `jj/mm/aaaa` : une date qui existe, jamais
 * posterieure a `today` (jour calendaire de Paris, ISO, fourni par l'appelant).
 */
const entryDateSchema = (t: Translate, today: string) =>
  z.string().superRefine((value, context) => {
    const iso = frenchDateToIso(value)
    if (!iso) {
      context.addIssue({
        code: 'custom',
        message: t('validation.dateInvalid'),
      })
    } else if (iso > today) {
      context.addIssue({
        code: 'custom',
        message: t('detail.notes.validation.dateFuture'),
      })
    }
  })

/** Le schema du formulaire d'une note ou d'un echange. */
export function createMemberNoteFormSchema(
  t: Translate,
  kind: MemberNoteKind,
  today: string
) {
  return kind === 'note'
    ? memberNoteFormSchema.extend({body: bodySchema(t, 'note')})
    : memberNoteFormSchema.extend({
        body: bodySchema(t, 'exchange'),
        channel: channelSchema(t),
        entryDate: entryDateSchema(t, today),
      })
}

/** Resultat d'une action sur le fil, rendu par la Server Action. */
export type MemberNoteActionResult =
  | {status: 'saved'; message: string}
  | {status: 'deleted'; message: string}
  | {
      status: 'invalid'
      errors: {field: MemberNoteFormField; message: string}[]
    }
  | {status: 'error'; message: string}

export type MemberNoteFormAction = (
  prevState: MemberNoteActionResult | undefined,
  formData: FormData
) => Promise<MemberNoteActionResult>
