'use client'

import {useTranslations} from 'next-intl'
import {useId} from 'react'

import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {PageBlockData} from '@/services/types/domain/page-block-types'

import {BlockFormProps} from './block-form-types'
import {RestrictedMarkdownEditor} from './restricted-markdown-editor'

type CalloutBlock = Extract<PageBlockData, {type: 'callout'}>

/**
 * Bloc « Encart » : titre facultatif, texte a barre reduite, et l'apercu
 * teinte aux couleurs de l'association in situ — le bureau voit l'effet avant
 * de publier. Jamais de bouton dans un encart.
 */
export function CalloutBlockForm({
  data,
  onChange,
}: BlockFormProps<CalloutBlock>) {
  const t = useTranslations('PageBlocks.callout')
  const titleId = useId()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={titleId}>{t('titleLabel')}</Label>
        <Input
          id={titleId}
          value={data.title}
          onChange={(event) => onChange({...data, title: event.target.value})}
        />
        <p className="text-muted-foreground text-[14px]">
          {t('titleOptional')}
        </p>
      </div>

      <RestrictedMarkdownEditor
        label={t('textLabel')}
        value={data.markdown}
        onChange={(markdown) => onChange({...data, markdown})}
      />

      <div className="bg-accent text-accent-foreground rounded-md px-4 py-3">
        <p className="font-mono text-xs tracking-widest uppercase">
          {t('previewLabel')}
        </p>
        {data.title && <p className="font-semibold">{data.title}</p>}
        <p className="text-[15px] whitespace-pre-line">{data.markdown}</p>
      </div>

      <p className="text-muted-foreground text-[14px]">{t('help')}</p>
    </div>
  )
}
