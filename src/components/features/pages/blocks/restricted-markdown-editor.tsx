'use client'

import {useTranslations} from 'next-intl'
import {useId, useRef} from 'react'

import {Button} from '@/components/ui/button'
import {Textarea} from '@/components/ui/textarea'

/**
 * Editeur de texte riche a **barre reduite** (design system §2.1) : gras,
 * italique, titre 2, titre 3, liste, lien. Rien d'autre.
 *
 * `markdown-editor.tsx` (Milkdown + GFM) ne peut pas servir ici : il expose
 * tableaux, code fence et barre GFM complete, que le rendu public sanitise de
 * toute facon (ADR 019). Proposer des outils dont le resultat disparait a la
 * publication serait un piege pour le bureau — d'ou cette variante contrainte,
 * qui n'offre que ce que le rendu accepte.
 */
type RestrictedMarkdownEditorProps = {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
}

type Mark = {
  key: 'bold' | 'italic' | 'heading2' | 'heading3' | 'list' | 'link'
  wrap?: [string, string]
  prefix?: string
}

const MARKS: Mark[] = [
  {key: 'bold', wrap: ['**', '**']},
  {key: 'italic', wrap: ['_', '_']},
  {key: 'heading2', prefix: '## '},
  {key: 'heading3', prefix: '### '},
  {key: 'list', prefix: '- '},
  {key: 'link', wrap: ['[', '](https://)']},
]

export function RestrictedMarkdownEditor({
  value,
  onChange,
  label,
  placeholder,
}: RestrictedMarkdownEditorProps) {
  const t = useTranslations('RestrictedMarkdownEditor')
  const fieldId = useId()
  const textarea = useRef<HTMLTextAreaElement>(null)

  const applyMark = (mark: Mark) => {
    const field = textarea.current
    if (!field) return

    const start = field.selectionStart
    const end = field.selectionEnd
    const selected = value.slice(start, end)

    if (mark.wrap) {
      const [before, after] = mark.wrap
      onChange(
        `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`
      )
    } else {
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      onChange(
        `${value.slice(0, lineStart)}${mark.prefix}${value.slice(lineStart)}`
      )
    }

    field.focus()
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[15px] font-medium" htmlFor={fieldId}>
        {label}
      </label>

      <div className="flex flex-wrap gap-2">
        {MARKS.map((mark) => (
          <Button
            key={mark.key}
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => applyMark(mark)}
          >
            {t(mark.key)}
          </Button>
        ))}
      </div>

      <Textarea
        id={fieldId}
        ref={textarea}
        rows={6}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />

      <p className="text-muted-foreground text-[14px]">{t('help')}</p>
    </div>
  )
}
