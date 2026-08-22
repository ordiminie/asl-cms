'use client'

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import {useTranslations} from 'next-intl'

import {Button} from '@/components/ui/button'

interface PostsPaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function PostsPagination({
  currentPage,
  totalPages,
  onPageChange,
}: PostsPaginationProps) {
  const t = useTranslations('Common.pagination')
  const canGoPrevious = currentPage > 1
  const canGoNext = currentPage < totalPages

  const getVisiblePages = () => {
    const delta = 2
    const range = []
    const rangeWithDots = []

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i)
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...')
    } else {
      rangeWithDots.push(1)
    }

    rangeWithDots.push(...range)

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages)
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages)
    }

    return rangeWithDots
  }

  if (totalPages <= 1) {
    return null
  }

  return (
    <div className="flex items-center justify-between pt-4">
      <div className="text-muted-foreground text-sm">
        {t('pageOf', {current: currentPage, total: totalPages})}
      </div>

      <div className="flex items-center space-x-2">
        {/* Première page */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(1)}
          disabled={!canGoPrevious}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* Page précédente */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrevious}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Pages numérotées */}
        {getVisiblePages().map((page, index) => (
          <Button
            key={index}
            variant={page === currentPage ? 'default' : 'outline'}
            size="icon"
            onClick={() => typeof page === 'number' && onPageChange(page)}
            disabled={page === '...'}
            className={page === '...' ? 'cursor-default' : ''}
          >
            {page}
          </Button>
        ))}

        {/* Page suivante */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Dernière page */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(totalPages)}
          disabled={!canGoNext}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
