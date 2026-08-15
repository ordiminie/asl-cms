import {notFound} from 'next/navigation'
import {Suspense} from 'react'

import {AdminDashboardSkeleton} from '@/components/features/admin/dashboard/admin-dashboard-skeleton'
import {withAuthAdmin} from '@/components/features/auth/with-auth'
import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'

import AdminDashboardContent from './admin-dashboard-content'

// Route authentifiée, pas encore migrée. Le layout fait un `await` sur la session à son
// niveau supérieur, ce qui bloque tout le segment. Le pattern officiel existe :
// https://nextjs.org/docs/app/guides/authentication-with-cache-components
// (session en 'use cache: private', promesse passée au provider, use() derrière Suspense).
// Voir D17 dans docs/plans/cache-components-migration.md.
export const instant = false

async function AdminPage() {
  if (!isPageEnabled(PagesConst.ADMIN)) {
    return notFound()
  }

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">
            Dashboard Administration
          </h1>
        </div>

        <Suspense fallback={<AdminDashboardSkeleton />}>
          <AdminDashboardContent />
        </Suspense>
      </div>
    </div>
  )
}
export default withAuthAdmin(AdminPage)
