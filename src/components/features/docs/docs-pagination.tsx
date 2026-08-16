import {ChevronLeft, ChevronRight} from 'lucide-react'
import Link from 'next/link'

import type {DocsNavigation} from '@/lib/files/docs-file-helper'

// Les libellés restent en anglais, comme le reste de la chrome de la doc
// (« On this page », « Search documentation… ») : cette section n'est pas
// encore internationalisée.
export function DocsPagination({previous, next}: DocsNavigation) {
  if (!previous && !next) return undefined

  return (
    <nav className="border-border mt-12 grid gap-4 border-t pt-6 sm:grid-cols-2">
      {previous ? (
        <Link
          href={previous.href}
          className="border-border hover:border-foreground/20 hover:bg-muted/50 group flex flex-col gap-1 rounded-lg border p-4 transition-colors"
        >
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <ChevronLeft className="h-3 w-3" />
            Previous
          </span>
          <span className="group-hover:text-foreground font-medium">
            {previous.title}
          </span>
        </Link>
      ) : (
        <span />
      )}

      {next && (
        <Link
          href={next.href}
          className="border-border hover:border-foreground/20 hover:bg-muted/50 group flex flex-col items-end gap-1 rounded-lg border p-4 text-right transition-colors sm:col-start-2"
        >
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            Next
            <ChevronRight className="h-3 w-3" />
          </span>
          <span className="group-hover:text-foreground font-medium">
            {next.title}
          </span>
        </Link>
      )}
    </nav>
  )
}
