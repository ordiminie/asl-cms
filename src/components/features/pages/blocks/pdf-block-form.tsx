'use client'

import {useTranslations} from 'next-intl'
import {useId, useState} from 'react'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {PageBlockData} from '@/services/types/domain/page-block-types'

import {BlockFormProps} from './block-form-types'

type PdfBlock = Extract<PageBlockData, {type: 'pdf'}>

/**
 * Bloc « Document PDF ». Le titre est obligatoire **pour publier** : le nom du
 * fichier n'est jamais affiche tel quel au visiteur.
 */
export function PdfBlockForm({
  data,
  onChange,
  onUpload,
}: BlockFormProps<PdfBlock>) {
  const t = useTranslations('PageBlocks.pdf')
  const fileId = useId()
  const titleId = useId()
  const [isUploading, setIsUploading] = useState(false)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setIsUploading(true)
    const uploaded = await onUpload(file, 'document')
    setIsUploading(false)
    if (uploaded) {
      onChange({
        ...data,
        fileKey: uploaded.key,
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
      })
    }
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
          accept="application/pdf"
          disabled={isUploading}
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        <p className="text-muted-foreground text-[14px]">{t('fileHelp')}</p>
        {data.fileKey && (
          <p className="text-[15px]">
            {t('deposited', {name: data.fileName, size: data.fileSize})}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={titleId}>{t('titleLabel')}</Label>
        <Input
          id={titleId}
          value={data.title}
          onChange={(event) => onChange({...data, title: event.target.value})}
        />
        <p className="text-muted-foreground text-[14px]">
          {data.title.trim() === '' ? t('titleRequired') : t('titleHelp')}
        </p>
      </div>
    </div>
  )
}
