import {ChevronLeft, ChevronRight} from 'lucide-react'
import Link from 'next/link'

import {PaginatedBlogResult} from '@/app/dal/blog-dal'
import {Button} from '@/components/ui/button'
import {cn} from '@/lib/utils'

interface BlogPaginationProps {
  pagination: PaginatedBlogResult['pagination']
  baseUrl: string
  translations: {
    previous: string
    next: string
    page: string
    of: string
  }
}

export function BlogPagination({
  pagination,
  baseUrl,
  translations,
}: BlogPaginationProps) {
  const {page, totalPages, hasNext, hasPrev} = pagination

  if (totalPages <= 1) {
    return null
  }

  const getPageUrl = (pageNum: number) => {
    if (pageNum === 1) return baseUrl
    return `${baseUrl}/page/${pageNum}`
  }

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    const showEllipsis = totalPages > 7

    if (!showEllipsis) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)

      if (page > 3) {
        pages.push('ellipsis')
      }

      const start = Math.max(2, page - 1)
      const end = Math.min(totalPages - 1, page + 1)

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i)
        }
      }

      if (page < totalPages - 2) {
        pages.push('ellipsis')
      }

      if (!pages.includes(totalPages)) {
        pages.push(totalPages)
      }
    }

    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <nav
      className="mt-12 flex flex-col items-center gap-4"
      aria-label="Pagination"
    >
      <div className="flex items-center gap-2">
        {hasPrev ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={getPageUrl(page - 1)} rel="prev">
              <ChevronLeft className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">
                {translations.previous}
              </span>
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">
              {translations.previous}
            </span>
          </Button>
        )}

        <div className="flex items-center gap-1">
          {pageNumbers.map((pageNum, idx) =>
            pageNum === 'ellipsis' ? (
              <span
                key={`ellipsis-${idx}`}
                className="text-muted-foreground px-2"
              >
                ...
              </span>
            ) : (
              <Button
                key={pageNum}
                variant={pageNum === page ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  'h-9 w-9 p-0',
                  pageNum === page && 'pointer-events-none'
                )}
                asChild={pageNum !== page}
              >
                {pageNum === page ? (
                  <span>{pageNum}</span>
                ) : (
                  <Link href={getPageUrl(pageNum)}>{pageNum}</Link>
                )}
              </Button>
            )
          )}
        </div>

        {hasNext ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={getPageUrl(page + 1)} rel="next">
              <span className="mr-1 hidden sm:inline">{translations.next}</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <span className="mr-1 hidden sm:inline">{translations.next}</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      <span className="text-muted-foreground text-sm">
        {translations.page} {page} {translations.of} {totalPages}
      </span>
    </nav>
  )
}
