'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {AlertTriangle} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useEffect, useId, useState} from 'react'
import {Controller, type FieldErrors, useForm, useWatch} from 'react-hook-form'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {DateField, isoToFrenchDate} from '@/components/ui/date-field'
import {Label} from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {Textarea} from '@/components/ui/textarea'
import {
  MEMBER_NOTE_BODY_MAX,
  MEMBER_NOTE_CHANNELS,
  type MemberNoteDTO,
  type MemberNoteKind,
} from '@/services/types/domain/member-note-types'

import {
  charactersOverLimit,
  createMemberNoteFormSchema,
  memberNoteFieldsOf,
  type MemberNoteFormAction,
  type MemberNoteFormField,
  type MemberNoteFormSchemaType,
} from './member-note-form-validation'

type MemberNoteFormProps = {
  memberProfileId: string
  kind: MemberNoteKind
  /** L'entree modifiee ; absente a l'ajout. */
  note?: MemberNoteDTO
  /** Le jour calendaire de Paris, ISO : la date proposee a un echange. */
  today: string
  action: MemberNoteFormAction
  onCancel: () => void
  /** L'ecriture a reussi : la phrase de succes rendue par l'action. */
  onSaved: (message: string) => void
}

const ACTION_CLASS = 'h-14 w-full text-base sm:h-11 sm:w-auto'

const amount = new Intl.NumberFormat('fr-FR')

/** « Cette date… » -> « cette date… » : le message suit le libelle du champ. */
const lowerFirst = (message: string): string =>
  message.charAt(0).toLocaleLowerCase('fr') + message.slice(1)

/**
 * Formulaire d'une note ou d'un echange, a l'ajout comme a la modification
 * (s24, etats d a k). Une note n'a que son texte ; un echange a son jour,
 * son canal et son resume. La saisie reste dans le formulaire tant que
 * l'ecriture n'a pas reussi.
 */
