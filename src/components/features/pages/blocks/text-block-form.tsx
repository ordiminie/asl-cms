'use client'

import {useTranslations} from 'next-intl'

import {PageBlockData} from '@/services/types/domain/page-block-types'

import {BlockFormProps} from './block-form-types'
import {RestrictedMarkdownEditor} from './restricted-markdown-editor'

type TextBlock = Extract<PageBlockData, {type: 'text'}>

/** Bloc « Texte riche » : le seul champ libre, a barre reduite. */
export function TextBlockForm({data, onChange}: BlockFormProps<TextBlock>) {
  const t = useTranslations('PageBlocks.text')

  return (
    <RestrictedMarkdownEditor
      label={t('label')}
      placeholder={t('placeholder')}
      value={data.markdown}
      onChange={(markdown) => onChange({...data, markdown})}
    />
  )
}
