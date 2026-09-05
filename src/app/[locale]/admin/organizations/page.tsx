import {Metadata} from 'next'
import {Suspense} from 'react'

import {OrganizationsManagementSkeleton} from '@/components/features/admin/organizations/organizations-management-skeleton'
import {withAuthAdmin} from '@/components/features/auth/with-auth'

import OrganizationsContent from './organizations-content'

export const metadata: Metadata = {
  title: 'Organisations',
  description: 'Gestion des organisations',
}

type SearchParamsType = Promise<{
  page?: string
  limit?: string
  search?: string
}>

async function OrganizationsPage({
  searchParams,
}: {
  searchParams: SearchParamsType
}) {
  const params = await searchParams
  const suspenseKey = `page=${params.page || '1'}-limit=${params.limit || '20'}-search=${params.search || ''}`

  return (
    <div className="bg-background">
      <Suspense
        key={suspenseKey}
        fallback={<OrganizationsManagementSkeleton />}
      >
        <OrganizationsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

export default withAuthAdmin(OrganizationsPage)
