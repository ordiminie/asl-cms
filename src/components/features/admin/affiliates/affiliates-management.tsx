'use client'

import {useRouter, useSearchParams} from 'next/navigation'
import {useTranslations} from 'next-intl'
import {useState, useTransition} from 'react'
import {toast} from 'sonner'

import {markAffiliatePayoutPaidAction} from '@/app/[locale]/admin/affiliates/actions'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {AdminAffiliateRowDTO} from '@/services/types/domain/affiliate-types'

type AffiliatesManagementProps = {
  rows: (AdminAffiliateRowDTO & {waitingCents: number; waitingCount: number})[]
  currentPage: number
  totalPages: number
  total: number
}

const formatAmount = (cents: number, currency: string): string =>
  new Intl.NumberFormat('fr-FR', {style: 'currency', currency}).format(
    cents / 100
  )

export function AffiliatesManagement({
  rows,
  currentPage,
  totalPages,
  total,
}: AffiliatesManagementProps) {
  const t = useTranslations('Affiliate.admin')
  const router = useRouter()
  const searchParams = useSearchParams()

  function handlePageChange(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    router.push(`?${params.toString()}`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('tableTitle', {count: total})}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.code')}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t('columns.status')}
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t('columns.referred')}
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t('columns.waiting')}
                </TableHead>
                <TableHead>{t('columns.due')}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t('columns.paid')}
                </TableHead>
                <TableHead className="text-right">
                  {t('columns.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-muted-foreground text-center"
                  >
                    {t('empty')}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.affiliateId}>
                  <TableCell className="font-medium">{row.code}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge
                      variant={
                        row.status === 'active' ? 'default' : 'secondary'
                      }
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {row.referredOrganizations}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {formatAmount(row.waitingCents, row.currency)}
                  </TableCell>
                  <TableCell>
                    {formatAmount(row.dueCents, row.currency)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {formatAmount(row.paidCents, row.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <MarkPaidDialog row={row} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
            >
              {t('previous')}
            </Button>
            <span className="text-muted-foreground text-sm">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
            >
              {t('next')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MarkPaidDialog({row}: {row: AdminAffiliateRowDTO}) {
  const t = useTranslations('Affiliate.admin')
  const [open, setOpen] = useState(false)
  const [reference, setReference] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await markAffiliatePayoutPaidAction({
        affiliateId: row.affiliateId,
        externalReference: reference || undefined,
      })

      if (result.success) {
        toast.success(result.message)
        setOpen(false)
        setReference('')
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={row.dueCents <= 0}>
          {t('markPaid')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('markPaidTitle')}</DialogTitle>
          <DialogDescription>
            {t('markPaidDescription', {
              amount: formatAmount(row.dueCents, row.currency),
              code: row.code,
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reference">{t('reference')}</Label>
          <Input
            id="reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder={t('referencePlaceholder')}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {t('cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? t('recording') : t('confirmPaid')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
