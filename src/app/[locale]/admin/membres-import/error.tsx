'use client'

import {AlertTriangle} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'

import {ORGANIZATIONS_PATH} from '@/components/features/admin/member-import/member-import-paths'
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'

/**
 * Etat 2f du design s13 : la page a echoue. L'import, s'il a eu lieu, est
 * termine ; relancer le meme fichier redonne le rapport sans rien doubler.
 */
export default function MemberImportError({reset}: {reset: () => void}) {
  const t = useTranslations('AdminMemberImport.report')

  return (
    <div className="flex w-full max-w-[720px] flex-col gap-6">
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
          <Link href={ORGANIZATIONS_PATH}>{t('backToOrganization')}</Link>
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
