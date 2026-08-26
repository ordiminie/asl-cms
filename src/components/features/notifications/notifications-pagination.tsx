'use client'

import {useTranslations} from 'next-intl'

import {Button} from '@/components/ui/button'

interface NotificationsPaginationProps {
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  onPageChange: (page: number) => void
}

export default function NotificationsPagination({
  pagination,
  onPageChange,
}: NotificationsPaginationProps) {
  const t = useTranslations('Notifications')
  const tCommon = useTranslations('Common.pagination')
  const {total, page, limit, totalPages} = pagination

  const startItem = (page - 1) * limit + 1
  const endItem = Math.min(page * limit, total)

  return (
    <div className="flex items-center justify-between">
      <div className="text-muted-foreground text-sm">
        {t('pagination.showing', {
          start: startItem,
          end: endItem,
          total,
        })}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          {tCommon('previous')}
        </Button>

        <div className="flex items-center gap-1">
          {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
            let pageNumber: number

            if (totalPages <= 5) {
              pageNumber = i + 1
            } else if (page <= 3) {
              pageNumber = i + 1
            } else if (page >= totalPages - 2) {
              pageNumber = totalPages - 4 + i
            } else {
              pageNumber = page - 2 + i
            }

            return (
              <Button
                key={pageNumber}
                variant={pageNumber === page ? 'default' : 'outline'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => onPageChange(pageNumber)}
              >
                {pageNumber}
              </Button>
            )
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          {tCommon('next')}
        </Button>
      </div>
    </div>
  )
}
