'use client'

import {CircleAlert, CircleCheck} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useId, useState, useTransition} from 'react'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {FileUpload} from '@/components/ui/file-upload'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Progress} from '@/components/ui/progress'
import {Textarea} from '@/components/ui/textarea'
import {
  BOARD_MEMBER_BIOGRAPHY_MAX_LENGTH,
  BoardMemberDTO,
  buildPortraitAlt,
  PORTRAIT_RENDERED_SIZE,
} from '@/services/types/domain/board-member-types'
import {
  CONTENT_FILE_MAX_BYTES,
  contentFileUrl,
} from '@/services/types/domain/content-file-types'

export type BoardMemberSaveState =
  | {status: 'saved'}
  | {status: 'rejected'; reason: 'format'}
  | {status: 'rejected'; reason: 'size'; size: number; maxBytes: number}
  | {status: 'error'; message: string}

type BoardMemberFormProps = {
  /** Absent : fiche neuve. Present : modification. */
  member?: BoardMemberDTO
  saveAction: (formData: FormData) => Promise<BoardMemberSaveState>
}

/** Le poids annonce dans la consigne est celui reellement applique. */
const MAX_MEGABYTES = Math.round(CONTENT_FILE_MAX_BYTES.image / (1024 * 1024))

const megabytes = (bytes: number): string =>
  (bytes / (1024 * 1024)).toFixed(1).replace('.', ',')

/**
 * Formulaire d'une fiche du bureau (design s06, ecran 2), a une colonne.
 *
 * La photo est transmise **avec** le formulaire, en un seul enregistrement :
 * la cle d'un fichier de contenu porte l'identifiant de la fiche, et une fiche
 * neuve n'en a pas encore. Effet de bord favorable : une fiche commencee puis
 * abandonnee ne laisse aucun fichier orphelin.
 *
 * Il n'y a **aucun champ de texte alternatif** : il se deduit du nom, et la
 * ligne sous l'apercu le dit en clair.
 */
