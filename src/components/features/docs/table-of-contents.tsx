'use client'

import {ChevronRight, Menu} from 'lucide-react'
import {useTranslations} from 'next-intl'
import * as React from 'react'

import {
  type TocItem,
  useActiveHeading,
} from '@/components/hooks/use-table-of-contents'
import {Button} from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {cn} from '@/lib/utils'

// Composant mobile séparé - style Better Auth
export function TableOfContentsMobile({items}: {items: TocItem[]}) {
  const t = useTranslations('DocsPage')
  const activeId = useActiveHeading(items.map((item) => item.id))
  const [open, setOpen] = React.useState(false)
  const toc = items

  if (toc.length === 0) {
    return undefined
  }

  const activeItem = toc.find((item) => item.id === activeId)
  const currentTitle = activeItem?.text || toc[0]?.text || t('onThisPage')

  const getIndentationClass = (level: number) => {
    switch (level) {
      case 1:
        return 'pl-0'
      case 2:
        return 'pl-3'
      case 3:
        return 'pl-6'
      case 4:
        return 'pl-9'
      default:
        return 'pl-0'
    }
  }

  return (
    <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-16 z-20 mb-4 block backdrop-blur xl:hidden">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 border-0"
          >
            <Menu className="h-4 w-4" />
            <span className="text-sm">{t('onThisPage')}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-muted-foreground max-w-[150px] truncate text-xs">
              {currentTitle}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-64 w-64 overflow-y-auto">
          {toc.map((item) => (
            <DropdownMenuItem
              key={item.id}
              asChild
              className={cn(
                getIndentationClass(item.level),
                activeId === item.id &&
                  'bg-accent text-accent-foreground font-medium'
              )}
            >
              <a href={`#${item.id}`} onClick={() => setOpen(false)}>
                {item.text}
              </a>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function TableOfContents({items}: {items: TocItem[]}) {
  const t = useTranslations('DocsPage')
  const activeId = useActiveHeading(items.map((item) => item.id))
  const toc = items

  if (toc.length === 0) {
    return undefined
  }

  const getIndentationClass = (level: number) => {
    switch (level) {
      case 1:
        return 'pl-0'
      case 2:
        return 'pl-3'
      case 3:
        return 'pl-6'
      case 4:
        return 'pl-9'
      default:
        return 'pl-0'
    }
  }

  return (
    <div className="fixed top-20 right-4 z-10 hidden max-h-[calc(100vh-8rem)] w-64 overflow-y-auto xl:block">
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 rounded-lg border p-4 backdrop-blur">
        <div className="mb-4 flex items-center gap-2">
          <Menu className="h-4 w-4" />
          <span className="text-sm font-medium">{t('onThisPage')}</span>
        </div>
        <nav className="space-y-1">
          {toc.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={cn(
                'hover:text-foreground block py-1 text-sm transition-colors',
                getIndentationClass(item.level),
                activeId === item.id
                  ? 'text-foreground border-primary border-l-2 pl-2 font-medium'
                  : 'text-muted-foreground'
              )}
            >
              {item.text}
            </a>
          ))}
        </nav>
      </div>
    </div>
  )
}
