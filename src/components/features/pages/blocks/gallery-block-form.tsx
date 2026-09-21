'use client'

import Image from 'next/image'
import {useTranslations} from 'next-intl'
import {useId, useState} from 'react'

import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {PageBlockData} from '@/services/types/domain/page-block-types'

import {BlockFormProps, pageBlockFileUrl} from './block-form-types'

type GalleryBlock = Extract<PageBlockData, {type: 'gallery'}>

/**
 * Bloc « Galerie » : chaque vignette porte son propre texte alternatif,
 * obligatoire pour publier. Une galerie vide est omise du rendu public.
 */
export function GalleryBlockForm({
  data,
  onChange,
  onUpload,
}: BlockFormProps<GalleryBlock>) {
  const t = useTranslations('PageBlocks.gallery')
  const fileId = useId()
  const [isUploading, setIsUploading] = useState(false)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setIsUploading(true)
    const uploaded = []
    for (const file of [...files]) {
      const result = await onUpload(file, 'image')
      if (result) uploaded.push({fileKey: result.key, alt: ''})
    }
    setIsUploading(false)
    if (uploaded.length > 0) {
      onChange({...data, images: [...data.images, ...uploaded]})
    }
  }

  const updateAlt = (index: number, alt: string) => {
    onChange({
      ...data,
      images: data.images.map((image, position) =>
        position === index ? {...image, alt} : image
      ),
    })
  }

  const removeImage = (index: number) => {
    onChange({
      ...data,
      images: data.images.filter((_, position) => position !== index),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={fileId}>{t('fileLabel')}</Label>
        <Input
          id={fileId}
          type="file"
          multiple
          accept="image/png,image/webp,image/jpeg"
          disabled={isUploading}
          onChange={(event) => handleFiles(event.target.files)}
        />
        {isUploading && (
          <p className="text-muted-foreground text-[14px]">{t('uploading')}</p>
        )}
      </div>

      <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2">
        {data.images.map((image, index) => (
          <li key={image.fileKey} className="flex flex-col gap-2">
            <Image
              src={pageBlockFileUrl(image.fileKey)}
              alt={image.alt || t('previewAlt')}
              width={240}
              height={240}
              unoptimized
              className="aspect-square w-full rounded-md object-cover"
            />
            <Label htmlFor={`${fileId}-alt-${index}`}>
              {t('altLabel', {position: index + 1})}
            </Label>
            <Input
              id={`${fileId}-alt-${index}`}
              value={image.alt}
              onChange={(event) => updateAlt(index, event.target.value)}
            />
            {image.alt.trim() === '' && (
              <p className="text-muted-foreground text-[14px]">
                {t('altRequired')}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => removeImage(index)}
            >
              {t('remove')}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
