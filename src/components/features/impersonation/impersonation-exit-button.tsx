'use client'

import {LogOut} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useTransition} from 'react'
import {toast} from 'sonner'

import {Button} from '@/components/ui/button'
import {reloadPageAt} from '@/lib/helper/page-navigation.client'

export type StopImpersonationActionResult =
  {success: true; url: string} | {success: false; message: string}

/**
 * « Revenir a mon compte » hors de la banniere (s48, ecran 5) : rend la
 * session SuperAdmin d'origine, puis recharge la page entiere (D10).
 */
export function ImpersonationExitButton({
  stopAction,
}: {
  stopAction: () => Promise<StopImpersonationActionResult>
}) {
  const t = useTranslations('Impersonation.bar')
  const [isPending, startTransition] = useTransition()

  const exit = () =>
    startTransition(async () => {
      const result = await stopAction()
      if (result.success) {
        reloadPageAt(result.url)
        return
      }
      toast.error(result.message)
    })

  return (
    <Button
      type="button"
      variant="outline"
      onClick={exit}
      disabled={isPending}
      className="max-sm:h-14 max-sm:w-full"
    >
      <LogOut className="size-5" aria-hidden="true" />
      {t('exit')}
    </Button>
  )
}
