import {Metadata} from 'next'
import {Suspense} from 'react'

import {PlansManagementSkeleton} from '@/components/features/admin/plans/plans-management-skeleton'
import {withAuthAdmin} from '@/components/features/auth/with-auth'

import PlansContent from './plans-content'

// Route authentifiée, pas encore migrée. Le layout fait un `await` sur la session à son
// niveau supérieur, ce qui bloque tout le segment. Le pattern officiel existe :
// https://nextjs.org/docs/app/guides/authentication-with-cache-components
// (session en 'use cache: private', promesse passée au provider, use() derrière Suspense).
// Voir D17 dans docs/plans/cache-components-migration.md.
export const instant = false

export const metadata: Metadata = {
  title: 'Plans',
  description: "Gestion des plans d'abonnement",
}

type SearchParamsType = Promise<{
  page?: string
  limit?: string
  search?: string
}>

async function PlansPage({searchParams}: {searchParams: SearchParamsType}) {
  const params = await searchParams
  const suspenseKey = `page=${params.page || '1'}-limit=${params.limit || '20'}-search=${params.search || ''}`

  return (
    <div className="bg-background">
      <Suspense key={suspenseKey} fallback={<PlansManagementSkeleton />}>
        <PlansContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

export default withAuthAdmin(PlansPage)
