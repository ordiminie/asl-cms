import {notFound} from 'next/navigation'
import {Suspense} from 'react'

import {AdminDashboardSkeleton} from '@/components/features/admin/dashboard/admin-dashboard-skeleton'
import {withAuthAdmin} from '@/components/features/auth/with-auth'
import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'

import AdminDashboardContent from './admin-dashboard-content'

// Route authentifiée : le layout lit la session via getAuthUser() -> headers() et la
// passe à AuthProvider, qui enveloppe tout l'arbre. Aucun enfant à isoler dans un
// <Suspense> — c'est le cas que la doc Next appelle « no child to wrap ». Lever cet
// opt-out demande de revoir comment AuthProvider obtient l'utilisateur (D16).
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
