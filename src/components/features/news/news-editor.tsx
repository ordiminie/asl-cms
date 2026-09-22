'use client'

import {CircleCheck} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useId, useState, useTransition} from 'react'

import {
  NewsImageUploadState,
  NewsInput,
  NewsPublishState,
  NewsSaveState,
  NewsUnpublishState,
} from '@/app/[locale]/(bureau)/bureau/actualites/[id]/actions'
import {RestrictedMarkdownEditor} from '@/components/features/pages/blocks/restricted-markdown-editor'
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
import {Button} from '@/components/ui/button'
import {FileUpload} from '@/components/ui/file-upload'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {PreviewBar, PreviewBarStatus} from '@/components/ui/preview-bar'
import {Progress} from '@/components/ui/progress'
import {contentFileUrl} from '@/services/types/domain/content-file-types'
import {
  NewsDTO,
  NewsPublicationErrorConst,
} from '@/services/types/domain/news-types'

type NewsEditorProps = {
  news: NewsDTO
  saveAction: (input: NewsInput) => Promise<NewsSaveState>
  publishAction: (input: NewsInput) => Promise<NewsPublishState>
  unpublishAction: (input: {newsId: string}) => Promise<NewsUnpublishState>
  uploadAction: (formData: FormData) => Promise<NewsImageUploadState>
}

const persistedStatus = (status: NewsDTO['status']): PreviewBarStatus =>
  status === 'published' ? 'live' : status === 'draft' ? 'draft' : 'unpublished'

/**
 * Editeur d'une actualite (ecran 2 du design s05).
 *
 * Quatre champs fixes (ADR 007), la barre d'apercu et l'editeur a barre
 * reduite de s04 sans variante. L'adresse est en lecture seule : elle est
 * fixee au premier enregistrement titre et ne change plus (ADR 023).
 */
