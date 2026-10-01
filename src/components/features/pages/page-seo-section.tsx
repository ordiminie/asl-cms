'use client'

import Image from 'next/image'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useId, useState} from 'react'

import {Button} from '@/components/ui/button'
import {FileUpload} from '@/components/ui/file-upload'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Separator} from '@/components/ui/separator'
import {Textarea} from '@/components/ui/textarea'
import {cn} from '@/lib/utils'
import {
  CONTENT_FILE_MAX_BYTES,
  contentFileUrl,
} from '@/services/types/domain/content-file-types'
import {
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
} from '@/services/types/domain/seo-types'

import {SearchPreview} from './search-preview'

export type PageSeoValue = {
  seoTitle: string
  seoDescription: string
  shareImageKey: string | null
  shareImageAlt: string
}

export type PageShareImageUploaded = {
  key: string
  fileName: string
  fileSize: number
}

type PageSeoSectionProps = {
  value: PageSeoValue
  onChange: (next: PageSeoValue) => void
  /** Titre et adresse de la page, tels que saisis dans les parametres. */
  pageTitle: string
  slug: string
  /** Domaine de l'association et sa description, valeur de repli. */
  host: string
  associationDescription?: string
  onUpload: (file: File) => Promise<PageShareImageUploaded | undefined>
  /** Refus de publication : le texte alternatif manque. */
  altError?: string
  altInputId: string
}

const SHARE_IMAGE_ACCEPT = 'image/png,image/webp,image/jpeg'

/** Nombre de caracteres au-dela du plafond, 0 dans la limite. */
export const overflowOf = (value: string, max: number): number =>
  Math.max(0, value.trim().length - max)

/**
 * Section « Referencement et partage » de l'editeur de page (s11, design
 * ecran 2) : titre moteur, description, image de partage et son texte
 * alternatif, et l'apercu « Dans Google » qui montre toujours la valeur de
 * repli. Aucun jargon a l'ecran.
 */
