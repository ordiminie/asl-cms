'use client'

import {formatDistanceToNow} from 'date-fns'
import {fr} from 'date-fns/locale'
import {useRouter, useSearchParams} from 'next/navigation'
import {toast} from 'sonner'

import {
  deletePlanAction,
  softDeletePlanAction,
  updatePlanAction,
} from '@/app/[locale]/admin/plans/actions'
import {Badge} from '@/components/ui/badge'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {Plan} from '@/services/types/domain/subscription-types'

import {DeletePlanDialog} from './delete-plan-dialog'
import {EditPlanDialog} from './edit-plan-dialog'
import {PlansPagination} from './plans-pagination'
import {PlansToolbar} from './plans-toolbar'

interface Props {
  initialPlans: Plan[]
  currentPage: number
  pageSize: number
  totalPlans: number
  permissions: {
    canCreate: boolean
    canUpdate: boolean
    canDelete: boolean
    canView: boolean
  }
  searchQuery: string
}

export default function PlansManagement({
  initialPlans,
  currentPage,
  pageSize,
  totalPlans,
  permissions,
  searchQuery,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

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

  const getPlanStatusDisplay = (plan: Plan) => {
    return plan.status === 'active' ? 'Actif' : 'Inactif'
  }

  const formatPrice = (price?: string | null, currency?: string) => {
    if (!price) return 'Gratuit'
    const numPrice = parseFloat(price)
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency || 'EUR',
    }).format(numPrice)
  }

  return (
    <Card className="border-0 sm:border">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle>Gestion des plans</CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <PlansToolbar
          onSearch={handleSearch}
          initialSearch={searchQuery}
          totalPlans={totalPlans}
          onPerPageChange={handlePerPageChange}
          perPage={pageSize.toString()}
          permissions={permissions}
        />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="hidden lg:table-cell">Prix</TableHead>
              <TableHead className="hidden lg:table-cell">Statut</TableHead>
              <TableHead className="hidden lg:table-cell">Type</TableHead>
              <TableHead className="hidden md:table-cell">Créé</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialPlans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className="flex items-center gap-2">
                  <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                    <span className="text-sm font-medium">
                      {plan.planName?.charAt(0).toUpperCase() || 'P'}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium">{plan.planName}</div>
                    <div className="text-muted-foreground text-sm">
                      {plan.description || 'Aucune description'}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{plan.code}</Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div>
                    <div className="font-medium">
                      {formatPrice(plan.price, plan.currency)}
                    </div>
                    {plan.yearlyPrice && (
                      <div className="text-muted-foreground text-sm">
                        {formatPrice(plan.yearlyPrice, plan.currency)}/an
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Badge
                    variant={
                      getPlanStatusDisplay(plan) === 'Actif'
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {getPlanStatusDisplay(plan)}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Badge
                    className={
                      plan.isRecurring
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
                    }
                  >
                    {plan.isRecurring ? 'Récurrent' : 'One-time'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                  {formatDistanceToNow(new Date(plan.createdAt || ''), {
                    addSuffix: true,
                    locale: fr,
                  })}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    {permissions.canUpdate && (
                      <EditPlanDialog
                        plan={plan}
                        onSave={async (id, data) => {
                          const result = await updatePlanAction({
                            id,
                            ...data,
                          })

                          if (result.success) {
                            toast.success(result.message)
                          } else {
                            toast.error(result.message)
                          }
                        }}
                      />
                    )}
                    {permissions.canDelete && (
                      <DeletePlanDialog
                        planId={plan.id}
                        planName={plan.planName}
                        onDelete={async (id, permanent) => {
                          const result = permanent
                            ? await deletePlanAction(id)
                            : await softDeletePlanAction(id)

                          if (result.success) {
                            toast.success(result.message)
                          } else {
                            toast.error(result.message)
                          }
                        }}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <PlansPagination
          currentPage={currentPage}
          totalPages={Math.ceil(totalPlans / pageSize)}
          onPageChange={handlePageChange}
        />
      </CardContent>
    </Card>
  )
}
