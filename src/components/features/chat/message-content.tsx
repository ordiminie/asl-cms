import {useEffect, useMemo, useState} from 'react'
import ReactMarkdown from 'react-markdown'

import {CodeBlock} from '@/components/ui/code-block'

interface MessageContentProps {
  content: string
  isStreaming?: boolean
}

export function MessageContent({
  content,
  isStreaming = false,
}: MessageContentProps) {
  const [frozenContent, setFrozenContent] = useState('')

  // Détecter la fermeture de blocs de code (```)
  const hasClosedCodeBlocks = useMemo(() => {
    const codeBlockMatches = content.match(/```/g)
    return (
      codeBlockMatches &&
      codeBlockMatches.length > 0 &&
      codeBlockMatches.length % 2 === 0
    )
  }, [content])

  // Freeze le contenu quand le streaming s'arrête
  useEffect(() => {
    // Mise à jour avec callback pour éviter le setState direct
    return () => {
      if (!isStreaming && content && frozenContent === '') {
        setFrozenContent(content)
      }
    }
  }, [isStreaming, content, frozenContent])

  // Déterminer si on doit afficher le markdown
  const shouldRenderMarkdown = frozenContent !== '' || hasClosedCodeBlocks

  // Utiliser le contenu figé si disponible, sinon le contenu actuel
  const displayContent = frozenContent || content

  const renderedContent = useMemo(() => {
    return (
      <ReactMarkdown
        components={{
          code: ({className, children, ...props}) => {
            const match = /language-(\w+)/.exec(className || '')
            const language = match ? match[1] : ''

            if (language) {
              return (
                <CodeBlock
                  code={String(children).replace(/\n$/, '')}
                  language={language}
                />
              )
            }

            return (
              <code
                className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm"
                {...props}
              >
                {children}
              </code>
            )
          },
          pre: ({children}) => <div className="not-prose my-4">{children}</div>,
          p: ({children}) => <p className="mb-4 last:mb-0">{children}</p>,
          ul: ({children}) => (
            <ul className="mb-4 ml-6 list-disc">{children}</ul>
          ),
          ol: ({children}) => (
            <ol className="mb-4 ml-6 list-decimal">{children}</ol>
          ),
          li: ({children}) => <li className="mb-1">{children}</li>,
          h1: ({children}) => (
            <h1 className="mt-6 mb-4 text-xl font-semibold first:mt-0">
              {children}
            </h1>
          ),
          h2: ({children}) => (
            <h2 className="mt-5 mb-3 text-lg font-semibold first:mt-0">
              {children}
            </h2>
          ),
          h3: ({children}) => (
            <h3 className="mt-4 mb-2 text-base font-semibold first:mt-0">
              {children}
            </h3>
          ),
          blockquote: ({children}) => (
            <blockquote className="border-muted-foreground/20 my-4 border-l-4 pl-4 italic">
              {children}
            </blockquote>
          ),
          table: ({children}) => (
            <div className="my-4 overflow-x-auto">
              <table className="border-muted-foreground/20 min-w-full border-collapse border">
                {children}
              </table>
            </div>
          ),
          th: ({children}) => (
            <th className="border-muted-foreground/20 bg-muted border px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({children}) => (
            <td className="border-muted-foreground/20 border px-3 py-2">
              {children}
            </td>
          ),
        }}
      >
        {displayContent}
      </ReactMarkdown>
    )
  }, [displayContent])

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      {shouldRenderMarkdown ? (
        // Afficher le markdown rendu si des blocs de code sont fermés ou si terminé
        renderedContent
      ) : (
        // Pendant le streaming sans blocs fermés, afficher le texte brut
        <div className="whitespace-pre-wrap">{content}</div>
      )}
    </div>
  )
}
