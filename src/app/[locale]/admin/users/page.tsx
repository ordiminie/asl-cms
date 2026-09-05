import {Metadata} from 'next'
import {Suspense} from 'react'

import {UsersManagementSkeleton} from '@/components/features/admin/users/users-management-skeleton'
import {withAuthAdmin} from '@/components/features/auth/with-auth'

import UsersContent from './users-content'

export const metadata: Metadata = {
  title: 'Utilisateurs',
  description: 'Gestion des utilisateurs',
}

type SearchParamsType = Promise<{
  page?: string
  limit?: string
  search?: string
}>

async function UsersPage({searchParams}: {searchParams: SearchParamsType}) {
  const params = await searchParams
  const suspenseKey = `page=${params.page || '1'}-limit=${params.limit || '20'}-search=${params.search || ''}`

  return (
    <div className="bg-background">
      <Suspense key={suspenseKey} fallback={<UsersManagementSkeleton />}>
        <UsersContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

export default withAuthAdmin(UsersPage)
