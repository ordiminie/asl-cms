import Link from 'next/link'

import {PaginatedBlogResult} from '@/app/dal/blog-dal'
import {Button} from '@/components/ui/button'

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

  const getPrevUrl = () => {
    if (page === 2) return baseUrl
    return `${baseUrl}/page/${page - 1}`
  }

  const getNextUrl = () => `${baseUrl}/page/${page + 1}`

  return (
    <nav
      className="mt-12 flex items-center justify-center gap-4"
      aria-label="Pagination"
    >
      {hasPrev ? (
        <Button variant="outline" asChild>
          <Link href={getPrevUrl()} rel="prev">
            ← {translations.previous}
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          ← {translations.previous}
        </Button>
      )}

      <span className="text-muted-foreground text-sm">
        {translations.page} {page} {translations.of} {totalPages}
      </span>

      {hasNext ? (
        <Button variant="outline" asChild>
          <Link href={getNextUrl()} rel="next">
            {translations.next} →
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          {translations.next} →
        </Button>
      )}
    </nav>
  )
}