export function BoardMemberForm({member, saveAction}: BoardMemberFormProps) {
  const t = useTranslations('BureauBoardPage.form')
  const nameId = useId()
  const roleId = useId()
  const biographyId = useId()

  const [name, setName] = useState(member?.name ?? '')
  const [roleLabel, setRoleLabel] = useState(member?.roleLabel ?? '')
  const [biography, setBiography] = useState(member?.biography ?? '')
  const [photo, setPhoto] = useState<File>()
  const [photoRemoved, setPhotoRemoved] = useState(false)
  /**
   * « Remplacer la photo » rouvre la zone de depot : sans cet etat, le bouton
   * n'aurait rien a changer sur une fiche qui a deja une photo, et le seul
   * chemin vers un nouveau portrait passerait par « Retirer » — que rien
   * n'annonce.
   */
  const [isChoosingPhoto, setIsChoosingPhoto] = useState(false)
  const [nameError, setNameError] = useState<string>()
  const [roleError, setRoleError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  /**
   * Une fiche neuve n'est creee qu'une fois : sans ce verrou, un second appui
   * sur « Enregistrer la fiche » creerait un doublon, l'ecran de creation
   * n'ayant pas d'identifiant a reutiliser.
   */
  const [created, setCreated] = useState(false)
  const [isPending, startTransition] = useTransition()

  const overflow = biography.length - BOARD_MEMBER_BIOGRAPHY_MAX_LENGTH
  const hasOverflow = overflow > 0
  const currentPhotoKey = photoRemoved ? null : (member?.photoKey ?? null)
  const previewSrc = photo
    ? undefined
    : currentPhotoKey
      ? contentFileUrl(currentPhotoKey)
      : undefined

  const submit = () => {
    // Le bouton est annonce desactive par `aria-disabled` (ecart 3 du design),
    // donc il reste cliquable : c'est ici que le clic devient un non-evenement,
    // sans effacer le message de succes deja affiche.
    if (isPending || created) return

    const trimmedName = name.trim()
    const trimmedRole = roleLabel.trim()

    setNameError(trimmedName === '' ? t('nameRequired') : undefined)
    setRoleError(trimmedRole === '' ? t('roleRequired') : undefined)
    setFormError(undefined)
    setNotice(undefined)

    if (trimmedName === '' || trimmedRole === '' || hasOverflow) {
      return
    }

    const formData = new FormData()
    formData.append('name', trimmedName)
    formData.append('roleLabel', trimmedRole)
    formData.append('biography', biography)
    if (member) formData.append('memberId', member.id)
    if (photo) formData.append('photo', photo)
    if (photoRemoved && !photo) formData.append('removePhoto', 'true')

    startTransition(async () => {
      try {
        const result = await saveAction(formData)

        if (result.status === 'saved') {
          setNotice(t('savedNotice'))
          // La photo deposee est **conservee** en etat : l'ancienne cle vient
          // d'etre effacee par le service, y retomber n'afficherait qu'une
          // image cassee jusqu'au rechargement.
          setIsChoosingPhoto(false)
          if (!member) setCreated(true)
          return
        }

        setFormError(
          result.status === 'error'
            ? result.message
            : result.reason === 'size'
              ? t('photoRejectedSize', {
                  size: megabytes(result.size),
                  maxSize: MAX_MEGABYTES,
                })
              : t('photoRejectedFormat')
        )
      } catch {
        setFormError(t('saveFailed'))
      }
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-[68ch] flex-col gap-6 px-4 pt-6 pb-12 sm:px-6">
      <Link href="/bureau/le-bureau" className="text-[15px] underline">
        ← {t('backToList')}
      </Link>

      <h1 className="font-serif text-[34px] leading-tight font-semibold text-pretty">
        {member ? t('editTitle', {name: member.name}) : t('newTitle')}
      </h1>
      <p className="text-muted-foreground text-[15px]">{t('visibleNotice')}</p>

      {notice && (
        <Alert>
          <CircleCheck className="text-primary" />
          <AlertDescription className="flex flex-wrap items-center gap-3">
            {notice}
            {created && (
              <Link href="/bureau/le-bureau" className="underline">
                {t('backToList')}
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}

      {formError && (
        <Alert variant="destructive" className="border-destructive">
          <CircleAlert strokeWidth={1.75} />
          <AlertTitle>{t('errorSummaryTitle')}</AlertTitle>
          <AlertDescription className="text-foreground">
            {formError}
          </AlertDescription>
        </Alert>
      )}

      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor={nameId}>{t('nameLabel')}</Label>
          <Input
            id={nameId}
            className="h-14 sm:h-12"
            value={name}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${nameId}-error` : undefined}
            onChange={(event) => setName(event.target.value)}
          />
          {nameError ? (
            <p
              id={`${nameId}-error`}
              role="alert"
              className="text-destructive text-[14px]"
            >
              {nameError}
            </p>
          ) : (
            <p className="text-muted-foreground text-[14px]">{t('nameHelp')}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={roleId}>{t('roleLabel')}</Label>
          <Input
            id={roleId}
            className="h-14 sm:h-12"
            value={roleLabel}
            aria-invalid={roleError ? true : undefined}
            aria-describedby={roleError ? `${roleId}-error` : undefined}
            onChange={(event) => setRoleLabel(event.target.value)}
          />
          {roleError ? (
            <p
              id={`${roleId}-error`}
              role="alert"
              className="text-destructive text-[14px]"
            >
              {roleError}
            </p>
          ) : (
            <p className="text-muted-foreground text-[14px]">{t('roleHelp')}</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-[15px] font-medium">
            {t('photoLabel')} —{' '}
            <span className="text-muted-foreground font-normal">
              {t('optional')}
            </span>
          </p>
          <p className="text-muted-foreground text-[14px]">
            {t('photoHelp', {maxSize: MAX_MEGABYTES})}
          </p>

          {(photo || previewSrc) && !isChoosingPhoto ? (
            <div className="flex flex-col gap-3">
              {previewSrc && (
                <Image
                  src={previewSrc}
                  alt={t('photoPreviewAlt')}
                  width={PORTRAIT_RENDERED_SIZE}
                  height={PORTRAIT_RENDERED_SIZE}
                  unoptimized
                  className="size-32 rounded-lg object-cover"
                />
              )}
              {photo && (
                <p className="text-muted-foreground text-[14px]">
                  {photo.name}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-14 sm:h-11"
                  onClick={() => setIsChoosingPhoto(true)}
                >
                  {t('photoReplace')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-14 sm:h-11"
                  onClick={() => {
                    setPhoto(undefined)
                    setPhotoRemoved(true)
                    setIsChoosingPhoto(false)
                  }}
                >
                  {t('photoRemove')}
                </Button>
              </div>
              <p className="text-muted-foreground text-[14px]">
                {t('photoAltNotice', {alt: buildPortraitAlt(name)})}
              </p>
            </div>
          ) : (
            <FileUpload
              onlyimage
              maxSize={CONTENT_FILE_MAX_BYTES.image}
              isUploading={isPending}
              onChange={(files) => {
                if (files[0]) {
                  setPhoto(files[0])
                  setPhotoRemoved(false)
                  setIsChoosingPhoto(false)
                }
              }}
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={biographyId}>
            {t('biographyLabel')} —{' '}
            <span className="text-muted-foreground font-normal">
              {t('optional')}
            </span>
          </Label>
          <p className="text-muted-foreground text-[14px]">
            {t('biographyHelp', {max: BOARD_MEMBER_BIOGRAPHY_MAX_LENGTH})}
          </p>
          <Textarea
            id={biographyId}
            rows={6}
            value={biography}
            aria-invalid={hasOverflow ? true : undefined}
            aria-describedby={`${biographyId}-counter`}
            className={hasOverflow ? 'border-destructive border-2' : undefined}
            onChange={(event) => setBiography(event.target.value)}
          />
          <p
            id={`${biographyId}-counter`}
            className={
              hasOverflow
                ? 'text-destructive text-right text-[14px] font-semibold tabular-nums'
                : 'text-muted-foreground text-right text-[14px] tabular-nums'
            }
          >
            {t('biographyCounter', {
              count: biography.length,
              max: BOARD_MEMBER_BIOGRAPHY_MAX_LENGTH,
            })}
          </p>
          {hasOverflow && (
            <p role="alert" className="text-destructive text-[14px]">
              {t('biographyOverflow', {over: overflow})}
            </p>
          )}
        </div>

        {isPending && (
          <div className="flex flex-col gap-2">
            <Progress
              aria-label={
                photo ? t('savingFile', {fileName: photo.name}) : t('saving')
              }
            />
            <p className="text-muted-foreground text-[14px]">
              {photo ? t('savingFile', {fileName: photo.name}) : t('saving')}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            className="h-14 min-w-[216px] aria-disabled:pointer-events-none aria-disabled:opacity-45 sm:h-12"
            aria-disabled={isPending || created || undefined}
          >
            {isPending ? t('saving') : t('save')}
          </Button>
          <Button asChild variant="outline" className="h-14 sm:h-12">
            <Link href="/bureau/le-bureau">{t('cancel')}</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
