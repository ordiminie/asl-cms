'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {useRouter} from 'next/navigation'
import {useTranslations} from 'next-intl'
import {useId, useState} from 'react'
import {useForm} from 'react-hook-form'

import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {cn} from '@/lib/utils'
import type {RecipientGroupNameActionResult} from '@/services/types/domain/recipient-group-types'
import {
  createRecipientGroupFormSchema,
  type RecipientGroupFormValues,
} from '@/services/validation/recipient-group-validation'

import {recipientGroupPathOf} from './recipient-group-paths'

export type RecipientGroupNameAction = (
  state: RecipientGroupNameActionResult | undefined,
  formData: FormData
) => Promise<RecipientGroupNameActionResult>

type RecipientGroupNameDialogProps = {
  /** Creer ouvre le groupe cree ; renommer rafraichit la page du groupe. */
  mode: 'create' | 'rename'
  action: RecipientGroupNameAction
  triggerLabel: string
  triggerVariant?: 'default' | 'outline'
  groupId?: string
  defaultName?: string
}

/**
 * « Nom du groupe » (ecran 3 de s27) : un dialogue a un champ, ancre en bas
 * sous 640 px (§3.11). L'erreur — nom vide, trop long, deja pris — s'ancre
 * sous le champ, bordure `destructive` 2 px.
 */
export function RecipientGroupNameDialog({
  mode,
  action,
  triggerLabel,
  triggerVariant = 'default',
  groupId,
  defaultName = '',
}: RecipientGroupNameDialogProps) {
  const t = useTranslations('RecipientGroupsBureau')
  const router = useRouter()
  const fieldId = useId()
  const [open, setOpen] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<RecipientGroupFormValues>({
    resolver: zodResolver(createRecipientGroupFormSchema(t)),
    defaultValues: {name: defaultName},
  })
  const error = form.formState.errors.name?.message

  const onValid = async (values: RecipientGroupFormValues) => {
    setFailure(null)
    const formData = new FormData()
    formData.set('name', values.name)
    if (groupId) formData.set('groupId', groupId)

    const result = await action(undefined, formData)
    if (result.status === 'invalid') {
      form.setError('name', {message: result.message})
      return
    }
    if (result.status === 'error') {
      setFailure(result.message)
      return
    }
    setOpen(false)
    if (mode === 'create') router.push(recipientGroupPathOf(result.group.id))
    else router.refresh()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          form.reset({name: defaultName})
          setFailure(null)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant={triggerVariant}
          className="h-14 w-full sm:h-11 sm:w-auto"
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? t('nameDialog.createTitle')
              : t('nameDialog.renameTitle')}
          </DialogTitle>
          <DialogDescription className="text-[15px]">
            {t('nameDialog.help')}
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(event) => void form.handleSubmit(onValid)(event)}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={fieldId} className="text-[17px]">
              {t('nameDialog.label')}
            </Label>
            <Input
              id={fieldId}
              {...form.register('name')}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${fieldId}-error` : undefined}
              className={cn(
                'h-14 text-[18px] sm:h-11 sm:text-[17px]',
                error && 'border-destructive border-2'
              )}
            />
            {error && (
              <p
                id={`${fieldId}-error`}
                className="text-destructive-text text-[15px] font-medium"
              >
                {error}
              </p>
            )}
          </div>
          {failure && (
            <p role="alert" className="text-destructive-text text-[15px]">
              {failure}
            </p>
          )}
          <DialogFooter className="flex-col gap-3 sm:flex-row">
            <Button
              type="submit"
              className="h-14 w-full sm:h-11 sm:w-auto"
              disabled={form.formState.isSubmitting}
            >
              {mode === 'create'
                ? t('nameDialog.createSubmit')
                : t('nameDialog.renameSubmit')}
            </Button>
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className="h-14 w-full sm:h-11 sm:w-auto"
              >
                {t('nameDialog.cancel')}
              </Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
