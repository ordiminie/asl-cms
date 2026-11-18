'use client'

import {useRouter} from 'next/navigation'
import {useTranslations} from 'next-intl'
import {useState, useTransition} from 'react'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {Button} from '@/components/ui/button'
import type {DeleteRecipientGroupActionResult} from '@/services/types/domain/recipient-group-types'

import {deletedRecipientGroupPathOf} from './recipient-group-paths'

export type DeleteRecipientGroupAction = (
  state: DeleteRecipientGroupActionResult | undefined,
  formData: FormData
) => Promise<DeleteRecipientGroupActionResult>

/**
 * « Supprimer le groupe » (ecran 3 de s27) : un `alert-dialog` dont le
 * bouton `destructive` nomme l'acte. Les fiches et les campagnes deja
 * envoyees ne sont pas touchees (critere 6) ; la liste dit la suppression.
 */
export function DeleteRecipientGroupDialog({
  groupId,
  name,
  profileCount,
  action,
}: {
  groupId: string
  name: string
  profileCount: number
  action: DeleteRecipientGroupAction
}) {
  const t = useTranslations('RecipientGroupsBureau')
  const router = useRouter()
  const [failure, setFailure] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const confirm = () =>
    startTransition(async () => {
      const formData = new FormData()
      formData.set('groupId', groupId)
      const result = await action(undefined, formData)
      if (result.status === 'error') {
        setFailure(result.message)
        return
      }
      router.push(deletedRecipientGroupPathOf(name))
    })

  return (
    <AlertDialog onOpenChange={(open) => open && setFailure(null)}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="h-14 w-full sm:h-11 sm:w-auto">
          {t('manage.delete')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deleteDialog.title', {name})}</AlertDialogTitle>
          <AlertDialogDescription className="text-[17px]">
            {t('deleteDialog.description', {count: profileCount})}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {failure && (
          <p role="alert" className="text-destructive-text text-[15px]">
            {failure}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel className="h-14 sm:h-11">
            {t('deleteDialog.cancel')}
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            className="h-14 sm:h-11"
            disabled={pending}
            onClick={confirm}
          >
            {t('deleteDialog.confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
