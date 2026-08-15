import {Metadata} from 'next'
import {Suspense} from 'react'

import {SubscriptionsManagementSkeleton} from '@/components/features/admin/subscriptions/subscriptions-management-skeleton'
import {withAuthAdmin} from '@/components/features/auth/with-auth'

import {SubscriptionsContent} from './subscriptions-content'

export const metadata: Metadata = {
  title: 'Gestion des Abonnements - Admin',
  description: 'Gérer les abonnements utilisateurs',
}

type SearchParamsType = Promise<{
  page?: string
  search?: string
  limit?: string
}>

async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: SearchParamsType
}) {
  const params = await searchParams
  const suspenseKey = `page=${params.page || '1'}-search=${params.search || ''}-limit=${params.limit || '10'}`

  return (
    <div className="bg-background">
      <Suspense
        key={suspenseKey}
        fallback={<SubscriptionsManagementSkeleton />}
      >
        <SubscriptionsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

export default withAuthAdmin(SubscriptionsPage)
