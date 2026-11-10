'use server'

import {revalidatePath} from 'next/cache'
import {getTranslations} from 'next-intl/server'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {
  createMemberNoteFormSchema,
  type MemberNoteActionResult,
  type MemberNoteFormField,
  type MemberNoteFormSchemaType,
} from '@/components/features/member-profile/member-note-form-validation'
import {MEMBER_PROFILES_ROUTE_PATTERN} from '@/components/features/member-profile/member-profile-paths'
import {frenchDateToIso} from '@/components/ui/date-field-format'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  addMemberExchangeService,
  addMemberNoteService,
  deleteMemberNoteService,
  updateMemberExchangeService,
  updateMemberNoteService,
} from '@/services/facades/member-note-service-facade'
import {
  MEMBER_NOTE_KINDS,
  type MemberNoteChannel,
  type MemberNoteKind,
  type MemberNoteWriteResult,
} from '@/services/types/domain/member-note-types'
import {calendarDayOf} from '@/services/types/domain/water-analysis-types'

/**
 * Server Actions du fil « Notes et echanges » d'une fiche (s24, ADR 050).
 *
 * Meme patron que `actions.ts` : tenant du domaine, traductions, controle de
 * session, schema du formulaire, facade — le service reverifie
 * `member.note.manage` — puis revalidation du segment **apres** le succes
 * seulement. Les erreurs sont rendues en resultats ; le texte saisi n'est
 * jamais journalise ni recopie dans un message.
 */

type Translator = Awaited<ReturnType<typeof getTranslations>>

type NoteOperation = 'created' | 'updated' | 'deleted'

const readField = (formData: FormData, key: string): string =>
  formData.get(key)?.toString() ?? ''

const readNoteFields = (formData: FormData): MemberNoteFormSchemaType => ({
  body: readField(formData, 'body'),
  channel: readField(formData, 'channel'),
  entryDate: readField(formData, 'entryDate'),
})

const kindOf = (formData: FormData): MemberNoteKind | undefined => {
  const kind = readField(formData, 'kind')
  return (MEMBER_NOTE_KINDS as readonly string[]).includes(kind)
    ? (kind as MemberNoteKind)
    : undefined
}

const revalidateMemberProfileScreens = () => {
  revalidatePath(MEMBER_PROFILES_ROUTE_PATTERN, 'layout')
}

const failureOf = (
  error: unknown,
  t: Translator,
  kind: MemberNoteKind,
  operation: 'save' | 'delete'
): MemberNoteActionResult => ({
  status: 'error',
  message:
    error instanceof AuthorizationError
      ? t('errors.forbidden')
      : t(`detail.notes.failed.${operation}.${kind}`),
})

type ValidEntry =
  | {kind: 'note'; body: string}
  | {
      kind: 'exchange'
      body: string
      channel: MemberNoteChannel
      entryDate: string
    }

/** Le formulaire valide, ou ses erreurs champ par champ. */
const validateEntry = (
  formData: FormData,
  t: Translator,
  kind: MemberNoteKind
):
  | {valid: true; entry: ValidEntry}
  | {valid: false; result: MemberNoteActionResult} => {
  const validation = createMemberNoteFormSchema(
    t,
    kind,
    calendarDayOf(new Date())
  ).safeParse(readNoteFields(formData))
  const entryDate = validation.success
    ? frenchDateToIso(validation.data.entryDate)
    : undefined

  if (!validation.success) {
    return {
      valid: false,
      result: {
        status: 'invalid',
        errors: validation.error.issues.map((issue) => ({
          field: issue.path[0] as MemberNoteFormField,
          message: issue.message,
        })),
      },
    }
  }
  if (kind === 'note') {
    return {valid: true, entry: {kind, body: validation.data.body}}
  }
  return {
    valid: true,
    entry: {
      kind,
      body: validation.data.body,
      channel: validation.data.channel as MemberNoteChannel,
      entryDate: entryDate ?? '',
    },
  }
}

