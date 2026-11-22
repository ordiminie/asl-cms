'use client'

import {CircleAlert} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useState, useTransition} from 'react'

import {Alert, AlertDescription} from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {Button, buttonVariants} from '@/components/ui/button'

import type {SharedDocumentFormState} from './shared-document-form-validation'

/** Un `redirect()` de Next voyage avec un `digest` prefixe `NEXT_REDIRECT`. */
const isNavigationSignal = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'digest' in error &&
  String((error as {digest: unknown}).digest).startsWith('NEXT_REDIRECT')

/**
 * « Retirer » un document (design s31, 2c) : irreversible, donc un
 * `alert-dialog` dont le bouton nomme l'acte. Le succes renvoie a la liste
 * avec l'alerte de retrait ; un echec est dit sous le bouton.
 */
export function RemoveSharedDocumentButton({
  documentId,
  title,
  deleteAction,
}: {
  documentId: string
  title: string
  deleteAction: (documentId: string) => Promise<SharedDocumentFormState>
}) {
  const t = useTranslations('BureauSharedDocumentsPage')
  const [isPending, startRemoving] = useTransition()
  const [error, setError] = useState<string>()

  const confirm = () => {
    setError(undefined)
    startRemoving(async () => {
      try {
        const result = await deleteAction(documentId)
        if (result.status === 'error') setError(result.message)
      } catch (caught) {
        if (isNavigationSignal(caught)) return
        throw caught
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-14 w-full sm:h-11 sm:w-auto"
            disabled={isPending}
          >
            {isPending ? t('deleteDialog.pending') : t('remove')}
            <span className="sr-only"> {t('removeLabel', {title})}</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('deleteDialog.title', {title})}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({variant: 'destructive'})}
              onClick={confirm}
            >
              {t('deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && (
        <Alert variant="destructive">
          <CircleAlert strokeWidth={1.75} />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
