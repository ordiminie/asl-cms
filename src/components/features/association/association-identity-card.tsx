'use client'

import {CircleAlert, CircleCheck, Upload} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useRef, useState} from 'react'

import type {AssociationIdentityFormState} from '@/app/[locale]/(bureau)/bureau/identite/actions'
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {FileUpload} from '@/components/ui/file-upload'
import {Progress} from '@/components/ui/progress'
import {
  AssociationIdentityKind,
  describeFileSize,
  IDENTITY_ACCEPTED_FORMATS,
  IDENTITY_FORMAT_CONTENT_TYPES,
  IDENTITY_MAX_BYTES,
} from '@/services/types/domain/association-identity-types'

import {AssociationMark} from './association-mark'

export type AssociationIdentityUploadAction = (
  prevState: AssociationIdentityFormState | undefined,
  formData: FormData
) => Promise<AssociationIdentityFormState>

type CardState =
  | {status: 'idle'}
  | {status: 'uploading'; fileName: string}
  | {status: 'success'; message: string}
  | {
      status: 'error'
      title?: string
      message?: string
      kept?: string
      nextStep?: string
    }

type AssociationIdentityCardProps = {
  kind: AssociationIdentityKind
  associationName: string
  /** Version du fichier actuel ; absente, l'association n'en a pas. */
  version?: string
  uploadAction: AssociationIdentityUploadAction
}

const identityUrl = (kind: AssociationIdentityKind, version?: string) =>
  version
    ? `/api/identity/${kind}?v=${encodeURIComponent(version)}`
    : `/api/identity/${kind}`

/**
 * Carte « Logo » ou « Favicon » de la page Identite (design s01b, ecran A) :
 * apercu, zone de depot et bouton, consignes annoncees avant tout echec, et
 * les quatre etats — vide, chargement, erreur, succes — ancres dans la carte.
 * Choisir un fichier lance l'envoi : aucun bouton `default`.
 */
