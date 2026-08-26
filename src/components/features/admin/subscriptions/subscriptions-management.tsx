'use client'

import {format} from 'date-fns'
import {useRouter, useSearchParams} from 'next/navigation'
import {useLocale, useTranslations} from 'next-intl'
import {useState} from 'react'
import {useTransition} from 'react'
import {toast} from 'sonner'

import {
  cancelSubscriptionAction,
  reactivateSubscriptionAction,
} from '@/app/[locale]/admin/subscriptions/actions'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {getDateFnsLocale} from '@/lib/helper/date-helper'
import {Subscription} from '@/services/types/domain/subscription-types'

import {SubscriptionsPagination} from './subscriptions-pagination'
import {SubscriptionsToolbar} from './subscriptions-toolbar'

interface SubscriptionsManagementProps {
  initialSubscriptions: Subscription[]
  currentPage: number
  pageSize: number
  totalSubscriptions: number
  permissions: {
    canView: boolean
    canCancel: boolean
    canReactivate: boolean
  }
  searchQuery: string
}

export default function SubscriptionsManagement({
  initialSubscriptions,
  currentPage,
  pageSize,
  totalSubscriptions,
  permissions,
  searchQuery,
}: SubscriptionsManagementProps) {
  const t = useTranslations('AdminSubscriptions')
  const tCommon = useTranslations('Common')
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedSubscription, setSelectedSubscription] =
    useState<Subscription | null>(null)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showReactivateDialog, setShowReactivateDialog] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSearch = (search: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('search', search)
    params.set('page', '1')
    router.push(`?${params.toString()}`)
  }

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    router.push(`?${params.toString()}`)
  }

  const handlePerPageChange = (limit: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('limit', limit)
    params.set('page', '1')
    router.push(`?${params.toString()}`)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">{t('status.active')}</Badge>
      case 'trialing':
        return <Badge variant="secondary">{t('status.trialing')}</Badge>
      case 'canceled':
        return <Badge variant="destructive">{t('status.canceled')}</Badge>
      case 'incomplete':
        return <Badge variant="outline">{t('status.incomplete')}</Badge>
      case 'past_due':
        return <Badge variant="destructive">{t('status.past_due')}</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const handleCancelSubscription = (subscription: Subscription) => {
    setSelectedSubscription(subscription)
    setShowCancelDialog(true)
  }

  const handleReactivateSubscription = (subscription: Subscription) => {
    setSelectedSubscription(subscription)
    setShowReactivateDialog(true)
  }

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'N/A'
    return format(new Date(date), 'dd/MM/yyyy', {
      locale: getDateFnsLocale(locale),
    })
  }

  return (
    <Card className="border-0 sm:border">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <SubscriptionsToolbar
          onSearch={handleSearch}
          initialSearch={searchQuery}
          totalSubscriptions={totalSubscriptions}
          onPerPageChange={handlePerPageChange}
          perPage={pageSize.toString()}
          permissions={permissions}
        />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tCommon('fields.plan')}</TableHead>
              <TableHead>{tCommon('fields.status')}</TableHead>
              <TableHead className="hidden lg:table-cell">
                {t('reference')}
              </TableHead>
              <TableHead className="hidden lg:table-cell">
                {t('customerId')}
              </TableHead>
              <TableHead className="hidden md:table-cell">
                {t('start')}
              </TableHead>
              <TableHead className="hidden md:table-cell">{t('end')}</TableHead>
              <TableHead>{t('seats')}</TableHead>
              <TableHead>{tCommon('fields.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialSubscriptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center">
                  Aucun abonnement trouvé
                </TableCell>
              </TableRow>
            ) : (
              initialSubscriptions.map((subscription) => (
                <TableRow key={subscription.id}>
                  <TableCell className="flex items-center gap-2">
                    <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
                      <span className="text-sm font-medium">
                        {subscription.plan?.charAt(0).toUpperCase() || 'S'}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">{subscription.plan}</div>
                      <div className="text-muted-foreground text-sm">
                        {subscription.seats || 1} siège
                        {(subscription.seats || 1) > 1 ? 's' : ''}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(subscription.status)}</TableCell>
                  <TableCell className="hidden font-mono text-sm lg:table-cell">
                    {subscription.referenceId}
                  </TableCell>
                  <TableCell className="hidden font-mono text-sm lg:table-cell">
                    {subscription.stripeCustomerId || 'N/A'}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                    {formatDate(subscription.periodStart)}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                    {formatDate(subscription.periodEnd)}
                  </TableCell>
                  <TableCell>{subscription.seats || 1}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      {permissions.canCancel &&
                        (subscription.status === 'active' ||
                          subscription.status === 'trialing') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleCancelSubscription(subscription)
                            }
                          >
                            Annuler
                          </Button>
                        )}
                      {permissions.canReactivate &&
                        subscription.status === 'canceled' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleReactivateSubscription(subscription)
                            }
                          >
                            {t('reactivateShort')}
                          </Button>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <SubscriptionsPagination
          currentPage={currentPage}
          totalPages={Math.ceil(totalSubscriptions / pageSize)}
          onPageChange={handlePageChange}
        />
      </CardContent>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cancel')}</DialogTitle>
            <DialogDescription>
              {t('cancelConfirm')}
              <br />
              {tCommon('fields.plan')}: {selectedSubscription?.plan}
              <br />
              {t('reference')}: {selectedSubscription?.referenceId}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                if (!selectedSubscription) return
                startTransition(async () => {
                  const result = await cancelSubscriptionAction(
                    selectedSubscription.id
                  )
                  if (result.success) {
                    toast.success(result.message)
                    setShowCancelDialog(false)
                    setSelectedSubscription(null)
                  } else {
                    toast.error(result.message)
                  }
                })
              }}
            >
              {isPending ? t('canceling') : t('confirmCancel')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reactivate Dialog */}
      <Dialog
        open={showReactivateDialog}
        onOpenChange={setShowReactivateDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reactivate')}</DialogTitle>
            <DialogDescription>
              {t('reactivateConfirm')}
              <br />
              {tCommon('fields.plan')}: {selectedSubscription?.plan}
              <br />
              {t('reference')}: {selectedSubscription?.referenceId}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowReactivateDialog(false)}
            >
              Annuler
            </Button>
            <Button
              disabled={isPending}
              onClick={() => {
                if (!selectedSubscription) return
                startTransition(async () => {
                  const result = await reactivateSubscriptionAction(
                    selectedSubscription.id
                  )
                  if (result.success) {
                    toast.success(result.message)
                    setShowReactivateDialog(false)
                    setSelectedSubscription(null)
                  } else {
                    toast.error(result.message)
                  }
                })
              }}
            >
              {isPending ? t('reactivating') : t('confirmReactivate')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
