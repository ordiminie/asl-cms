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

// Opt-out : `withAuthAdmin` fait un `await` sur la session au niveau supérieur
// du layout, ce qui tient tout le segment.
//
// ⚠️ Ce n'est PAS ce qui produit le 403, contrairement à ce qui était écrit ici.
// Sous Cache Components, toute route dynamique streame un shell d'abord, donc
// `forbidden()` arrive après que le statut soit parti : /admin rend un 200 avec
// l'UI forbidden — mesuré, e2e `authorization.spec.ts`. Aucun contenu admin ne
// fuit, mais pour un vrai 403 il faudrait faire le contrôle de rôle dans
// `proxy.ts`, comme le prescrit la doc :
// https://nextjs.org/docs/app/api-reference/functions/forbidden
// Voir D20 dans docs/plans/cache-components-migration.md.
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