export function AssociationIdentityCard({
  kind,
  associationName,
  version: initialVersion,
  uploadAction,
}: AssociationIdentityCardProps) {
  const t = useTranslations('BureauIdentityPage')
  const [version, setVersion] = useState(initialVersion)
  const [state, setState] = useState<CardState>({status: 'idle'})
  const inputRef = useRef<HTMLInputElement>(null)
  const isUploading = state.status === 'uploading'

  const formatSize = (bytes: number) => {
    const {unit, value} = describeFileSize(bytes)
    return t(`sizes.${unit}`, {value})
  }

  const notSaved = (reason: string): CardState => ({
    status: 'error',
    title: t('errors.notSaved'),
    message: reason,
    kept: version ? t(`errors.kept.${kind}`) : t(`errors.keptDefault.${kind}`),
    nextStep: t(`errors.chooseFormat.${kind}`),
  })

  const applyResult = (result: AssociationIdentityFormState) => {
    if (result.success) {
      setVersion(result.version ?? version)
      setState({status: 'success', message: result.message ?? ''})
      return
    }
    setState({
      status: 'error',
      title: result.title,
      message: result.message,
      kept: result.kept,
      nextStep: result.nextStep,
    })
  }

  const upload = async (file: File | undefined) => {
    if (!file || isUploading) return

    const maxBytes = IDENTITY_MAX_BYTES[kind]
    if (file.size > maxBytes) {
      setState(
        notSaved(
          t('errors.tooLarge', {
            size: formatSize(file.size),
            limit: formatSize(maxBytes),
          })
        )
      )
      return
    }

    setState({status: 'uploading', fileName: file.name})
    const formData = new FormData()
    formData.set('kind', kind)
    formData.set('file', file)

    try {
      applyResult(await uploadAction(undefined, formData))
    } catch {
      setState(notSaved(t('errors.failed')))
    }
  }

  const accept = IDENTITY_ACCEPTED_FORMATS[kind]
    .map((format) => IDENTITY_FORMAT_CONTENT_TYPES[format])
    .join(',')

  return (
    <Card className="gap-4 px-4 py-4 shadow-none sm:px-6 sm:py-6">
      <CardHeader className="gap-1 px-0">
        <CardTitle>
          <h3 className="text-xl leading-snug font-semibold">
            {t(`cards.${kind}.title`)}
          </h3>
        </CardTitle>
        {kind === 'favicon' && (
          <CardDescription className="text-[17px]">
            {t('cards.favicon.description')}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4 px-0">
        <div className="flex flex-col gap-3">
          {kind === 'logo' ? (
            <div className="bg-background self-start rounded-md border px-6 py-4">
              <AssociationMark
                name={associationName}
                logoVersion={version}
                size="public"
              />
            </div>
          ) : (
            <BrowserTabPreview
              label={t('cards.favicon.tabPreview')}
              iconUrl={identityUrl('favicon', version)}
              associationName={associationName}
            />
          )}
          {!version && (
            <p className="text-foreground text-[17px]">
              {t(`cards.${kind}.empty`)}
            </p>
          )}
        </div>

        <CardFeedback state={state} />

        <div className="flex flex-col items-stretch gap-3 lg:items-center">
          <div className="hidden w-full pointer-fine:block">
            <FileUpload
              onChange={(files) => upload(files[0])}
              isUploading={isUploading}
              maxSize={Number.POSITIVE_INFINITY}
            />
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            data-testid={`identity-file-input-${kind}`}
            disabled={isUploading}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              void upload(file)
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="h-14 w-full lg:h-12 lg:w-auto lg:min-w-53"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload aria-hidden="true" className="size-5" strokeWidth={1.75} />
            {isUploading ? t('upload.uploading') : t('upload.choose')}
          </Button>
          {state.status === 'uploading' && (
            <div className="flex w-full flex-col gap-2">
              <p className="text-foreground text-[15px]">
                {t('upload.progress', {fileName: state.fileName})}
              </p>
              <Progress
                value={null}
                aria-label={t('upload.progress', {fileName: state.fileName})}
                className="animate-pulse"
              />
            </div>
          )}
        </div>

        <p className="text-muted-foreground text-[15px]">
          {t(`cards.${kind}.guidelines`, {
            limit: formatSize(IDENTITY_MAX_BYTES[kind]),
          })}
        </p>
      </CardContent>
    </Card>
  )
}

function CardFeedback({state}: {state: CardState}) {
  if (state.status === 'success') {
    return (
      <Alert role="status">
        <CircleCheck className="text-primary" strokeWidth={1.75} />
        <AlertDescription className="text-foreground text-[17px]">
          {state.message}
        </AlertDescription>
      </Alert>
    )
  }

  if (state.status !== 'error') {
    return null
  }

  return (
    <Alert variant="destructive" className="border-destructive">
      <CircleAlert strokeWidth={1.75} />
      {state.title && (
        <AlertTitle className="text-[17px] font-semibold">
          {state.title}
        </AlertTitle>
      )}
      <AlertDescription className="text-foreground text-[17px]">
        <p>
          {state.message}
          {state.kept && (
            <>
              {' '}
              <strong>{state.kept}</strong>
            </>
          )}
          {state.nextStep && <> {state.nextStep}</>}
        </p>
      </AlertDescription>
    </Alert>
  )
}

function BrowserTabPreview({
  label,
  iconUrl,
  associationName,
}: {
  label: string
  iconUrl: string
  associationName: string
}) {
  return (
    <figure
      aria-label={label}
      className="flex w-full max-w-80 flex-col overflow-hidden rounded-md border"
    >
      <div className="bg-muted flex px-2 pt-2">
        <div className="bg-background flex h-10 w-55 max-w-full items-center gap-2 rounded-t-lg border border-b-0 px-3">
          {/* Route dynamique propre au domaine appele : l'optimiseur de next/image la resoudrait hors du tenant. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconUrl} alt="" className="size-5 shrink-0 rounded-sm" />
          <span className="text-foreground truncate text-[15px]">
            {associationName}
          </span>
        </div>
      </div>
      <div className="bg-background h-3 border-t" />
    </figure>
  )
}
