import {Metadata} from 'next'
import React, {Suspense} from 'react'

import {getCurrentUserDal} from '@/app/dal/user-dal'
import AuthProvider from '@/components/context/auth-provider'
import {UserPreferencesSync} from '@/components/context/user-preferences-sync'
import {AppBreadcrumb} from '@/components/features/app-breadcrumb'
import {
  withAuthAdmin,
  WithAuthProps,
} from '@/components/features/auth/with-auth'
import {AdminSidebar} from '@/components/features/layouts/sidebar/admin-sidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import {APP_NAME} from '@/lib/constants'

// Opt-out assumé : le contrôle du rôle ADMIN doit rendre un vrai 403, donc être
// tranché avant le premier octet. Sous streaming, `forbidden()` arriverait après
// le début d'un 200 et ne pourrait plus changer le statut. Le gating grossier
// (authentifié / pas authentifié) est fait dans `proxy.ts` ; le contrôle de rôle
// reste bloquant ici. Voir D17 dans docs/plans/cache-components-migration.md.
export const instant = false

export const metadata: Metadata = {
  title: `Espace administrateur ${APP_NAME}`,
  description: "Page d'espace administrateur",
}

function AdminLayout({
  children,
  user,
}: {
  children: React.ReactNode
} & WithAuthProps) {
  return (
    <AuthProvider userPromise={getCurrentUserDal()}>
      <Suspense fallback={null}>
        <UserPreferencesSync />
      </Suspense>
      <SidebarProvider>
        <AdminSidebar user={user} />
        <SidebarInset>
          <div className="flex min-h-screen flex-col">
            <main className="flex-1">
              <div className="mx-auto w-full max-w-7xl px-4">
                <div className="flex h-14 items-center gap-2">
                  <SidebarTrigger />
                  <AppBreadcrumb />
                </div>
                <div className="pt-4 pb-6">{children}</div>
              </div>
            </main>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  )
}

export default withAuthAdmin(AdminLayout)