export function MemberNoteForm({
  memberProfileId,
  kind,
  note,
  today,
  action,
  onCancel,
  onSaved,
}: MemberNoteFormProps) {
  const t = useTranslations('BureauMemberProfilesPage')
  const idPrefix = useId()
  const form = useForm<MemberNoteFormSchemaType>({
    resolver: zodResolver(createMemberNoteFormSchema(t, kind, today)),
    defaultValues: {
      body: note?.body ?? '',
      channel: note?.channel ?? '',
      entryDate:
        kind === 'exchange' ? isoToFrenchDate(note?.entryDate ?? today) : '',
    },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })
  const {errors, isSubmitting} = form.formState
  const [submitted, setSubmitted] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const fields = memberNoteFieldsOf(kind)
  const idOf = (field: MemberNoteFormField) => `${idPrefix}-${field}`
  const {setFocus} = form

  useEffect(() => {
    setFocus(fields[0])
  }, [fields, setFocus])

  const onValid = async (values: MemberNoteFormSchemaType) => {
    setFailure(null)
    const formData = new FormData()
    formData.set('memberProfileId', memberProfileId)
    if (note) formData.set('noteId', note.id)
    formData.set('kind', kind)
    formData.set('body', values.body)
    formData.set('channel', kind === 'exchange' ? values.channel : '')
    formData.set('entryDate', kind === 'exchange' ? values.entryDate : '')

    const result = await action(undefined, formData)
    if (result.status === 'invalid') {
      for (const error of result.errors) {
        form.setError(error.field, {message: error.message})
      }
    } else if (result.status === 'error') {
      setFailure(result.message)
    } else {
      onSaved(result.message)
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        setSubmitted(true)
        return form.handleSubmit(onValid)(event)
      }}
      className="flex flex-col gap-6"
    >
      {submitted && (
        <NoteErrorSummary
          kind={kind}
          fields={fields}
          errors={errors}
          idOf={idOf}
        />
      )}
      {failure && (
        <Alert
          variant="destructive"
          role="alert"
          className="border-destructive border-2 [&>svg]:size-5"
        >
          <AlertTriangle aria-hidden="true" />
          <AlertDescription className="text-foreground text-base">
            {failure}
          </AlertDescription>
        </Alert>
      )}

      {kind === 'exchange' && (
        <>
          <div className="flex flex-col gap-2">
            <Label
              htmlFor={idOf('entryDate')}
              className="text-base font-medium"
            >
              {t('detail.notes.fields.entryDate')}
            </Label>
            <p
              id={`${idOf('entryDate')}-help`}
              className="text-muted-foreground text-[15px]"
            >
              {t('detail.notes.fields.entryDateHelp')}
            </p>
            <Controller
              control={form.control}
              name="entryDate"
              render={({field}) => (
                <DateField
                  id={idOf('entryDate')}
                  ref={field.ref}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-describedby={`${idOf('entryDate')}-help`}
                  error={errors.entryDate?.message}
                />
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={idOf('channel')} className="text-base font-medium">
              {t('detail.notes.fields.channel')}
            </Label>
            <Controller
              control={form.control}
              name="channel"
              render={({field}) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger
                    id={idOf('channel')}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    aria-invalid={errors.channel ? true : undefined}
                    aria-describedby={
                      errors.channel ? `${idOf('channel')}-error` : undefined
                    }
                    className="w-full aria-invalid:border-2 sm:max-w-80"
                  >
                    <SelectValue
                      placeholder={t('detail.notes.fields.channelPlaceholder')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMBER_NOTE_CHANNELS.map((channel) => (
                      <SelectItem key={channel} value={channel}>
                        {t(`detail.notes.channels.${channel}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.channel && (
              <FieldError id={`${idOf('channel')}-error`}>
                {errors.channel.message}
              </FieldError>
            )}
          </div>
        </>
      )}

      <BodyField
        id={idOf('body')}
        label={t(`detail.notes.fields.body.${kind}`)}
        control={form.control}
        error={errors.body?.message}
        register={form.register('body')}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" disabled={isSubmitting} className={ACTION_CLASS}>
          {isSubmitting
            ? t('detail.notes.saving')
            : t(`detail.notes.save.${note ? 'edit' : kind}`)}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={ACTION_CLASS}
          onClick={onCancel}
        >
          {t('detail.notes.cancel')}
        </Button>
      </div>
    </form>
  )
}

/**
 * Le texte d'une note ou le resume d'un echange, avec son compteur : neutre
 * jusqu'au plafond, puis « N caracteres de trop. » au-dela (etat g).
 */
function BodyField({
  id,
  label,
  control,
  error,
  register,
}: {
  id: string
  label: string
  control: ReturnType<typeof useForm<MemberNoteFormSchemaType>>['control']
  error?: string
  register: ReturnType<
    ReturnType<typeof useForm<MemberNoteFormSchemaType>>['register']
  >
}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.notes')
  const body = (useWatch({control, name: 'body'}) as string | undefined) ?? ''
  const over = charactersOverLimit(body)
  const invalid = over > 0 || Boolean(error)
  const fieldError = over > 0 ? t('tooLong', {count: over}) : error
  const describedBy = [`${id}-counter`, fieldError && `${id}-error`]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-base font-medium">
        {label}
      </Label>
      <Textarea
        id={id}
        rows={4}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className="min-h-28 text-[17px] aria-invalid:border-2"
        {...register}
      />
      <p
        id={`${id}-counter`}
        className="text-muted-foreground self-end text-[15px] tabular-nums"
      >
        {t('counter', {
          count: amount.format(body.length),
          max: amount.format(MEMBER_NOTE_BODY_MAX),
        })}
      </p>
      {fieldError && <FieldError id={`${id}-error`}>{fieldError}</FieldError>}
    </div>
  )
}

function FieldError({id, children}: {id: string; children: React.ReactNode}) {
  return (
    <p id={id} className="text-destructive-text text-base font-semibold">
      {children}
    </p>
  )
}

/**
 * Resume ancre des erreurs (etat f) : « N champs a corriger. Rien n'a ete
 * enregistre. », chaque ligne portant le libelle du champ et menant a lui.
 */
function NoteErrorSummary({
  kind,
  fields,
  errors,
  idOf,
}: {
  kind: MemberNoteKind
  fields: readonly MemberNoteFormField[]
  errors: FieldErrors<MemberNoteFormSchemaType>
  idOf: (field: MemberNoteFormField) => string
}) {
  const t = useTranslations('BureauMemberProfilesPage')
  const invalid = fields.filter((field) => errors[field])

  if (invalid.length === 0) return null

  const labelOf = (field: MemberNoteFormField): string =>
    field === 'body'
      ? t(`detail.notes.fields.body.${kind}`)
      : t(`detail.notes.fields.${field}`)

  return (
    <Alert
      variant="destructive"
      role="alert"
      className="border-destructive border-2 [&>svg]:size-5"
    >
      <AlertTriangle aria-hidden="true" />
      <AlertTitle className="text-destructive-text line-clamp-none text-base font-bold">
        {t('summary', {count: invalid.length})}
      </AlertTitle>
      <AlertDescription className="text-foreground text-base">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {invalid.map((field) => (
            <li key={field}>
              <a
                href={`#${idOf(field)}`}
                className="underline underline-offset-4"
              >
                {t('detail.notes.summaryItem', {
                  label: labelOf(field),
                  message: lowerFirst(String(errors[field]?.message)),
                })}
              </a>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
