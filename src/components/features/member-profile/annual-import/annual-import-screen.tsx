'use client'

import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {startTransition, useActionState, useState} from 'react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

import {MEMBER_PROFILES_PATH} from '../member-profile-paths'
import {AnnualImportForm} from './annual-import-form'
import {AnnualImportReport} from './annual-import-report'
import type {MemberAnnualImportFormState} from './annual-import-state'

type ImportAction = (
  prevState?: MemberAnnualImportFormState,
  formData?: FormData
) => Promise<MemberAnnualImportFormState>

type AnnualImportScreenProps = {
  associationName: string
  importAction: ImportAction
}

/**
 * Les deux ecrans de la mise a jour annuelle (s56) sur une meme route : le
 * depot, puis le rapport rendu avec le resultat de l'action. « Importer un
 * autre fichier » revient au depot ; le rapport n'est garde nulle part.
 */
export function AnnualImportScreen({
  associationName,
  importAction,
}: AnnualImportScreenProps) {
  const t = useTranslations('BureauMemberAnnualImport')
  const [state, dispatch, pending] = useActionState<
    MemberAnnualImportFormState | undefined,
    FormData
  >(importAction, undefined)
  const [dismissed, setDismissed] = useState<MemberAnnualImportFormState>()
  const [round, setRound] = useState(0)

  const done = state?.success && state !== dismissed ? state : undefined

  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Breadcrumb aria-label={t('breadcrumb.label')}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={MEMBER_PROFILES_PATH}>{t('breadcrumb.parent')}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t('breadcrumb.current')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {done?.report && done.fileName && done.importedAt ? (
        <AnnualImportReport
          report={done.report}
          fileName={done.fileName}
          associationName={associationName}
          importedAt={done.importedAt}
          onImportAnother={() => {
            setDismissed(done)
            setRound((value) => value + 1)
          }}
        />
      ) : (
        <>
          <div className="flex max-w-[880px] flex-col gap-2">
            <h1 className="font-serif text-[34px] leading-tight font-semibold">
              {t('title')}
            </h1>
            <p className="text-muted-foreground text-[17px]">{t('intro')}</p>
          </div>
          <AnnualImportForm
            key={round}
            formAction={(formData) => startTransition(() => dispatch(formData))}
            pending={pending}
            state={state?.success ? undefined : state}
          />
        </>
      )}
    </div>
  )
}
