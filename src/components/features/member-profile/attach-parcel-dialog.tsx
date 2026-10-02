'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {AlertTriangle} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {type ChangeEvent, useState} from 'react'
import {Controller, useForm} from 'react-hook-form'

import {Alert, AlertDescription} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {
  DateField,
  frenchDateToIso,
  isoToFrenchDate,
} from '@/components/ui/date-field'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {
  isOwnershipDateInFuture,
  lastOwnershipDayOf,
} from '@/services/rules/parcel-ownership-rules'
import type {MemberProfileDTO} from '@/services/types/domain/member-profile-types'
import type {OwnershipConflictDTO} from '@/services/types/domain/parcel-ownership-types'

import {
  type AttachParcelActionResult,
  type AttachParcelFormSchemaType,
  createAttachParcelFormSchema,
} from './member-profile-form-validation'
import {memberProfilePathOf} from './member-profile-paths'

export type AttachParcelFormAction = (
  prevState: AttachParcelActionResult | undefined,
  formData: FormData
) => Promise<AttachParcelActionResult>

export type AttachedParcel = Extract<
  AttachParcelActionResult,
  {status: 'attached'}
>

type AttachParcelDialogProps = {
  profile: Pick<MemberProfileDTO, 'id' | 'name'>
  /** Le jour calendaire de Paris, ISO : la date proposee, et la plus tardive. */
  today: string
  open: boolean
  onClose: () => void
  onAttached: (result: AttachedParcel) => void
  action: AttachParcelFormAction
}

const NUMBER_ID = 'attach-parcel-number'
const DATE_ID = 'attach-parcel-starts-on'

/**
 * Rattacher une parcelle (ecran 4 du design s12) : un `dialog` a deux champs,
 * la limite du `dialog`. « Annuler » ecrit, pas de croix ; Echap ferme. Sous
 * 640 px il est ancre en bas, pleine largeur, boutons de 56 px empiles, le
 * principal en premier (gap 4).
 */
export function AttachParcelDialog({
  profile,
  today,
  open,
  onClose,
  onAttached,
  action,
}: AttachParcelDialogProps) {
  const t = useTranslations('BureauMemberProfilesPage.attachDialog')

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none"
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {t('title', {name: profile.name})}
          </DialogTitle>
        </DialogHeader>
        {open && (
          <AttachParcelForm
            profile={profile}
            today={today}
            onCancel={onClose}
            onAttached={onAttached}
            action={action}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

type Overlap = {parcelNumber: string; conflict: OwnershipConflictDTO}

function AttachParcelForm({
  profile,
  today,
  onCancel,
  onAttached,
  action,
}: Omit<AttachParcelDialogProps, 'open' | 'onClose'> & {onCancel: () => void}) {
  const t = useTranslations('BureauMemberProfilesPage')
  const form = useForm<AttachParcelFormSchemaType>({
    resolver: zodResolver(createAttachParcelFormSchema(t)),
    defaultValues: {parcelNumber: '', startsOn: isoToFrenchDate(today)},
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })
  const {errors, isSubmitting} = form.formState
  const [overlap, setOverlap] = useState<Overlap | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  /**
   * Le numero s'ecrit en majuscules pendant la saisie : c'est sous cette
   * forme que le service l'enregistre. Le curseur reste ou il etait.
   */
  const showUpperCase = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    const {selectionStart, selectionEnd} = input
    form.setValue('parcelNumber', input.value.toUpperCase())
    input.setSelectionRange(selectionStart, selectionEnd)
  }

  const refuseFutureDate = () =>
    form.setError('startsOn', {message: t('validation.dateFuture')})

  const onValid = async (values: AttachParcelFormSchemaType) => {
    setOverlap(null)
    setFailure(null)

    const startsOn = frenchDateToIso(values.startsOn)
    if (startsOn && isOwnershipDateInFuture(startsOn, today)) {
      refuseFutureDate()
      return
    }

    const formData = new FormData()
    formData.set('memberProfileId', profile.id)
    formData.set('parcelNumber', values.parcelNumber)
    formData.set('startsOn', values.startsOn)

    const result = await action(undefined, formData)
    if (result.status === 'invalid') {
      for (const error of result.errors) {
        form.setError(error.field, {message: error.message})
      }
    } else if (result.status === 'overlap') {
      setOverlap(result)
    } else if (result.status === 'future_date') {
      refuseFutureDate()
    } else if (result.status === 'error') {
      setFailure(result.message)
    } else {
      onAttached(result)
    }
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onValid)}
      className="flex flex-col gap-6"
    >
      {overlap && <OverlapAlert overlap={overlap} />}
      {failure && (
        <Alert variant="destructive" className="border-2">
          <AlertTriangle aria-hidden="true" />
          <AlertDescription className="text-foreground text-base">
            {failure}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={NUMBER_ID} className="text-base font-medium">
          {t('attachDialog.parcelNumber')}
        </Label>
        <Input
          id={NUMBER_ID}
          autoComplete="off"
          aria-invalid={errors.parcelNumber || overlap ? true : undefined}
          aria-describedby={
            errors.parcelNumber ? `${NUMBER_ID}-error` : undefined
          }
          className="h-14 max-w-60 font-mono text-[18px] font-medium tabular-nums aria-invalid:border-2 sm:h-12"
          {...form.register('parcelNumber', {onChange: showUpperCase})}
        />
        {errors.parcelNumber && (
          <p
            id={`${NUMBER_ID}-error`}
            className="text-destructive-text text-base font-medium"
          >
            {errors.parcelNumber.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={DATE_ID} className="text-base font-medium">
          {t('attachDialog.startsOn')}
        </Label>
        <Controller
          control={form.control}
          name="startsOn"
          render={({field}) => (
            <DateField
              id={DATE_ID}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              placeholder={t('attachDialog.dateFormat')}
              error={errors.startsOn?.message}
            />
          )}
        />
      </div>

      <DialogFooter className="gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-14 text-base sm:h-11"
          onClick={onCancel}
        >
          {t('attachDialog.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-14 text-base sm:h-11"
        >
          {isSubmitting
            ? t('attachDialog.submitting')
            : t('attachDialog.submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * Chevauchement refuse (etat `4c`, critere 4) : dit qui possede la parcelle et
 * depuis quand, que rien n'est enregistre (les champs restent remplis), et
 * mene a la fiche du proprietaire en place.
 */
function OverlapAlert({overlap}: {overlap: Overlap}) {
  const t = useTranslations('BureauMemberProfilesPage')
  const {parcelNumber, conflict} = overlap

  return (
    <Alert
      variant="destructive"
      className="border-destructive border-2 [&>svg]:size-5"
    >
      <AlertTriangle aria-hidden="true" />
      <AlertDescription className="text-foreground text-base">
        <p>
          {conflict.endsOn === null
            ? t('attachDialog.overlapOpen', {
                number: parcelNumber,
                name: conflict.name,
                date: isoToFrenchDate(conflict.startsOn),
              })
            : t('attachDialog.overlapClosed', {
                number: parcelNumber,
                name: conflict.name,
                from: isoToFrenchDate(conflict.startsOn),
                to: isoToFrenchDate(lastOwnershipDayOf(conflict.endsOn)),
              })}
        </p>
        <Link
          href={memberProfilePathOf(conflict.memberProfileId)}
          className="underline underline-offset-4"
        >
          {t('openProfileOf', {name: conflict.name})}
        </Link>
      </AlertDescription>
    </Alert>
  )
}
