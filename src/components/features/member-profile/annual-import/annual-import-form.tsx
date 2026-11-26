'use client'

import {AlertTriangle, FileText, RefreshCw, Upload} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useRef, useState} from 'react'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {FileUpload} from '@/components/ui/file-upload'
import {Progress} from '@/components/ui/progress'
import {
  MEMBER_IMPORT_FILE_EXTENSION,
  MEMBER_IMPORT_MAX_FILE_BYTES,
} from '@/services/types/domain/member-import-types'
import {formatFileWeight} from '@/services/types/domain/water-analysis-types'

import {MEMBER_PROFILES_PATH} from '../member-profile-paths'
import type {MemberAnnualImportFormState} from './annual-import-state'

const FILE_FIELD_ID = 'member-annual-import-file'
const MISSING_ID = 'member-annual-import-missing'

type AnnualImportFormProps = {
  /** L'action du formulaire (`useActionState`), appelee avec le `FormData`. */
  formAction: (formData: FormData) => void
  pending: boolean
  /** Le dernier echec de l'action, a afficher au-dessus du formulaire. */
  state?: MemberAnnualImportFormState
}

/**
 * Ecran 1 du design s56 : deposer le fichier de l'annee, sans carte
 * « Association » — l'association est celle du domaine. Le bouton reste
 * desactive sans fichier, et le dit (1a). Pendant la mise a jour, tout est
 * fige et une barre indeterminee nomme le fichier (1c).
 */
export function AnnualImportForm({
  formAction,
  pending,
  state,
}: AnnualImportFormProps) {
  const t = useTranslations('BureauMemberAnnualImport')
  const [file, setFile] = useState<File>()
  const fileInput = useRef<HTMLInputElement>(null)

  const ready = file !== undefined
  const progressLabel = file
    ? t('progress', {file: file.name})
    : t('submitting')

  const submit = () => {
    if (!file) return
    const formData = new FormData()
    formData.set('file', file)
    formAction(formData)
  }

  return (
    <form
      className="flex w-full max-w-[880px] flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      {state && !state.success && (
        <FailureAlert state={state} onRetry={submit} canRetry={ready} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-[20px]">
            {t('file.cardTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p
            id={`${FILE_FIELD_ID}-help`}
            className="text-muted-foreground text-[14px]"
          >
            {t('file.help')}
          </p>
          <input
            ref={fileInput}
            id={FILE_FIELD_ID}
            type="file"
            accept={`${MEMBER_IMPORT_FILE_EXTENSION},text/csv`}
            tabIndex={-1}
            className="sr-only"
            aria-label={t('file.inputLabel')}
            aria-describedby={`${FILE_FIELD_ID}-help`}
            disabled={pending}
            onChange={(event) => setFile(event.target.files?.[0])}
          />
          {file && (
            <p className="flex items-center gap-2 text-[15px]">
              <FileText aria-hidden="true" className="size-5 shrink-0" />
              <span className="font-semibold">{file.name}</span>
              <span className="text-muted-foreground font-mono">
                {formatFileWeight(file.size)}
              </span>
            </p>
          )}
          {!file && (
            <div className="hidden [@media(pointer:fine)]:block">
              <FileUpload
                maxSize={MEMBER_IMPORT_MAX_FILE_BYTES}
                isUploading={pending}
                onChange={(files) => setFile(files[0])}
              />
            </div>
          )}
          {!pending && (
            <Button
              type="button"
              variant="outline"
              className="h-14 w-full sm:h-12 sm:w-auto sm:self-start"
              aria-describedby={`${FILE_FIELD_ID}-help`}
              onClick={() => fileInput.current?.click()}
            >
              <Upload aria-hidden="true" />
              {file ? t('file.chooseAnother') : t('file.choose')}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted shadow-none">
        <CardHeader>
          <CardTitle className="font-serif text-[20px]">
            {t('explain.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px]">
            <li>{t('explain.match')}</li>
            <li>{t('explain.contact')}</li>
            <li>{t('explain.holder')}</li>
            <li>{t('explain.parcels')}</li>
            <li>{t('explain.noEmail')}</li>
          </ul>
        </CardContent>
      </Card>

      {pending && (
        <div className="flex flex-col gap-2">
          <Progress aria-label={progressLabel} />
          <p className="text-muted-foreground text-[14px]">{progressLabel}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="submit"
            className="h-14 w-full sm:h-12 sm:w-auto sm:min-w-64"
            disabled={!ready || pending}
            aria-describedby={ready ? undefined : MISSING_ID}
          >
            {pending ? t('submitting') : t('submit')}
          </Button>
          {!pending && (
            <Button
              asChild
              variant="link"
              className="h-14 w-full sm:h-12 sm:w-auto"
            >
              <Link href={MEMBER_PROFILES_PATH}>{t('cancel')}</Link>
            </Button>
          )}
        </div>
        {!ready && !pending && (
          <p id={MISSING_ID} className="text-muted-foreground text-[14px]">
            {t('missingInput')}
          </p>
        )}
      </div>
    </form>
  )
}

/** Les etats 1d et 1e : l'alerte dit ce qui s'est passe et la suite. */
function FailureAlert({
  state,
  onRetry,
  canRetry,
}: {
  state: MemberAnnualImportFormState
  onRetry: () => void
  canRetry: boolean
}) {
  const t = useTranslations('BureauMemberAnnualImport')

  return (
    <Alert variant="destructive" className="border-2" role="alert">
      <AlertTriangle aria-hidden="true" />
      {state.title && <AlertTitle>{state.title}</AlertTitle>}
      <AlertDescription className="flex flex-col gap-1">
        {state.message && <p>{state.message}</p>}
        {state.detail && <p>{state.detail}</p>}
        {state.nextStep && <p>{state.nextStep}</p>}
        {state.error === 'failed' && (
          <Button
            type="button"
            variant="outline"
            className="mt-2 h-12 w-full sm:w-auto"
            disabled={!canRetry}
            onClick={onRetry}
          >
            <RefreshCw aria-hidden="true" />
            {t('retry')}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}
