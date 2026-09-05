import {useTranslations} from 'next-intl'

import {Card, CardContent, CardHeader} from '@/components/ui/card'
import {Skeleton} from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function PlansManagementSkeleton() {
  const t = useTranslations('AdminPlans')
  const tCommon = useTranslations('Common')
  return (
    <Card className="border-0 sm:border">
      <CardHeader className="px-4 sm:px-6">
        <Skeleton className="h-8 w-48" />
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-10 w-32" />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('management.plan')}</TableHead>
              <TableHead>{tCommon('fields.code')}</TableHead>
              <TableHead className="hidden lg:table-cell">
                {tCommon('fields.price')}
              </TableHead>
              <TableHead className="hidden lg:table-cell">
                {tCommon('fields.status')}
              </TableHead>
              <TableHead className="hidden md:table-cell">
                {t('management.createdAt')}
              </TableHead>
              <TableHead>{tCommon('fields.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({length: 5}).map((_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="mt-1 h-3 w-20" />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Skeleton className="h-6 w-16" />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-4 flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