const toWriteResult = (
  result: MemberNoteWriteResult,
  t: Translator,
  kind: MemberNoteKind,
  operation: NoteOperation
): MemberNoteActionResult => {
  if (result.status === 'not_found') {
    return {status: 'error', message: t(`detail.notes.failed.save.${kind}`)}
  }
  revalidateMemberProfileScreens()
  return {
    status: 'saved',
    message: t(`detail.notes.saved.${kind}.${operation}`),
  }
}

/** Le perimetre de toute ecriture : la fiche, dans l'association du domaine. */
const scopeOf = (organizationId: string, formData: FormData) => ({
  organizationId,
  memberProfileId: readField(formData, 'memberProfileId'),
})

const createEntry = async (
  formData: FormData,
  kind: MemberNoteKind
): Promise<MemberNoteActionResult> => {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('BureauMemberProfilesPage')

  try {
    await requireActionAuth()

    const validation = validateEntry(formData, t, kind)
    if (!validation.valid) return validation.result

    const {entry} = validation
    const scope = scopeOf(tenant.id, formData)
    const result =
      entry.kind === 'note'
        ? await addMemberNoteService({...scope, body: entry.body})
        : await addMemberExchangeService({
            ...scope,
            entryDate: entry.entryDate,
            channel: entry.channel,
            body: entry.body,
          })
    return toWriteResult(result, t, kind, 'created')
  } catch (error) {
    return failureOf(error, t, kind, 'save')
  }
}

/** « Enregistrer la note » (etat d). */
export async function addMemberNoteAction(
  _prevState: MemberNoteActionResult | undefined,
  formData: FormData
): Promise<MemberNoteActionResult> {
  return createEntry(formData, 'note')
}

/** « Enregistrer l'echange » (etat e) : le jour est saisi `jj/mm/aaaa`. */
export async function addMemberExchangeAction(
  _prevState: MemberNoteActionResult | undefined,
  formData: FormData
): Promise<MemberNoteActionResult> {
  return createEntry(formData, 'exchange')
}

/**
 * « Enregistrer les modifications » (etat i). Le type lu du formulaire ne
 * choisit que le service : le service cible l'entree par son type, une note
 * ne devient jamais un echange.
 */
export async function updateMemberNoteAction(
  _prevState: MemberNoteActionResult | undefined,
  formData: FormData
): Promise<MemberNoteActionResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('BureauMemberProfilesPage')
  const kind = kindOf(formData)
  if (!kind) return {status: 'error', message: t('errors.failed')}

  try {
    await requireActionAuth()

    const validation = validateEntry(formData, t, kind)
    if (!validation.valid) return validation.result

    const {entry} = validation
    const target = {
      ...scopeOf(tenant.id, formData),
      noteId: readField(formData, 'noteId'),
    }
    const result =
      entry.kind === 'note'
        ? await updateMemberNoteService({...target, body: entry.body})
        : await updateMemberExchangeService({
            ...target,
            entryDate: entry.entryDate,
            channel: entry.channel,
            body: entry.body,
          })
    return toWriteResult(result, t, kind, 'updated')
  } catch (error) {
    return failureOf(error, t, kind, 'save')
  }
}

/** « Supprimer la note » / « Supprimer l'echange » (etat j). */
export async function deleteMemberNoteAction(
  _prevState: MemberNoteActionResult | undefined,
  formData: FormData
): Promise<MemberNoteActionResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('BureauMemberProfilesPage')
  const kind = kindOf(formData) ?? 'note'

  try {
    await requireActionAuth()

    const result = await deleteMemberNoteService({
      ...scopeOf(tenant.id, formData),
      noteId: readField(formData, 'noteId'),
    })
    if (result.status === 'not_found') {
      return failureOf(undefined, t, kind, 'delete')
    }
    revalidateMemberProfileScreens()
    return {
      status: 'deleted',
      message: t(`detail.notes.saved.${kind}.deleted`),
    }
  } catch (error) {
    return failureOf(error, t, kind, 'delete')
  }
}
