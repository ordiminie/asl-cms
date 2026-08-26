'use client'

import {Check, Copy} from 'lucide-react'
import {useState} from 'react'

import {Button} from '@/components/ui/button'

/**
 * Copie la source Markdown de la page, telle quelle : c'est la forme utile
 * pour la coller ailleurs — un agent, une issue, un message.
 */
export function CopyPageButton({markdown}: {markdown: string}) {
  const [copied, setCopied] = useState(false)

  const copyPage = async () => {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy page: ', error)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={copyPage}
      className="text-muted-foreground hover:text-foreground shrink-0 gap-2"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">
        {copied ? 'Copied' : 'Copy page'}
      </span>
    </Button>
  )
}