export function PageSeoSection({
  value,
  onChange,
  pageTitle,
  slug,
  host,
  associationDescription,
  onUpload,
  altError,
  altInputId,
}: PageSeoSectionProps) {
  const t = useTranslations('BureauPagesPage.editor.seo')
  const headingId = useId()
  const titleId = useId()
  const descriptionId = useId()
  const chooseId = useId()
  const replaceId = useId()
  const [uploadingName, setUploadingName] = useState<string>()
  const [uploadedName, setUploadedName] = useState<string>()

  const set = (patch: Partial<PageSeoValue>) => onChange({...value, ...patch})

  const upload = async (file: File | undefined) => {
    if (!file) return
    setUploadingName(file.name)
    const uploaded = await onUpload(file)
    setUploadingName(undefined)
    if (!uploaded) return
    setUploadedName(uploaded.fileName)
    set({shareImageKey: uploaded.key})
  }

  const previewDescription =
    value.seoDescription.trim() || associationDescription

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <Separator />
      <div className="flex flex-col gap-1">
        <h3 id={headingId} className="text-[17px] font-semibold">
          {t('title')}
        </h3>
        <p className="text-muted-foreground text-[14px]">{t('intro')}</p>
      </div>

      <CountedField
        id={titleId}
        label={t('seoTitleLabel')}
        value={value.seoTitle}
        max={SEO_TITLE_MAX}
        onChange={(seoTitle) => set({seoTitle})}
        whenEmpty={t('seoTitleEmpty', {title: pageTitle})}
      />

      <CountedField
        id={descriptionId}
        label={t('descriptionLabel')}
        value={value.seoDescription}
        max={SEO_DESCRIPTION_MAX}
        multiline
        onChange={(seoDescription) => set({seoDescription})}
        whenEmpty={
          associationDescription ? (
            t('descriptionEmpty')
          ) : (
            <>
              {t('descriptionEmptyNoAssociation')}{' '}
              <Link href="/bureau/reglages" className="text-link underline">
                {t('associationDescriptionLink')}
              </Link>
            </>
          )
        }
      />

      <div className="flex flex-col gap-2">
        <p className="text-[15px] font-medium">
          {t('imageLabel')}{' '}
          <span className="text-muted-foreground font-normal">
            — {t('optional')}
          </span>
        </p>
        <p className="text-muted-foreground text-[14px]">{t('imageHelp')}</p>

        {value.shareImageKey ? (
          <div className="flex flex-col gap-3">
            <Image
              src={contentFileUrl(value.shareImageKey)}
              alt={value.shareImageAlt || t('imagePreviewAlt')}
              width={264}
              height={139}
              unoptimized
              className="h-auto w-full rounded-md"
            />
            {uploadedName && (
              <p className="text-muted-foreground text-[14px]">
                {uploadedName}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor={replaceId}>{t('imageReplace')}</Label>
              <Input
                id={replaceId}
                type="file"
                accept={SHARE_IMAGE_ACCEPT}
                disabled={Boolean(uploadingName)}
                onChange={(event) => upload(event.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => {
                  setUploadedName(undefined)
                  set({shareImageKey: null, shareImageAlt: ''})
                }}
              >
                {t('imageRemove')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden pointer-fine:block">
              <FileUpload
                onlyimage
                maxSize={CONTENT_FILE_MAX_BYTES.image}
                isUploading={Boolean(uploadingName)}
                onChange={(files) => upload(files[0])}
              />
            </div>
            <div className="flex flex-col gap-2 pointer-fine:hidden">
              <Label htmlFor={chooseId}>{t('imageChoose')}</Label>
              <Input
                id={chooseId}
                type="file"
                accept={SHARE_IMAGE_ACCEPT}
                className="h-14"
                disabled={Boolean(uploadingName)}
                onChange={(event) => upload(event.target.files?.[0])}
              />
            </div>
            <p className="text-muted-foreground text-[14px]">
              {t('imageConstraints')}
            </p>
            <p className="text-foreground text-[14px]">{t('imageEmpty')}</p>
          </>
        )}

        {uploadingName && (
          <p className="text-muted-foreground text-[14px]" aria-live="polite">
            {t('imageUploading', {fileName: uploadingName})}
          </p>
        )}
      </div>

      {value.shareImageKey && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={altInputId}>
            {t('altLabel')}{' '}
            <span className="text-muted-foreground font-normal">
              — {t('altRequired')}
            </span>
          </Label>
          <p className="text-muted-foreground text-[14px]">{t('altHelp')}</p>
          <Input
            id={altInputId}
            value={value.shareImageAlt}
            aria-invalid={altError ? true : undefined}
            aria-describedby={altError ? `${altInputId}-error` : undefined}
            className={cn(altError && 'border-destructive border-2')}
            onChange={(event) => set({shareImageAlt: event.target.value})}
          />
          {altError && (
            <p
              id={`${altInputId}-error`}
              className="text-destructive-text text-[14px] font-medium"
            >
              {altError}
            </p>
          )}
        </div>
      )}

      <SearchPreview
        host={host}
        path={[slug]}
        title={value.seoTitle.trim() || pageTitle}
        description={previewDescription}
      />
    </section>
  )
}

type CountedFieldProps = {
  /** Espace de traduction qui porte `optional`, `counter` et `overflow`. */
  namespace?: 'BureauPagesPage.editor.seo' | 'BureauNewsPage.editor.seo'
  id: string
  label: string
  value: string
  max: number
  multiline?: boolean
  onChange: (value: string) => void
  whenEmpty: React.ReactNode
}

/**
 * Champ facultatif avec compteur (design system §3.9) : le compteur reste
 * discret jusqu'au plafond, puis passe en erreur et dit l'excedent.
 */
export function CountedField({
  namespace = 'BureauPagesPage.editor.seo',
  id,
  label,
  value,
  max,
  multiline = false,
  onChange,
  whenEmpty,
}: CountedFieldProps) {
  const t = useTranslations(namespace)
  const over = overflowOf(value, max)
  const describedBy = `${id}-counter`
  const fieldProps = {
    id,
    value,
    'aria-invalid': over > 0 ? true : undefined,
    'aria-describedby': describedBy,
    className: cn(over > 0 && 'border-destructive border-2'),
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label}{' '}
        <span className="text-muted-foreground font-normal">
          — {t('optional')}
        </span>
      </Label>
      {multiline ? (
        <Textarea
          {...fieldProps}
          rows={3}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          {...fieldProps}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="text-[14px]">
          {over > 0 ? (
            <p className="text-destructive-text font-medium">
              {t('overflow', {over})}
            </p>
          ) : (
            value.trim() === '' && (
              <p className="text-foreground">{whenEmpty}</p>
            )
          )}
        </div>
        <p
          id={describedBy}
          className={cn(
            'shrink-0 font-mono text-[14px] tabular-nums',
            over > 0
              ? 'text-destructive-text font-semibold'
              : 'text-muted-foreground'
          )}
        >
          {t('counter', {count: value.length, max})}
        </p>
      </div>
    </div>
  )
}
