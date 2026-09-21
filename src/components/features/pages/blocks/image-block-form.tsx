'use client'

import Image from 'next/image'
import {useTranslations} from 'next-intl'
import {useId, useState} from 'react'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {PageBlockData} from '@/services/types/domain/page-block-types'

import {BlockFormProps, pageBlockFileUrl} from './block-form-types'

type ImageBlock = Extract<PageBlockData, {type: 'image'}>

/**
 * Bloc « Image + legende ». Le texte alternatif est signale « Obligatoire pour
 * publier » : il ne bloque pas l'enregistrement d'un brouillon, seulement la
 * publication.
 */
export function ImageBlockForm({
  data,
  onChange,
  onUpload,
}: BlockFormProps<ImageBlock>) {
  const t = useTranslations('PageBlocks.image')
  const fileId = useId()
  const altId = useId()
  const captionId = useId()
  const [isUploading, setIsUploading] = useState(false)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setIsUploading(true)
    const uploaded = await onUpload(file, 'image')
    setIsUploading(false)
    if (uploaded) onChange({...data, fileKey: uploaded.key})
  }

  return (
    <div className="flex flex-col gap-4">
      {!data.fileKey && (
        <Alert>
          <AlertTitle>{t('missingFileTitle')}</AlertTitle>
          <AlertDescription>{t('missingFileHelp')}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={fileId}>{t('fileLabel')}</Label>
        <Input
          id={fileId}
          type="file"
          accept="image/png,image/webp,image/jpeg"
          disabled={isUploading}
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        {isUploading && (
          <p className="text-muted-foreground text-[14px]">{t('uploading')}</p>
        )}
      </div>

      {data.fileKey && (
        <Image
          src={pageBlockFileUrl(data.fileKey)}
          alt={data.alt || t('previewAlt')}
          width={480}
          height={320}
          unoptimized
          className="h-auto w-full max-w-[30rem] rounded-md"
        />
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={altId}>{t('altLabel')}</Label>
        <Input
          id={altId}
          value={data.alt}
          onChange={(event) => onChange({...data, alt: event.target.value})}
        />
        <p className="text-muted-foreground text-[14px]">
          {data.alt.trim() === '' ? t('altRequired') : t('altHelp')}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={captionId}>{t('captionLabel')}</Label>
        <Textarea
          id={captionId}
          rows={2}
          value={data.caption}
          onChange={(event) => onChange({...data, caption: event.target.value})}
        />
        <p className="text-muted-foreground text-[14px]">{t('captionHelp')}</p>
      </div>
    </div>
  )
}
