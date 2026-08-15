import {Metadata} from 'next'
import {Suspense} from 'react'

import {OrganizationsManagementSkeleton} from '@/components/features/admin/organizations/organizations-management-skeleton'
import {withAuthAdmin} from '@/components/features/auth/with-auth'

import OrganizationsContent from './organizations-content'

// Route authentifiée, pas encore migrée. Le layout fait un `await` sur la session à son
// niveau supérieur, ce qui bloque tout le segment. Le pattern officiel existe :
// https://nextjs.org/docs/app/guides/authentication-with-cache-components
// (session en 'use cache: private', promesse passée au provider, use() derrière Suspense).
// Voir D17 dans docs/plans/cache-components-migration.md.
export const instant = false

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
