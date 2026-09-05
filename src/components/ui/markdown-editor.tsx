'use client'

import {Editor, defaultValueCtx, rootCtx} from '@milkdown/core'
import {nord} from '@milkdown/theme-nord'
import {Milkdown, MilkdownProvider, useEditor} from '@milkdown/react'
import {commonmark} from '@milkdown/preset-commonmark'
import {gfm} from '@milkdown/preset-gfm'
import {listener, listenerCtx} from '@milkdown/plugin-listener'
import {history} from '@milkdown/plugin-history'
import {getMarkdown, replaceAll} from '@milkdown/utils'
import {Eye, FileText} from 'lucide-react'
import {useCallback, useState, useEffect, useRef} from 'react'

import {Button} from './button'
import {Textarea} from './textarea'
import {cn} from '@/lib/utils'

interface MarkdownEditorProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  id?: string
}

// Composant Milkdown pur
function MilkdownEditor({
  content,
  onChange,
}: {
  content: string
  onChange: (markdown: string) => void
}) {
  const {get} = useEditor((root) =>
    Editor.make()
      .config(nord)
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, content)
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          onChange(markdown)
        })
      })
      .use(commonmark)
      .use(gfm)
      .use(listener)
      .use(history)
  )

  const previousContent = useRef(content)
  const debounceTimeout = useRef<number | null>(null)

  // Synchroniser le contenu avec l'éditeur
  useEffect(() => {
    const editor = get()
    if (editor && content !== previousContent.current) {
      // Debouncing pour éviter les boucles
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current)
      }

      debounceTimeout.current = window.setTimeout(() => {
        try {
          const currentContent = editor.action(getMarkdown())
          if (currentContent !== content) {
            editor.action(replaceAll(content))
            previousContent.current = content
          }
        } catch (error) {
          console.warn('Erreur lors de la mise à jour Milkdown:', error)
        }
      }, 200)
    }

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current)
      }
    }
  }, [content, get])

  return <Milkdown />
}

function MarkdownEditorInner({
  value = '',
  onChange,
  placeholder = 'Tapez votre contenu en markdown...',
  className,
  disabled = false,
  id,
}: MarkdownEditorProps) {
  const [isTextMode, setIsTextMode] = useState(false)

  const toggleMode = useCallback(() => {
    setIsTextMode(!isTextMode)
  }, [isTextMode])

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e.target.value)
    },
    [onChange]
  )

  const handleMilkdownChange = useCallback(
    (markdown: string) => {
      onChange?.(markdown)
    },
    [onChange]
  )

  return (
    <div className={cn('relative', className)}>
      {/* Toggle Button */}
      <div className="mb-2 flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleMode}
          disabled={disabled}
          className="gap-2"
        >
          {isTextMode ? (
            <>
              <Eye className="h-4 w-4" />
              Mode éditeur
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              Mode texte brut
            </>
          )}
        </Button>
      </div>

      {/* Editor Content */}
      <div
        className={cn(
          'border-input bg-background min-h-[200px] overflow-hidden rounded-md border',
          disabled && 'opacity-50'
        )}
      >
        {isTextMode ? (
          // Mode texte brut
          <Textarea
            id={id}
            value={value}
            onChange={handleTextareaChange}
            placeholder={placeholder}
            disabled={disabled}
            rows={10}
            className="min-h-[200px] resize-none border-0 focus-visible:ring-0"
          />
        ) : (
          // Mode éditeur Milkdown
          <div className="milkdown-wrapper min-h-[200px] p-0">
            <MilkdownEditor content={value} onChange={handleMilkdownChange} />
          </div>
        )}
      </div>

      {/* Helper Text */}
      {!isTextMode && (
        <div className="text-muted-foreground mt-2 text-xs">
          Support GFM : tableaux, listes de tâches, code fencé, strikethrough
        </div>
      )}
    </div>
  )
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  return (
    <MilkdownProvider>
      <MarkdownEditorInner {...props} />
    </MilkdownProvider>
  )
}
