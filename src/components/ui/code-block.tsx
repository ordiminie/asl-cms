'use client'

import {codeToHtml} from 'shiki'
import {useEffect, useState, useMemo} from 'react'

interface CodeBlockProps {
  code: string
  language: string
  className?: string
}

export function CodeBlock({code, language, className}: CodeBlockProps) {
  const [html, setHtml] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // Debounce pour éviter le re-highlighting à chaque caractère
  const debouncedCode = useMemo(() => {
    const timer = setTimeout(() => code, 300)
    return code
  }, [code])

  useEffect(() => {
    // Ne pas highlight si le code change encore (streaming en cours)
    const highlightTimer = setTimeout(async () => {
      try {
        setIsLoading(true)
        const highlighted = await codeToHtml(debouncedCode, {
          lang: language || 'text',
          theme: 'github-dark',
        })
        setHtml(highlighted)
      } catch {
        setHtml(`<pre><code>${debouncedCode}</code></pre>`)
      } finally {
        setIsLoading(false)
      }
    }, 200)

    return () => clearTimeout(highlightTimer)
  }, [debouncedCode, language])

  // Pendant le streaming, afficher le code brut pour éviter le scintillement
  if (isLoading && code !== debouncedCode) {
    return (
      <div
        className={`overflow-x-auto rounded-md bg-[#0d1117] p-4 text-[#f0f6fc] ${className || ''}`}
      >
        <pre>
          <code>{code}</code>
        </pre>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-muted rounded-md p-4">
        <div className="animate-pulse">
          <div className="bg-muted-foreground/20 mb-2 h-4 w-3/4 rounded"></div>
          <div className="bg-muted-foreground/20 h-4 w-1/2 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`overflow-x-auto rounded-md [&>pre]:m-0 [&>pre]:p-4 ${className || ''}`}
      dangerouslySetInnerHTML={{__html: html}}
    />
  )
}
