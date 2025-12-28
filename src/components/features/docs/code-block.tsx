'use client'

import {Check, Copy} from 'lucide-react'
import React, {useCallback, useRef, useState} from 'react'

import {cn} from '@/lib/utils'

interface CodeBlockProps {
  children: React.ReactNode
  filename?: string
  className?: string
  language?: string
  rawCode?: string
}

export function CodeBlock({
  children,
  filename,
  className = '',
  language,
  rawCode,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const codeRef = useRef<HTMLDivElement>(null)

  const copyToClipboard = useCallback(async () => {
    let textToCopy = rawCode || ''

    if (!textToCopy && codeRef.current) {
      // Try to extract text from the specific code block instance
      const codeElement =
        codeRef.current.querySelector('pre code') ||
        codeRef.current.querySelector('pre')
      if (codeElement) {
        textToCopy = codeElement.textContent || ''
      }
    }

    if (!textToCopy) {
      console.warn('No text found to copy')
      return
    }

    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
      // Fallback: try to select and copy
      try {
        if (codeRef.current) {
          const codeElement =
            codeRef.current.querySelector('pre code') ||
            codeRef.current.querySelector('pre')
          if (codeElement) {
            const range = document.createRange()
            range.selectNode(codeElement)
            const selection = window.getSelection()
            selection?.removeAllRanges()
            selection?.addRange(range)
            document.execCommand('copy')
            selection?.removeAllRanges()
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }
        }
      } catch (fallbackErr) {
        console.error('Fallback copy failed: ', fallbackErr)
      }
    }
  }, [rawCode])

  // Extract language from className if not provided
  // Handle Shiki classes that might contain multiple classes
  const detectedLanguage =
    language ||
    (() => {
      if (!className) return ''

      // First try to extract standard language- prefix
      const langMatch = className.match(/language-(\w+)/)
      if (langMatch) return langMatch[1]

      // Then try lang- prefix
      const langMatch2 = className.match(/lang-(\w+)/)
      if (langMatch2) return langMatch2[1]

      // If it's a Shiki class with multiple themes, don't show it as language
      if (className.includes('shiki') || className.includes('github-'))
        return ''

      // Pas de fallback - seulement si on trouve vraiment un language
      return ''
    })()

  return (
    <div className="group border-border bg-background relative my-6 w-full max-w-full overflow-hidden rounded-lg border">
      {/* Header with filename and copy button */}
      {(filename || detectedLanguage) && (
        <div className="border-border bg-muted flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2">
            {filename && (
              <span className="text-foreground text-sm font-medium">
                {filename}
              </span>
            )}
            {!filename && detectedLanguage && (
              <span className="text-muted-foreground text-sm font-medium">
                {detectedLanguage}
              </span>
            )}
          </div>
          <button
            onClick={copyToClipboard}
            className={cn(
              'flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
              'hover:bg-background hover:text-foreground',
              copied ? 'text-green-600' : 'text-muted-foreground'
            )}
            title={copied ? 'Copied!' : 'Copy code'}
          >
            {copied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </div>
      )}

      {/* Code content */}
      <div className="relative" ref={codeRef}>
        {/* Copy button for blocks without header */}
        {!filename && !detectedLanguage && (
          <button
            onClick={copyToClipboard}
            className={cn(
              'absolute top-2 right-2 z-10 flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs opacity-0 transition-colors group-hover:opacity-100',
              'bg-background/80 hover:bg-background backdrop-blur-sm',
              copied
                ? 'text-green-600'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={copied ? 'Copied!' : 'Copy code'}
          >
            {copied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        )}

        {/* Let children render as-is (Shiki content) */}
        <div className="w-full max-w-full overflow-x-auto [&_code]:!rounded-none [&_code]:!bg-transparent [&_code]:!p-0 [&_code]:!font-mono [&_pre]:!my-0 [&_pre]:w-full [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:!rounded-none [&_pre]:!border-none [&_pre]:p-4 [&_pre]:text-sm">
          {children}
        </div>
      </div>
    </div>
  )
}
