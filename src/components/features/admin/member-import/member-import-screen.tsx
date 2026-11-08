'use client'

import {useTranslations} from 'next-intl'
import {startTransition, useActionState, useState} from 'react'

import {MemberImportForm} from './member-import-form'
import {MemberImportReport} from './member-import-report'
import type {
  MemberImportFormState,
  MemberImportOrganizationChoice,
} from './member-import-state'

type ImportAction = (
  prevState?: MemberImportFormState,
  formData?: FormData
) => Promise<MemberImportFormState>

type MemberImportScreenProps = {
  organizations: MemberImportOrganizationChoice[]
  initialOrganizationId?: string
  importAction: ImportAction
}

/**
 * Les deux ecrans de l'import (s13) sur une meme route : le formulaire, puis
 * le rapport rendu avec le resultat de l'action. « Importer un autre
 * fichier » revient au formulaire ; le rapport n'est garde nulle part.
 */
export function MemberImportScreen({
  organizations,
  initialOrganizationId,
  importAction,
}: MemberImportScreenProps) {
  const t = useTranslations('AdminMemberImport')
  const [state, dispatch, pending] = useActionState<
    MemberImportFormState | undefined,
    FormData
  >(importAction, undefined)
  const [dismissed, setDismissed] = useState<MemberImportFormState>()
  const [round, setRound] = useState(0)

  const report = state?.success && state !== dismissed ? state : undefined
  if (
    report?.report &&
    report.fileName &&
    report.organizationId &&
    report.importedAt
  ) {
    return (
      <MemberImportReport
        report={report.report}
        fileName={report.fileName}
        organizationId={report.organizationId}
        organizationName={
          organizations.find(({id}) => id === report.organizationId)?.name ?? ''
        }
        importedAt={report.importedAt}
        onImportAnother={() => {
          setDismissed(report)
          setRound((value) => value + 1)
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-[34px] leading-tight font-semibold">
        {t('title')}
      </h1>
      <MemberImportForm
        key={round}
        organizations={organizations}
        initialOrganizationId={state?.organizationId ?? initialOrganizationId}
        formAction={(formData) => startTransition(() => dispatch(formData))}
        pending={pending}
        state={state?.success ? undefined : state}
      />
    </div>
  )
}
