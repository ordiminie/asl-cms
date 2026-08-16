import {ChevronLeft, ChevronRight} from 'lucide-react'

import {Link} from '@/i18n/navigation'
import {type DocItem} from '@/lib/files/docs-file-helper'

interface DocsPaginationProps {
  previous?: DocItem
  next?: DocItem
}

/**
 * Navigation de bas de page : suivre la documentation dans l'ordre sans
 * repasser par la sidebar. L'ordre vient de la structure des fichiers, il n'y a
 * donc rien à maintenir à la main.
 */
export function DocsPagination({previous, next}: DocsPaginationProps) {
  if (!previous && !next) return null

  return (
    <nav
      aria-label="Pagination de la documentation"
      className="border-border mt-16 grid gap-4 border-t pt-8 sm:grid-cols-2"
    >
      {previous ? (
        <Link
          href={previous.href}
          className="border-border hover:border-foreground/30 hover:bg-muted/40 group flex flex-col gap-1 rounded-lg border p-4 transition-colors"
        >
          <span className="text-muted-foreground flex items-center gap-1 text-xs tracking-wide uppercase">
            <ChevronLeft className="size-3" />
            Précédent
          </span>
          <span className="group-hover:text-link font-medium transition-colors">
            {previous.title}
          </span>
        </Link>
      ) : (
        <span aria-hidden />
      )}

      {next && (
        <Link
          href={next.href}
          className="border-border hover:border-foreground/30 hover:bg-muted/40 group flex flex-col gap-1 rounded-lg border p-4 text-right transition-colors sm:col-start-2"
        >
          <span className="text-muted-foreground flex items-center justify-end gap-1 text-xs tracking-wide uppercase">
            Suivant
            <ChevronRight className="size-3" />
          </span>
          <span className="group-hover:text-link font-medium transition-colors">
            {next.title}
          </span>
        </Link>
      )}
    </nav>
  )
}
