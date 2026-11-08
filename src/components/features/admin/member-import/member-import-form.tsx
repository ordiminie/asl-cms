'use client'

import {AlertTriangle, FileText, Upload} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useRef, useState} from 'react'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {FileUpload} from '@/components/ui/file-upload'
import {Label} from '@/components/ui/label'
import {Progress} from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MEMBER_IMPORT_FILE_EXTENSION,
  MEMBER_IMPORT_MAX_FILE_BYTES,
} from '@/services/types/domain/member-import-types'
import {formatFileWeight} from '@/services/types/domain/water-analysis-types'

import {organizationEditPathOf, ORGANIZATIONS_PATH} from './member-import-paths'
import type {
  MemberImportFormState,
  MemberImportOrganizationChoice,
} from './member-import-state'

const FIELD_IDS = {
  organization: 'member-import-organization',
  file: 'member-import-file',
} as const

type MemberImportFormProps = {
  organizations: MemberImportOrganizationChoice[]
  initialOrganizationId?: string
  /** L'action du formulaire (`useActionState`), appelee avec le `FormData`. */
  formAction: (formData: FormData) => void
  pending: boolean
  /** Le dernier echec de l'action, a afficher au-dessus du formulaire. */
  state?: MemberImportFormState
}

/**
 * Ecran 1 du design s13 : choisir l'association, deposer le fichier, lancer
 * l'import. Le bouton reste desactive tant qu'il manque l'un des deux, et le
 * dit (1a). Pendant l'import, tout est fige et une barre indeterminee nomme
 * le fichier (1c) : une Server Action ne rend aucun avancement.
 */
export function MemberImportForm({
  organizations,
  initialOrganizationId,
  formAction,
  pending,
  state,
}: MemberImportFormProps) {
  const t = useTranslations('AdminMemberImport')
  const [organizationId, setOrganizationId] = useState(
    initialOrganizationId ?? ''
  )
  const [file, setFile] = useState<File>()
  const fileInput = useRef<HTMLInputElement>(null)

  const ready = organizationId !== '' && file !== undefined
  const organizationMissing = state?.error === 'organization_missing'
  const progressLabel = file
    ? t('progress', {file: file.name})
    : t('submitting')

  const submit = () => {
    if (!ready) return
    const formData = new FormData()
    formData.set('organizationId', organizationId)
    formData.set('file', file)
    formAction(formData)
  }

  return (
    <form
      className="flex w-full max-w-[720px] flex-col gap-6"
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
            {t('organization.cardTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Label htmlFor={FIELD_IDS.organization}>
            {t('organization.label')}
          </Label>
          <Select
            value={organizationId}
            onValueChange={setOrganizationId}
            disabled={pending}
          >
            <SelectTrigger
              id={FIELD_IDS.organization}
              aria-invalid={organizationMissing ? true : undefined}
              aria-describedby={`${FIELD_IDS.organization}-help`}
            >
              <SelectValue placeholder={t('organization.placeholder')} />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((organization) => (
                <SelectItem key={organization.id} value={organization.id}>
                  {organization.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {organizationMissing && (
            <p className="text-destructive-text text-[16px] font-medium">
              {t('organization.missing')}
            </p>
          )}
          <p
            id={`${FIELD_IDS.organization}-help`}
            className="text-muted-foreground text-[14px]"
          >
            {t('organization.help')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-[20px]">
            {t('file.cardTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p
            id={`${FIELD_IDS.file}-help`}
            className="text-muted-foreground text-[14px]"
          >
            {t('file.help')}
          </p>
          <input
            ref={fileInput}
            id={FIELD_IDS.file}
            type="file"
            accept={`${MEMBER_IMPORT_FILE_EXTENSION},text/csv`}
            tabIndex={-1}
            className="sr-only"
            aria-label={t('file.inputLabel')}
            aria-describedby={`${FIELD_IDS.file}-help`}
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
              aria-describedby={`${FIELD_IDS.file}-help`}
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
            <li>{t('explain.oneMember')}</li>
            <li>{t('explain.noContact')}</li>
            <li>{t('explain.mailOnly')}</li>
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
            aria-describedby={ready ? undefined : 'member-import-missing'}
          >
            {pending ? t('submitting') : t('submit')}
          </Button>
          {!pending && (
            <Button
              asChild
              variant="link"
              className="h-14 w-full sm:h-12 sm:w-auto"
            >
              <Link
                href={
                  organizationId
                    ? organizationEditPathOf(organizationId)
                    : ORGANIZATIONS_PATH
                }
              >
                {t('cancel')}
              </Link>
            </Button>
          )}
        </div>
        {!ready && !pending && (
          <p
            id="member-import-missing"
            className="text-muted-foreground text-[14px]"
          >
            {missingSentence(t, state)}
          </p>
        )}
      </div>
    </form>
  )
}

const missingSentence = (
  t: ReturnType<typeof useTranslations>,
  state?: MemberImportFormState
): string => {
  if (state?.error === 'file_unreadable') return t('missingFile')
  if (state?.error === 'organization_missing') return t('missingOrganization')
  return t('missingInput')
}

/** Les etats 1d, 1e et 1f : l'alerte dit ce qui s'est passe et la suite. */
function FailureAlert({
  state,
  onRetry,
  canRetry,
}: {
  state: MemberImportFormState
  onRetry: () => void
  canRetry: boolean
}) {
  const t = useTranslations('AdminMemberImport')

  return (
    <Alert variant="destructive" className="border-2">
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
            {t('retry')}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}