export function NewsEditor({
  news,
  saveAction,
  publishAction,
  unpublishAction,
  uploadAction,
}: NewsEditorProps) {
  const t = useTranslations('BureauNewsPage.editor')
  const titleId = useId()
  const dateId = useId()
  const altId = useId()
  const replaceId = useId()

  const [saved, setSaved] = useState(news)
  const [title, setTitle] = useState(news.title)
  const [publishedOn, setPublishedOn] = useState(news.publishedOn)
  const [content, setContent] = useState(news.content)
  const [imageAlt, setImageAlt] = useState(news.imageAlt)
  const [imageKey, setImageKey] = useState(news.imageKey)
  const [uploadingName, setUploadingName] = useState<string>()
  const [isDirty, setIsDirty] = useState(false)
  const [altError, setAltError] = useState<string>()
  const [barError, setBarError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [isPending, startTransition] = useTransition()

  const status: PreviewBarStatus = barError
    ? 'error'
    : isPending
      ? 'publishing'
      : isDirty
        ? 'dirty'
        : persistedStatus(saved.status)

  const payload = (): NewsInput => ({
    newsId: news.id,
    title,
    publishedOn,
    content,
    imageAlt,
    removeImage: imageKey === null,
  })

  const applySaved = (next: NewsDTO, message: string) => {
    setSaved(next)
    setTitle(next.title)
    setPublishedOn(next.publishedOn)
    setContent(next.content)
    setImageAlt(next.imageAlt)
    setImageKey(next.imageKey)
    setIsDirty(false)
    setNotice(message)
  }

  const resetMessages = () => {
    setAltError(undefined)
    setBarError(undefined)
    setNotice(undefined)
  }

  const save = () => {
    resetMessages()
    startTransition(async () => {
      const result = await saveAction(payload())
      if (result.status === 'saved') applySaved(result.news, t('savedNotice'))
      else setBarError(result.message)
    })
  }

  const publish = () => {
    resetMessages()
    startTransition(async () => {
      const result = await publishAction(payload())

      if (result.status === 'published') {
        applySaved(result.news, t('publishedNotice'))
        return
      }

      if (result.status === 'incomplete') {
        for (const issue of result.issues) {
          if (issue === NewsPublicationErrorConst.MISSING_IMAGE_ALT) {
            setAltError(t(`issues.${issue}`))
          } else {
            setBarError(t(`issues.${issue}`))
          }
        }
        return
      }

      setBarError(result.message)
    })
  }

  const unpublish = () => {
    resetMessages()
    startTransition(async () => {
      const result = await unpublishAction({newsId: news.id})
      if (result.status === 'unpublished') {
        applySaved(result.news, t('unpublishedNotice'))
      } else setBarError(result.message)
    })
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    resetMessages()
    setUploadingName(file.name)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('newsId', news.id)

    const result = await uploadAction(formData)
    setUploadingName(undefined)

    if (result.status === 'error') {
      setBarError(result.message)
      return
    }

    setImageKey(result.key)
    setIsDirty(true)
  }

  return (
    <div className="flex w-full flex-col">
      <PreviewBar
        status={status}
        title={saved.title}
        errorMessage={barError}
        back={
          <Button asChild variant="outline" className="h-11">
            <Link href="/bureau/actualites">{t('back')}</Link>
          </Button>
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={isPending}
              onClick={save}
            >
              {t('saveDraft')}
            </Button>
            {saved.slug && (
              <Button asChild variant="outline" className="h-11">
                <Link href={`/actualites/${saved.slug}`} target="_blank">
                  {t('preview')}
                </Link>
              </Button>
            )}
            {saved.status === 'published' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" className="h-11">
                    {t('unpublish')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('unpublishConfirmTitle', {title: saved.title})}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('unpublishConfirmHelp')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={unpublish}>
                      {t('unpublishConfirmAction')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              type="button"
              className="h-11"
              disabled={isPending}
              onClick={publish}
            >
              {saved.status === 'published' ? t('update') : t('publish')}
            </Button>
          </>
        }
      />

      <div className="mx-auto flex w-full max-w-[68ch] flex-col gap-6 px-4 pt-6 pb-12 sm:px-6">
        <p className="text-muted-foreground text-[15px]">
          {saved.slug
            ? `${t('addressLabel')} /actualites/${saved.slug}`
            : t('addressPending')}
        </p>

        {notice && (
          <Alert>
            <CircleCheck className="text-primary" />
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor={titleId}>{t('titleLabel')}</Label>
          <Input
            id={titleId}
            className="h-14 sm:h-12"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              setIsDirty(true)
            }}
          />
          <p className="text-muted-foreground text-[14px]">{t('titleHelp')}</p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={dateId}>{t('dateLabel')}</Label>
          <Input
            id={dateId}
            type="date"
            className="h-14 sm:h-12"
            value={publishedOn}
            onChange={(event) => {
              setPublishedOn(event.target.value)
              setIsDirty(true)
            }}
          />
          <p className="text-muted-foreground text-[14px]">{t('dateHelp')}</p>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-[15px] font-medium">
            {t('imageLabel')} —{' '}
            <span className="text-muted-foreground font-normal">
              {t('imageOptional')}
            </span>
          </p>
          <p className="text-muted-foreground text-[14px]">{t('imageHelp')}</p>

          {imageKey ? (
            <div className="flex flex-col gap-3">
              <Image
                src={contentFileUrl(imageKey)}
                alt={imageAlt || t('imagePreviewAlt')}
                width={480}
                height={360}
                unoptimized
                className="h-auto w-full max-w-[30rem] rounded-md"
              />
              <div className="flex flex-wrap items-center gap-3">
                <Label htmlFor={replaceId} className="sr-only">
                  {t('imageReplace')}
                </Label>
                <Input
                  id={replaceId}
                  type="file"
                  accept="image/png,image/webp,image/jpeg"
                  className="max-w-[20rem]"
                  disabled={Boolean(uploadingName)}
                  onChange={(event) => upload(event.target.files?.[0])}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-14 sm:h-11"
                  onClick={() => {
                    setImageKey(null)
                    setImageAlt('')
                    setAltError(undefined)
                    setIsDirty(true)
                  }}
                >
                  {t('imageRemove')}
                </Button>
              </div>
            </div>
          ) : (
            <FileUpload
              onlyimage
              isUploading={Boolean(uploadingName)}
              onChange={(files) => upload(files[0])}
            />
          )}

          {uploadingName && (
            <div className="flex flex-col gap-2">
              <Progress
                aria-label={t('imageUploading', {fileName: uploadingName})}
              />
              <p className="text-muted-foreground text-[14px]">
                {t('imageUploading', {fileName: uploadingName})}
              </p>
            </div>
          )}

          {imageKey && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={altId}>{t('altLabel')}</Label>
              <Input
                id={altId}
                className="h-14 sm:h-12"
                value={imageAlt}
                aria-invalid={altError ? true : undefined}
                aria-describedby={altError ? `${altId}-error` : undefined}
                onChange={(event) => {
                  setImageAlt(event.target.value)
                  setIsDirty(true)
                }}
              />
              {altError ? (
                <p
                  id={`${altId}-error`}
                  className="text-destructive text-[14px]"
                  role="alert"
                >
                  {altError}
                </p>
              ) : (
                <p className="text-muted-foreground text-[14px]">
                  {t('altHelp')}
                </p>
              )}
            </div>
          )}
        </div>

        <RestrictedMarkdownEditor
          value={content}
          label={t('contentLabel')}
          placeholder={t('contentPlaceholder')}
          onChange={(value) => {
            setContent(value)
            setIsDirty(true)
          }}
        />
      </div>
    </div>
  )
}
