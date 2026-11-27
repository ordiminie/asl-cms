'use client'

import {AlertTriangle} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'

import {MEMBER_PROFILES_PATH} from '@/components/features/member-profile/member-profile-paths'
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'

/**
 * Etat 2d du design s56 : la page a echoue. La mise a jour, si elle a eu
 * lieu, est terminee ; relancer le meme fichier redonne le rapport sans rien
 * changer de plus.
 */
export default function AnnualImportError({reset}: {reset: () => void}) {
  const t = useTranslations('BureauMemberAnnualImport.report')

  return (
    <div className="flex w-full max-w-[880px] flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <h1 className="font-serif text-[34px] leading-tight font-semibold">
        {t('title')}
      </h1>
      <Alert variant="destructive" className="border-2">
        <AlertTriangle aria-hidden="true" />
        <AlertTitle>{t('pageError')}</AlertTitle>
        <AlertDescription>{t('pageErrorNext')}</AlertDescription>
      </Alert>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild className="h-14 w-full sm:h-12 sm:w-auto">
          <Link href={MEMBER_PROFILES_PATH}>{t('backToList')}</Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-14 w-full sm:h-12 sm:w-auto"
          onClick={reset}
        >
          {t('importAnother')}
        </Button>
      </div>
    </div>
  )
}
