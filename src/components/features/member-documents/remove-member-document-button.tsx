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

import type {MemberDocumentFormState} from './member-document-form-validation'
import type {MemberDocumentRemovalOrigin} from './member-document-paths'

export type RemoveMemberDocumentAction = (
  documentId: string,
  origin: MemberDocumentRemovalOrigin
) => Promise<MemberDocumentFormState>

/** Un `redirect()` de Next voyage avec un `digest` prefixe `NEXT_REDIRECT`. */
const isNavigationSignal = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'digest' in error &&
  String((error as {digest: unknown}).digest).startsWith('NEXT_REDIRECT')

/**
 * « Retirer » un document nominatif (design s32, 2f) : irreversible, donc un
 * `alert-dialog` qui nomme le document **et** la fiche. Le succes renvoie la
 * ou le retrait a ete demande, avec l'alerte ; un echec est dit sous le
 * bouton.
 */
export function RemoveMemberDocumentButton({
  documentId,
  title,
  memberName,
  origin,
  removeAction,
}: {
  documentId: string
  title: string
  memberName: string
  origin: MemberDocumentRemovalOrigin
  removeAction: RemoveMemberDocumentAction
}) {
  const t = useTranslations('BureauMemberDocuments')
  const [isPending, startRemoving] = useTransition()
  const [error, setError] = useState<string>()

  const confirm = () => {
    setError(undefined)
    startRemoving(async () => {
      try {
        const result = await removeAction(documentId, origin)
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
            {isPending ? t('removeDialog.pending') : t('remove')}
            <span className="sr-only">
              {' '}
              {t('removeLabel', {title, name: memberName})}
            </span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('removeDialog.title', {title, name: memberName})}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('removeDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('removeDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({variant: 'destructive'})}
              onClick={confirm}
            >
              {t('removeDialog.confirm')}
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
